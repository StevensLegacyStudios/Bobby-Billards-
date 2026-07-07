# MASTER PLAN — The UMI Autonomous PM Agent

**For:** Shawn Stevens, Project Manager, United Mechanical (UMI)
**Date:** July 2, 2026
**Status:** Approved design. This is the map. The step-by-step build lives in `docs/SETUP.md`.

---

## 1. The vision

You are one PM buried under 150–200 emails a day. Bid invites, vendor quotes, PO
confirmations, submittals, change orders, RFIs, closeout docs — all mixed together in one
inbox, all waiting on you.

This plan gives you an autonomous assistant that lives inside your Microsoft 365 account.
It reads every email the moment it arrives. It figures out what the email is, which job it
belongs to, and what needs to happen. It logs it, files the attachments, drafts the reply,
chases the vendors who go quiet, and hands you a short briefing every morning.

A real example of the end state:

1. Ferguson emails you a quote for floor drains on the Perplexity job.
2. The agent already knows (from its memory) that "Perplexity" = "181 Fremont" = "PPLX"
   = job **11836-15**.
3. It logs the email, pulls out the line items (like the Kohler K-30810), saves the PDF to
   the job folder, and drafts your reply.
4. It sends you one Teams card: **Approve / Edit / Decline**. You tap Approve. Done.
5. If Ferguson had *not* replied to your quote request, the agent would have nudged them
   itself after 2 business days — politely the first time, firmer the third time.

You stay in charge of every decision that involves money, scope, schedule, or contract
language. The agent does the reading, sorting, and typing.

---

## 2. Final architecture (the "no hosting" design)

Four parts. No servers. No Azure. Nothing for IT to build or maintain.

| Part | What it is | What it costs |
|---|---|---|
| **Engine** | Power Automate cloud flows, running in the UMI tenant as you | Power Automate Premium, **$15/user/month** (one license, assigned to Shawn) |
| **Brain** | The Anthropic Claude API, called directly from Power Automate's HTTP action — no middleman | ~**$30–100/month** in usage at 150–200 emails/day (with prompt caching) |
| **Memory** | SharePoint lists on the existing team site `https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam` | $0 (already in your M365 plan) |
| **You-in-the-loop** | Teams adaptive cards / approvals for anything involving money, scope, schedule, or contract language | $0 (standard, free connector) |

### The picture

```
  New email arrives                          Weekday timers
  (your Outlook inbox)                       (7:30 AM + 8:00 AM Pacific)
         |                                          |
         v                                          v
  +---------------------------------------------------------------+
  |                 POWER AUTOMATE  (the engine)                   |
  |                                                                |
  |  Flow 1 Email Intake & Triage                                  |
  |  Flow 2 Bid Capture & Proposal Draft                           |
  |  Flow 3 Daily Follow-Up Chaser                                 |
  |  Flow 4 Submittal & Closeout Filing                            |
  |  Flow 5 Learning & Corrections                                 |
  |  Flow 6 Daily Briefing                                         |
  +---------------------------------------------------------------+
         |                                          ^
         |  HTTPS call: email text + PDFs +         |
         |  "learned context" from AgentMemory      |  lessons injected
         v                                          |  into every call
  +--------------------------+                      |
  |   CLAUDE API (the brain) |                      |
  |   reads, extracts,       |                      |
  |   drafts — returns JSON  |                      |
  +--------------------------+                      |
         |                                          |
         v                                          |
  +---------------------------------------------------------------+
  |               SHAREPOINT  (the memory) — 10 lists              |
  |                                                                |
  |  Jobs | Email Intake Log | Bids | Purchase Orders | Submittals |
  |  Change Orders | Quotes In Progress | Closeout Docs |          |
  |  OpenItems | AgentMemory ------------------------------------->+
  |  (plus job folders in the "Shared Documents" library)          |
  +---------------------------------------------------------------+
         |
         v
  +---------------------------------------------------------------+
  |          TEAMS APPROVAL CARDS  (you-in-the-loop)               |
  |   Money, scope, schedule, contract = always your call.         |
  |   Approve -> it sends.  Edit/Decline -> Flow 5 writes the      |
  |   correction to AgentMemory. The next email is smarter.        |
  +---------------------------------------------------------------+
```

The learning loop is the part that makes this an *assistant* instead of a filter: every
time you correct it (for example: `Subject "RE: floor drains" → Change Order, NOT RFI
Field Coordination`), Flow 5 saves that lesson to the **AgentMemory** list, and Flow 1
reads AgentMemory on every single run. One correction, and the mistake stops repeating.

### Why this doesn't need IT to build anything

Power Automate already runs inside the UMI tenant with your permissions. The only outside
call is Power Automate reaching out to `api.anthropic.com` over HTTPS — the same as any
web request. IT already approved "Claude for Office" and the "M365 MCP Client for Claude";
this pipeline doesn't even depend on those. The one thing IT *could* do that would break
it is a Power Platform DLP policy that blocks `api.anthropic.com` on the HTTP connector —
`docs/SETUP.md` has a troubleshooting note for exactly that case.

