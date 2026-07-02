# SETUP.md — The Build Runbook

**Who this is for:** Shawn Stevens, PM at United Mechanical (UMI). No coding background needed.
**What you get at the end:** an autonomous email agent that reads, sorts, logs, drafts, chases, files, and briefs — and asks you before anything involving money, scope, schedule, or contract language.
**Time budget:** about 1 day of setup spread over a week, then a 1-week pilot.

Do the steps **in order**. Each step tells you exactly where to click.

Companion documents:

| Document | What it holds |
|---|---|
| `docs/MASTER_PLAN.md` | The vision, what the agent can and cannot do, costs, phases |
| `docs/FLOW_SPECS.md` | Action-by-action build instructions for all six flows |
| `docs/PROMPTS.md` | Every prompt and JSON schema, ready to copy-paste |
| `docs/CLOSEOUT_FOLDERS.md` | The job folder structure the scripts create |
| `docs/OUTLOOK_FIX.md` | Fixing the Claude for Outlook add-in (separate tool — the pipeline below does **not** need it) |

---

## Step 1 — Get the Power Automate Premium license

You need exactly **one** paid Microsoft license: **Power Automate Premium, $15/user/month**, assigned to you.

Why: the flows call the Claude API through Power Automate's **HTTP action**, which is a premium connector. Because automated flows run under the flow **owner's** license, one license on you covers the whole pipeline. It comes with 40,000 actions/day — this workload uses roughly 8% of that.

This is a **billing action, not an IT integration**. Nothing new gets installed. Whoever manages your Microsoft 365 billing does this:

1. Go to `admin.microsoft.com` (Microsoft 365 admin center).
2. Left menu: **Billing > Purchase services**.
3. Search **"Power Automate Premium"** > **Details** > **Buy** (1 license).
4. Left menu: **Users > Active users** > click **Shawn Stevens** > **Licenses and apps** tab.
5. Check **Power Automate Premium** > **Save changes**.

### Copy-paste this to your manager

> Hi — I need one software license approved to run the email-automation build: **Power Automate Premium, $15/user/month, assigned to me**. This is a **billing action, not an IT integration** — Power Automate is already part of our Microsoft 365 tenant, and the Premium license just unlocks the HTTP connector my flows use. IT has **already approved the Claude apps** in our tenant ("Claude for Office" and the "M365 MCP Client for Claude"), and this build installs nothing new — the flows run under my own account inside our tenant and make one outbound call to `api.anthropic.com`. The **only** thing that could block it is if IT has a Power Platform DLP policy with connector **endpoint filtering** that blocks `api.anthropic.com` on the HTTP connector — if so, I'd need that one endpoint allowed. Ongoing cost: $15/month for the license plus roughly $30–100/month of Claude API usage.

**Heads-up for later:** if this license is ever removed from you, Microsoft turns the premium flows off after 14 days. Keep the license on the flow owner.

---

## Step 2 — Create your Anthropic account and API key

The "brain" is the Claude API, billed by usage (≈ **$30–100/month** at 150–200 emails/day, thanks to prompt caching). The Anthropic "Start" tier allows 1,000 requests/minute with a $500/month spend cap — far more than you need.

1. Go to `https://console.anthropic.com` and click **Sign Up**. Use your work email.
2. Verify the email and sign in.
3. Go to **Settings > Billing**. Add a company card. Set a **monthly spend limit** (e.g., $150) so a runaway loop can never surprise anyone.
4. Go to **API Keys** > **Create Key**. Name it `UMI-PowerAutomate`. Click **Copy** — the key is shown **once only**.

### Key safety rules (non-negotiable)

1. The key starts with `sk-ant-`. Anyone who has it can spend your budget. Treat it like a company credit card number.
2. **Never email it. Never paste it into Teams, chat, or a document.**
3. Store the master copy in a password manager (or written down and locked up — not a sticky note).
4. In every flow, the key goes only into the HTTP action's `x-api-key` header, and that action must have **Secure Inputs** and **Secure Outputs** turned ON (Settings on the action). This hides the key from the flow's run history.
5. If you ever suspect the key leaked: Console > **API Keys** > delete it > create a new one > update the HTTP actions. Takes 5 minutes.

---

## Step 3 — Provision SharePoint (PowerShell, one time)

This creates the agent's memory: **10 lists** on your existing team site
`https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam`
(document library: `Shared Documents`, shown in the browser as "Documents").

