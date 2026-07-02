# UMI Job Tracking & Automation — Microsoft 365 Build (Hybrid)

> **⚠️ SUPERSEDED.** This was the v1 plan, built around a hosted extraction service. The
> current design drops the hosted service entirely — Power Automate calls the Anthropic API
> directly. Use **[MASTER_PLAN.md](MASTER_PLAN.md)** (the what/why), **[SETUP.md](SETUP.md)**
> (the runbook), and **[FLOW_SPECS.md](FLOW_SPECS.md)** (the flow specs). This file stays as
> background: the Bible mapping, folder rationale, and rollout thinking are still accurate.

This is the build plan for putting the agent into your Microsoft world, the **Hybrid**
way: **Power Automate + SharePoint + Outlook** do the low-code capture, routing, and
auto-emails; the **Claude "brain"** (this repo) does the smart parts — reading each email
and extracting structured fields. It implements your *UMI System Bible v2.0* plus the
closeout-docs workflow.

```
 Outlook inbox
     │  (Flow 1 trigger: "When a new email arrives")
     ▼
 Power Automate ──HTTP POST /extract──►  Claude extraction service  (this repo: npm run serve:ms)
     │  ◄──────── JSON: category, job, vendor, dates, action, confidence ────────┘
     ▼
 SharePoint Lists (8)  ──►  route by category  ──►  calendar events, Teams alerts,
 Jobs · Email Intake · Bids · POs · Submittals · COs · Quotes · Closeout Docs   auto-emails, follow-ups
```

**Why this shape:** AI Builder's parsing is weaker on long forwarded chains (your emails
are 8+ replies deep), and it can't *learn*. Routing the body to the Claude brain gives much
better accuracy **and** a feedback loop that improves with every correction you make — while
the low-code orchestration still lives in your tenant. The brain owns the smart parts
(classify, extract, draft, learn); Power Automate owns the plumbing (triggers, SharePoint,
calendar, sending mail).

See **[AUTOMATION_AND_LEARNING.md](AUTOMATION_AND_LEARNING.md)** for what runs automatically
vs. what waits for your confirm, the confidence tiers, and how the learning loop works.

---

## Where your files live (answering "where do you need it?")

Automation can only file documents that are in the **cloud** (OneDrive/SharePoint), not on
a local-only desktop folder. Keep working from your desktop — just point the folders at
OneDrive so they sync **and** are reachable by Power Automate:

| Folder | Put it here | Why |
| --- | --- | --- |
| **Staging** — `PM Docs/All Closeout Docs/<material>/` | **OneDrive for Business**: `OneDrive - United Mechanical/PM Docs/All Closeout Docs/` | Syncs to your desktop (you work as you do today) and the OneDrive connector can read/move it. |
| **Job closeout** — `Jobs/<Job> (<Job#>)/Closeout/<material>/` | **SharePoint** document library on your PM site (`Documents/Jobs/...`) | Shared with the team; the flow files approved docs here. |

Action: move (or sync) the existing desktop `PM Docs` folder into OneDrive. Once it shows
the green OneDrive check, Power Automate's OneDrive/SharePoint "Move file" action can do the
staging → job-folder move automatically when a submittal is approved. Until then, the tool
prints the exact move manifest (`from → to`) for you to drag by hand.

**Full folder design + per-job provisioning:** see
**[docs/CLOSEOUT_FOLDERS.md](CLOSEOUT_FOLDERS.md)** and
`scripts/provision-closeout-folders.ps1`.

---