Capacity check: Power Automate Premium allows 40,000 actions/day. This whole workload
uses about 8% of that. The Anthropic "Start" tier allows 1,000 requests/minute with a
$500/month spend cap — far above what this ever needs.

---

## 3. What the agent CAN and CANNOT do

Be honest with yourself about both lists. The CAN list is why it's worth building. The
CANNOT list is why you'll still have a job — and why the Teams cards exist.

### It CAN

1. **Read** every email and attachment the moment it arrives, including native PDFs.
2. **Sort** each email into one of 12 categories (Bid Invite, PO Confirmation, Change
   Order, and so on).
3. **Extract** the facts: job, vendor, PO number, amounts, dates, item descriptions
   (down to "Kohler K-30810"), delivery info.
4. **Log** everything to SharePoint lists so nothing lives only in your inbox.
5. **Draft** replies, proposals, and quote requests in your voice — always as drafts or
   behind an approval card, never auto-sent when money is involved.
6. **Chase** vendors who go quiet, on a set cadence, with escalating politeness, and stop
   the moment they answer.
7. **File** attachments into the right job folder and move approved closeout docs where
   they belong.
8. **Brief** you every weekday morning: what needs you today, what it handled, what's
   coming.
9. **Learn** from every correction you make, permanently, via the AgentMemory list.

### It CANNOT

1. **Make judgment calls on money, scope, schedule, or contract language.** Those always
   stop at a Teams card for you.
2. **Read a garbage scan perfectly.** Messy, skewed, or handwritten pages will sometimes
   come back wrong. That's what the confidence gate and "Verify this email" card are for.
3. **Know things nobody wrote down.** If "the Perplexity job" only exists in your head as
   "PPLX," it won't connect them until you (or one correction) teach it the alias.
4. **Be right on day one.** It needs your corrections in the first couple of weeks. Each
   one is a permanent lesson, not a repeat chore.
5. **Negotiate.** It can draft the email that pushes back on Ferguson's price; it will
   never decide the number.
6. **Go around your permissions.** It runs as you. It can only see and touch what you can.

---

## 4. Module map — every workflow, and where it lives

| Module | What it does | Flow | Model | Lists / tools it touches |
|---|---|---|---|---|
| **Email triage** | Reads, categorizes, extracts, and logs every inbound email; routes it to the right action | Flow 1 — Email Intake & Triage | claude-sonnet-5 | `Email Intake Log`, `AgentMemory` (read), job folders in Shared Documents |
| **To-do lists** | Every action-required email becomes a Microsoft To Do task (list "UMI Action Items"); `OpenItems` stays the canonical tracker | Flow 1 (last step) | — | Microsoft To Do, `OpenItems` |
| **Bids capture** | A "Bid Decision Needed" email creates a `Bids` row, calendar events for job walk / bid due, and a Bid/No-Bid card | Flow 1 → Flow 2 | claude-sonnet-5 → claude-opus-4-8 | `Bids`, Outlook Calendar, Teams |
| **Bid proposals** | Reads the full bid package PDFs, pulls scope / dates / addenda, drafts clarification questions + a proposal skeleton in your voice + a bid checklist | Flow 2 — Bid Capture & Proposal Draft | claude-opus-4-8 | `Bids`, `OpenItems` (checklist rows), Outlook drafts (never sends) |
| **Submittals** | A "Submittal Action Needed" email creates/updates a `Submittals` row; approval status changes trigger filing | Flow 1 → Flow 4 | — (Flow 4 has no AI) | `Submittals` |
| **POs** | PO confirmations get logged; "PO Request to Send" drafts go behind a Teams Approve/Edit/Decline card — money never auto-sends | Flow 1 | claude-sonnet-5 | `Purchase Orders`, `Email Intake Log`, Teams |
| **COs** | Change Order emails are categorized, logged, and flagged — contract language always stops at a card | Flow 1 | claude-sonnet-5 | `Change Orders`, `Email Intake Log`, Teams |
| **RFIs** | RFI / field-coordination emails become a "Field Response Needed" Teams card with a drafted reply | Flow 1 | claude-sonnet-5 | `Email Intake Log`, Teams |
| **Closeouts + logs** | Creates a `Closeout Docs` row per material (Cut Sheet, Installation, O&M Manual, Warranty Letter, As-Built), requests docs from vendors, files approved docs to `Jobs/<job>/Closeout/<material>/` and `_Final Handover/` | Flow 4 — Submittal & Closeout Filing (plus Flow 1 "Closeout Doc to File") | — (no AI) | `Closeout Docs`, `Submittals`, OneDrive staging, SharePoint job folders |
| **Auto-chaser** | Every weekday at 8:00 AM, reviews open follow-ups and decides send / wait / escalate per the cadence rules (e.g., quotes: first nudge +2 business days, max 3 nudges) | Flow 3 — Daily Follow-Up Chaser | claude-sonnet-5 | `OpenItems`, Outlook (replies on thread), Teams (escalations) |
| **Daily briefing** | Every weekday at 7:30 AM: "What needs you today / What I handled / What's coming" | Flow 6 — Daily Briefing | claude-sonnet-5 | Reads `Email Intake Log`, `OpenItems`, `Bids`, `Submittals`, `Closeout Docs`; posts to Teams or email |
| **Learning loop** | Turns every Edit/Decline card response into a permanent lesson; fixes the logged row | Flow 5 — Learning & Corrections | — (no AI) | `AgentMemory`, `Email Intake Log` |