| # | List | Purpose |
|---|---|---|
| 1 | `Jobs` | Master job list (numbers, GC, foreman, aliases) |
| 2 | `Email Intake Log` | Every processed email, one row each |
| 3 | `Bids` | Bid invites and their status |
| 4 | `Purchase Orders` | PO tracking |
| 5 | `Submittals` | Submittal register |
| 6 | `Change Orders` | CO tracking |
| 7 | `Quotes In Progress` | Vendor quotes being assembled |
| 8 | `Closeout Docs` | O&Ms, warranties, as-builts per material |
| 9 | `OpenItems` | The to-do / follow-up tracker the chaser works |
| 10 | `AgentMemory` | The learning store (aliases, corrections, house rules) |

Do this:

1. On your PC, click **Start**, type **PowerShell**, open **Windows PowerShell**.
2. Install the SharePoint tool (one time; answer `Y` if prompted):
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ```
3. Change into the folder where this package's `scripts` folder lives, then run:
   ```powershell
   ./provision-sharepoint.ps1 -SiteUrl "https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam"
   ```
   A browser window opens — sign in as yourself.
4. Wait for the final line:
   `Done. 10 lists provisioned on https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam.`
   If you see "already exists - skipping" lines, that's fine — the script is safe to re-run.
5. For **each awarded job**, create its folder skeleton (example uses the real Perplexity job):
   ```powershell
   ./provision-closeout-folders.ps1 `
     -SiteUrl "https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam" `
     -JobName "Perplexity 181 Fremont" -JobNumber "11836-15"
   ```
   This creates `Shared Documents/Jobs/Perplexity 181 Fremont (11836-15)/` with `Submittals`, `Emails`, `Closeout`, and the `_Final Handover` binder (see `docs/CLOSEOUT_FOLDERS.md`).
6. **Move `PM Docs` into OneDrive sync.** Flow 4 stages closeout files from `PM Docs/All Closeout Docs/<material>/` in your OneDrive. If your `PM Docs` folder isn't already inside your synced OneDrive, move it there now (drag it into the OneDrive folder in File Explorer and let it finish syncing).

---

## Step 4 — Seed the lists (teach it what you already know)

The agent is only as smart as its memory on day one. Seed three lists by hand in the browser (open the site > **Site contents** > click the list > **+ New**).

### 4a. `Jobs` — at least 3 rows, and always fill `AltNames`

`AltNames` is how the agent matches an email that says "PPLX" to job 11836-15. Separate aliases with semicolons.

| Title | JobNumber | Location | Status | AltNames |
|---|---|---|---|---|
| Perplexity 181 Fremont | 11836-15 | 181 Fremont, San Francisco | Active | Perplexity; 181 Fremont; PPLX |
| *(your 2nd busiest active job)* | *(its job #)* | *(address)* | Active | *(every nickname GCs and vendors use)* |
| *(your 3rd busiest active job)* | *(its job #)* | *(address)* | Active | *(every nickname)* |

Fill the other columns (CustomerGC, PM, Foreman, ForemanPhone, dates) as you know them — more is better.

### 4b. `AgentMemory` — 3 starter rows (house rules)

These exact rows give Flow 1 its first lessons. Set **Active = Yes** on all three.

| Title | EntryType | Job | JobNumber | Content | Source |
|---|---|---|---|---|---|
| Perplexity aliases | Job Alias | Perplexity 181 Fremont | 11836-15 | "Perplexity" = "181 Fremont" = "PPLX" | Setup seeding 2026-07-02 |
| Floor drains thread is a CO | Correction | Perplexity 181 Fremont | 11836-15 | Subject "RE: floor drains" → Change Order, NOT RFI Field Coordination | Setup seeding 2026-07-02 |
| Kohler K-30810 belongs to 11836-15 | House Rule | Perplexity 181 Fremont | 11836-15 | Emails about Kohler K-30810 floor drains (e.g., Ferguson quotes) belong to job 11836-15 | Setup seeding 2026-07-02 |

How it works: Flow 1 reads every **Active** AgentMemory row on every run and injects them into the prompt. Every correction you make later (Step 7) lands here automatically via Flow 5 — the very next email benefits.

---

## Step 5 — Build Flow 1 and Flow 5, then test on 5 real emails

Build order for the whole project: **Flow 1 → Flow 5 → Flow 3 → Flow 2 → Flow 4 → Flow 6.** Flow 1 is the backbone; Flow 5 is how you correct it, so those two go first.

### 5a. Build Flow 1 — Email Intake & Triage

Follow `docs/FLOW_SPECS.md` (Flow 1 section) action by action. The prompt body and JSON schema are copy-paste blocks in `docs/PROMPTS.md` (triage section). The skeleton:

1. Go to `https://make.powerautomate.com` > **Create** > **Automated cloud flow**.
2. Name: `Flow 1 - Email Intake & Triage`. Trigger: search **"When a new email arrives (V3)"** (Office 365 Outlook) > **Create**.
3. On the trigger: **Folder** = Inbox, **Include Attachments** = **Yes**. Add the trigger conditions from FLOW_SPECS (skip auto-replies, calendar invites, and mail from yourself).
4. Add the **HTTP** action (premium) that calls `POST https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`. Model `claude-sonnet-5`, `max_tokens` 1500.
5. On that HTTP action: **Settings** > turn ON **Secure Inputs** and **Secure Outputs**; **Retry Policy** = Exponential, Count **4**, Interval **PT10S**.
6. Finish the remaining actions per FLOW_SPECS: Parse JSON on `body('HTTP')?['content'][0]['text']`, create the `Email Intake Log` row, save attachments, confidence gate, the 9-way `action_type` switch, and the Microsoft To Do task (list "UMI Action Items").