## Step 1 — Provision the SharePoint lists

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
./scripts/provision-sharepoint.ps1 -SiteUrl "https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam"
```

Creates all 8 lists with columns and choice values (the 7 from the Bible + **Closeout
Docs**). Then add each job's alternate names to the **Jobs → AltNames** column so email
matching works ("Perplexity" = "181 Fremont" = "PPLX").

## Step 2 — Deploy the Claude extraction service

It's a tiny HTTP service (no extra dependencies). Host it anywhere Power Automate can reach
over HTTPS — **Azure Container Apps** or **Azure Functions (custom handler)** are the
natural fit in your tenant.

```bash
# Local smoke test:
export ANTHROPIC_API_KEY=sk-ant-...
export UMI_EXTRACT_TOKEN=$(openssl rand -hex 16)   # shared secret for the HTTP action
npm run serve:ms
curl -s localhost:8787/extract -H "x-umi-token: $UMI_EXTRACT_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"subject":"RE: 11836-15 Perplexity PO 1183615-017","from_email":"msilas@pacesupply.com","body":"Order confirmation attached, delivery 6/9 to 181 Fremont."}'
```

Returns validated JSON (`email_category`, `job_number`, `vendor`, `delivery_date`,
`action_type`, `urgency`, `confidence`, …). Env vars: `ANTHROPIC_API_KEY` (required),
`UMI_EXTRACT_TOKEN` (optional shared secret), `PORT` (default 8787),
`UMI_EXTRACT_MODEL` (default `claude-opus-4-8`).

## Step 3 — Build Flow 1 (Email Monitor & Intake)

In Power Automate, **Automated cloud flow → "When a new email arrives (V3)"**:

1. **Filter noise** — skip auto-replies/calendar invites and mail from yourself.
2. **HTML to text** on the body.
3. **HTTP** action → `POST https://<your-service>/extract`, header `x-umi-token`, body:
   `{ "subject": @{triggerOutputs()?['subject']}, "from_name": ..., "from_email": ...,
   "date": ..., "body": <plain text>, "attachments": [...] }`.
4. **Parse JSON** on the response (schema = the `/extract` output).
5. **Condition** on `confidence`: `< 0.70` → post a Teams card to Shawn ("verify this
   email") and log to **Email Intake Log** with `NeedsManualReview = Yes`. Stop.
6. **Create item** in **Email Intake Log** with the extracted fields; **save attachments**
   to `/Jobs/<job>/Emails/<yyyymmdd>/`.
7. **Switch** on `email_category` → child flows (build in Bible order, highest value first):
   PO/Delivery (Flow 4) · Foreman + Vendor delivery alerts (7a/7b) · Bid Invite (Flow 2) ·
   Job Quote follow-up (Flow 3b) · Submittal + **Closeout** (Flow 5) · RFI (Flow 6).

The auto-email templates (PO request, foreman alert, vendor follow-up, closeout request)
are already written to your etiquette in `src/engine/email.ts` — paste them into the
"Send an email" actions and swap the `[brackets]` for the parsed fields.

## Step 4 — Closeout sub-flow (new)

On **Submittal Submission**: for each material, create **Closeout Docs** rows
(DocType = Cut Sheet/Install/O&M/Warranty/As-Built; Status = Requested for vendor docs,
Needed for as-built/warranty) and send the closeout-request email to the vendor.
On **Submittal Approval** (status Approved / Approved as Noted): **Move** that material's
files from the OneDrive staging folder to the SharePoint job closeout folder and set the
rows to **Filed**.

---

## Rollout (phased, fastest relief first)

1. **Week 1** — Lists provisioned; Flow 1 logging every email into Email Intake Log.
2. **Week 2** — PO/Delivery (Flow 4) + foreman/vendor delivery auto-emails. *(biggest daily relief)*
3. **Week 3** — Vendor quote follow-up auto-chaser + Submittal/Closeout tracking.
4. **Week 4** — Bid-invite decision flow + schedule-risk Teams alerts. Tune the 0.70
   confidence threshold and follow-up timers from one week of real mail.

## Open items I need from you (gaps)

- [ ] **Warranty letter templates** (UMI plumbing + any GC-specific) — to auto-generate.
- [ ] **PO request format** — confirm exact fields with Lisa Silveira/purchasing before automating.
- [ ] **Submittal channel** — BuildingConnected / Procore / email? Changes the submittal flow.
- [ ] **SharePoint site URL** + who has list/flow create rights.
- [ ] **AI Builder vs Claude API** — confirmed Hybrid → Claude API; need an `ANTHROPIC_API_KEY` + a host for the service.
- [ ] **OneDrive move** for the `PM Docs` staging folder (see folder table above).
- [ ] **HVAC parity** — plumbing-first today; HVAC closeout (TAB, start-up, controls) is a fast-follow when you want it.