Full step-by-step specs for all six flows: `docs/FLOW_SPECS.md`. The exact prompts and
JSON schemas: `docs/PROMPTS.md`.

---

## 5. Cost — what we're paying, and what we rejected

### The bill

| Item | Monthly cost | Note |
|---|---|---|
| Power Automate Premium (1 user: Shawn) | **$15** | Unlocks the HTTP premium connector; the flow owner's license covers the automated flows |
| Claude API usage | **~$30–100** | At 150–200 emails/day with prompt caching (cache reads cost ~0.1x, and cached tokens don't count against rate limits) |
| **Total** | **~$45–115/month** | |

### The rejected alternatives

| Option | Monthly cost | Why we said no (one line) |
|---|---|---|
| Copilot Studio autonomous agent | ~**$1,200–1,800** | A 25-credit "autonomous trigger" tax on every single run — M365 Copilot licenses never cover autonomous runs — plus documented trigger-reliability issues. |
| AI Builder GPT-4.1 (standard) in Power Automate | ~**$555** | Roughly 5x our price for weaker PDF extraction: it converts PDF pages to images, caps at 50 pages, and cuts off at 100 seconds. |
| AI Builder GPT-4.1 mini (basic) | ~**$51** | The only cheaper option, but the weakest quality on messy construction PDFs — and AI Builder credits are being retired in November 2026 anyway. |

The full cost math (run-by-run credit rates, sources) is in the engine comparison research;
the short version: the chosen stack is about 10x cheaper than Copilot Studio and reads
construction PDFs natively instead of as page images.

---

## 6. The three phases

**Phase 0 — Interactive (today).** Use Claude interactively while the pipeline gets built:
ask it questions, paste in emails, have it draft replies you send yourself. The Claude for
Outlook add-in is part of this phase — if it won't sign in, `docs/OUTLOOK_FIX.md` is the
fix-it guide. Nothing autonomous yet; zero risk.

**Phase 1 — Triage + log + draft.** Build Flow 1 (Email Intake & Triage) and Flow 5
(Learning & Corrections), then test on 5 real emails. The agent reads, sorts, extracts,
and logs everything, and drafts replies — but every send goes through a Teams card, and
low-confidence reads stop at a "Verify this email" card. This is the phase where you
correct it and it learns fast.

**Phase 2 — Chase + file + loosen the leash.** Build Flows 3, 2, 4, and 6 (in that order —
see `docs/SETUP.md`). The chaser starts sending routine vendor nudges on its own; filing
runs untouched; the daily briefing lands every morning at 7:30. After the pilot week, you
loosen the leash on routine items — but money, scope, schedule, and contract language stay
behind an approval card permanently.

---

## 7. Decisions already made (don't re-litigate these)

| Decision | The call | Why (one line) |
|---|---|---|
| Engine | **Power Automate** cloud flows (Premium, $15/user/month) | Rock-solid GA email trigger, runs in the tenant as Shawn, nothing to host |
| Brain | **Direct Claude API** from the Power Automate HTTP action | No middleman service; frontier extraction quality; reads PDFs natively |
| Azure | **None** | Removed from the design — nothing for IT to stand up or maintain |
| Hosting | **None** | The old Node extraction service (`src/microsoft/`) is optional/legacy only — see the banner in `docs/DEPLOY.md` |
| SharePoint site | **QualityControlManagementTeam** (`https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam`) | Existing team site; files go in the `Shared Documents` library (displayed as "Documents") |
| Models | **claude-sonnet-5** as the workhorse; **claude-opus-4-8** for bid packages and proposal drafts | Sonnet 5 = near-Opus quality, native PDF, cheap; Opus 4.8 = the hardest reads and customer-facing writing |
| Data model | **10 SharePoint lists**, provisioned by `scripts/provision-sharepoint.ps1` | `Jobs`, `Email Intake Log`, `Bids`, `Purchase Orders`, `Submittals`, `Change Orders`, `Quotes In Progress`, `Closeout Docs`, `OpenItems`, `AgentMemory` |
| Learning | **AgentMemory list**, read by Flow 1 on every run | No feedback endpoint, no database — corrections are just list items you can see and retire |

---

## 8. What to read next

1. `docs/SETUP.md` — the ordered runbook. Start at step 1 (the $15 license).
2. `docs/FLOW_SPECS.md` — click-by-click specs for Flows 1–6.
3. `docs/PROMPTS.md` — the copy-paste prompt library and JSON schemas.
4. `docs/OUTLOOK_FIX.md` — only if the Claude for Outlook add-in gives you trouble
   (the autonomous pipeline does not depend on it).