### 5b. Build Flow 5 — Learning & Corrections

Follow `docs/FLOW_SPECS.md` (Flow 5 section). No Claude call — it catches your Teams card **Edit/Decline** responses from Flows 1–3, writes a Correction or Job Alias row to `AgentMemory`, and fixes the `Email Intake Log` row.

### 5c. The 5-real-emails test

1. Turn both flows **On**.
2. Pick 5 real, recent emails that cover the range:
   - a vendor quote — e.g., the **Ferguson** quote for the **Kohler K-30810 floor drains** on job **11836-15**
   - a PO confirmation
   - a bid invite from a GC
   - a submittal or closeout-docs email
   - one junk/newsletter email (should come out "General Other" / "No Action")
3. Have a **coworker forward** them to your Inbox one at a time (the trigger deliberately skips mail sent from your own address, so forwarding them to yourself won't fire it).
4. Watch each run: `make.powerautomate.com` > **My flows** > Flow 1 > **28-day run history** > click the run. Green checks all the way down = it ran.
5. For each email, open `Email Intake Log` and check the new row: EmailCategory right? Job matched (the Ferguson one should hit **Perplexity 181 Fremont / 11836-15** even if the email only says "PPLX")? Confidence sensible? NeedsManualReview flagged only when it should be?
6. **Score it: 4 of 5 correct = pass.** For every miss, answer the Teams card with **Edit** and the correction — Flow 5 writes it to `AgentMemory`.
7. Have the missed email forwarded again. Confirm it now lands correctly. That's the learning loop working.

Don't move to Step 6 until you pass.

---

## Step 6 — Build the remaining flows: 3, then 2, then 4, then 6

One flow at a time, in this order. Each has a full action-by-action section in `docs/FLOW_SPECS.md`; every prompt body is in `docs/PROMPTS.md`.

1. **Flow 3 — Daily Follow-Up Chaser.** Recurrence trigger, weekdays **8:00 AM Pacific**. Reads `OpenItems` (Status Open or Nudged), asks Claude (`claude-sonnet-5`, max_tokens 1200) send/wait/escalate per item using the cadence table in `docs/PROMPTS.md` (chaser section). Test it by hand-adding one `OpenItems` row (e.g., Kind "Quote Request", Vendor Ferguson, Title "Quote for floor drains") and clicking **Test > Manually** on the flow.
2. **Flow 2 — Bid Capture & Proposal Draft.** Triggers when Flow 1 creates a `Bids` row. Uses `claude-opus-4-8` (max_tokens 4000) to read the bid package and draft the proposal skeleton as an Outlook **draft** (never sends). Build per FLOW_SPECS (Flow 2 section) and PROMPTS (bid-extraction + proposal-draft sections).
3. **Flow 4 — Submittal & Closeout Filing.** No AI. Creates `Closeout Docs` rows when a `Submittals` row appears, and on approval moves files from OneDrive staging (`PM Docs/All Closeout Docs/<material>/`) into the job's `Closeout` folder. FLOW_SPECS Flow 4 section.
4. **Flow 6 — Daily Briefing.** Recurrence, weekdays **7:30 AM Pacific**. One Claude call (`claude-sonnet-5`, max_tokens 2000) turns yesterday's log, open items, bids due within 7 days, at-risk submittals, and outstanding closeout docs into a morning briefing in Teams. FLOW_SPECS Flow 6 section; PROMPTS briefing section.

After each build, run it once (Test > Manually, or trigger it with a real item) before starting the next.

---

## Step 7 — Pilot week and loosening the leash

Run everything for one full week on a tight leash.

### Pilot-week protocol

1. All six flows **On**. All approval cards armed (they already are, per the specs — anything touching money, scope, schedule, or contract language stops at a Teams card).
2. **10 minutes every morning:** open `Email Intake Log`, filter **NeedsManualReview = Yes**, and check those rows. Skim `OpenItems` for anything odd.
3. **Answer every Teams card the same day.** Approve, Edit, or Decline. Every Edit/Decline is a lesson — Flow 5 files it in `AgentMemory` and the next email is smarter. Corrections in week 1 are worth ten in month three.
4. **Skim Flow 3's morning run** in run history: were the nudges it sent reasonable? The tone steps up on its own (1st "Just following up", 2nd "Circling back", 3rd "Third time checking in").
5. **Read the 7:30 briefing** and act from it instead of your inbox for a day. If it's missing something you needed, that's a correction.
6. End of week: count your corrections. Under ~5 for the week = ready to loosen.

### Leash-loosening schedule

| When | What loosens | What you keep doing |
|---|---|---|
| Week 1 (pilot) | Nothing. Verify everything daily. | Daily 10-min log review, answer all cards |
| Week 2 | Trust rows with confidence ≥ 0.90 without row-by-row checks | Review only NeedsManualReview rows; answer cards |
| Weeks 3–4 | Stop reviewing Flow 3's routine nudges; trust auto-filing of closeout docs | Handle escalation cards ("3 nudges, no answer") and approvals |
| Monthly | — | Hygiene: review `AgentMemory`, flip **Active = No** on stale rows, keep it under ~200 active |
| **Never** | **Money, scope, schedule, contract language.** Quote approvals, PO sends, bid/no-bid — always a Teams approval card. The agent never auto-sends these. | |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| HTTP action fails with **401** | Bad, mistyped, or revoked API key | Check the `x-api-key` header for typos/spaces. If the key was deleted, create a new one at `console.anthropic.com` > API Keys and update every HTTP action. |
| HTTP action fails with **429** | Rate limit or spend cap hit | The retry policy (Exponential, 4 retries, PT10S) absorbs normal bursts — cached tokens don't even count against rate limits. If it persists, check Console > Billing: you may have hit your own monthly spend limit or the Start tier's $500/mo cap. |
| HTTP action fails at ~**120 seconds** | Power Automate's hard 120-second timeout on the HTTP action | Lower `max_tokens` (per-flow values in FLOW_SPECS). For huge bid packages in Flow 2, split into one Claude call per PDF, as the Flow 2 spec describes. |
| HTTP action won't run; error mentions **DLP** or "blocked by policy" | IT has a Power Platform DLP policy with connector **endpoint filtering** blocking `api.anthropic.com` on the HTTP connector | Ask IT to allow `api.anthropic.com` for the HTTP connector. Reuse the manager paragraph in Step 1 — this is the one known blocker. |
| PDF/attachment content is empty or Claude "can't see" the file | Trigger not returning content, or wrong expression | On the Flow 1 trigger, confirm **Include Attachments = Yes**. Loop over `triggerOutputs()?['body/attachments']`; inside the loop the base64 content is `items('Apply_to_each')?['contentBytes']` — it is **already base64, do not wrap it in base64() again**. Note: .eml/.msg/.ics attachments never come through this trigger. |
| Claude bill higher than expected / cache not hitting | Prompt caching isn't engaging | The system block must be ≥ 1,024 tokens and carry `"cache_control": {"type":"ephemeral"}` (it does, if you pasted from `docs/PROMPTS.md` unmodified). Cache lasts 5 minutes and each email refreshes it, so steady traffic stays warm (reads cost ~0.1×). Check the HTTP response's `usage` for `cache_read_input_tokens` > 0. Any edit to the system text restarts the cache — expect one 1.25× write after prompt changes. |
| SharePoint action fails with **"Access denied"** / permission error | The connection account lacks rights, or throttling | Flows write as the **connection's** account — it needs at least Contribute on the site (that's why rows show that account under "Modified By"). Check **My flows > Flow > Connections**, re-add the connection as yourself. Bursts beyond 600 SharePoint calls/min per connection get throttled — the retry policy usually recovers it. |
| Premium flows turned off by themselves | Flow owner lost the Power Automate Premium license | Microsoft disables premium flows 14 days after the owner's license lapses. Restore the license (Step 1) and turn the flows back on. |

---

**Done.** When the pilot week passes, you're in Phase 2 of `docs/MASTER_PLAN.md`: the agent triages, logs, drafts, chases, files, and briefs — and you make the calls that matter.
