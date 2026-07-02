# Power Automate Flow Specs (v2 — the direct-to-Claude build)

This is the build sheet for all six flows. No servers, no hosting, no code. Every flow runs
in Power Automate as you (Shawn), talks to SharePoint, Outlook, and Teams with standard
connectors, and calls the Claude API directly with the **HTTP** action.

Before you build anything here, finish steps 1–4 of `docs/SETUP.md` (license, API key,
the 10 SharePoint lists, seed data). Build order is also in SETUP: **Flow 1 + Flow 5
first**, test on 5 real emails, then **Flows 3, 2, 4, 6**.

Full prompt text and JSON schemas live in `docs/PROMPTS.md`. This doc shows the triage
schema once in full (Flow 1 is the reference implementation) and points to PROMPTS.md for
the rest.

---

## Names used everywhere in this doc

| Thing | Exact name |
| --- | --- |
| Team site | `https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam` |
| Document library | `Shared Documents` (shows as "Documents" in the browser) |
| SharePoint lists | `Jobs`, `Email Intake Log`, `Bids`, `Purchase Orders`, `Submittals`, `Change Orders`, `Quotes In Progress`, `Closeout Docs`, `OpenItems`, `AgentMemory` |
| Microsoft To Do list | `UMI Action Items` |
| Job folder pattern | `Shared Documents/Jobs/<Job Name> (<Job#>)/` — e.g. `Jobs/Perplexity 181 Fremont (11836-15)/` |

## The six flows

| # | Name | Trigger | Model | max_tokens |
| --- | --- | --- | --- | --- |
| Flow 1 | Email Intake & Triage | Office 365 Outlook — "When a new email arrives (V3)", Inbox, Include Attachments = Yes | `claude-sonnet-5` | 1500 |
| Flow 2 | Bid Capture & Proposal Draft | SharePoint — "When an item is created" on `Bids` | `claude-opus-4-8` | 4000 |
| Flow 3 | Daily Follow-Up Chaser | Recurrence — weekdays 8:00 AM Pacific | `claude-sonnet-5` | 1200 |
| Flow 4 | Submittal & Closeout Filing | SharePoint — "When an item is created or modified" on `Submittals` | (no Claude call) | — |
| Flow 5 | Learning & Corrections | Teams — card responses from Flows 1–3 | (no Claude call) | — |
| Flow 6 | Daily Briefing | Recurrence — weekdays 7:30 AM Pacific | `claude-sonnet-5` | 2000 |

Why these models: **Sonnet 5** is the workhorse — near-Opus quality, reads PDFs natively,
cheap. **Opus 4.8** is reserved for the hardest reads (bid packages, long messy PDFs) and
customer-facing proposal drafts. Never use Fable 5 in this pipeline — its API restrictions
make it wrong for it.

Action budget: at 150–200 emails/day these six flows use roughly 8% of your Power Automate
Premium allowance of 40,000 actions/day. You will not hit the ceiling.

---

## Settings for EVERY HTTP action (do this every time, no exceptions)

Every Claude call is the same **HTTP** action (a Premium action — covered by your Power
Automate Premium license). Each time you add one:

1. **+ New step → search "HTTP" → HTTP** (the plain one, publisher Microsoft).
2. **Method:** `POST`. **URI:** `https://api.anthropic.com/v1/messages`.
3. **Headers** — exactly these three:

   | Header | Value |
   | --- | --- |
   | `x-api-key` | your Anthropic API key (paste it; step 2 of SETUP created it) |
   | `anthropic-version` | `2023-06-01` (this exact string — it is an API version label, never update it to today's date) |
   | `content-type` | `application/json` |

4. **Secure the key.** Select the HTTP action → **Settings** → turn **Secure Inputs = On**
   and **Secure Outputs = On**. This hides the API key and the email contents from the
   flow's run history. Do this on every HTTP action in every flow.
5. **Retry policy.** Same Settings pane → **Retry Policy** → change Default to
   **Exponential**, **Count = 4**, **Interval = PT10S**. This quietly retries the rare
   overloaded-server (529) or rate-limit (429) response.
6. **The 120-second wall.** The HTTP action times out at 120 seconds and that limit cannot
   be raised. Keep `max_tokens` at the value in the flow table above, and for giant bid
   packages send one call per PDF (see Flow 2, step 5). If a call times out, the retry
   policy will try again — but the real fix is smaller requests.
7. Keep every dynamic token (the purple `@{...}` chips) **inside double quotes** in the
   body so the JSON stays valid.

If the HTTP action ever fails with a "blocked by policy" style error, that is an IT Power
Platform DLP setting — see the troubleshooting section of `docs/SETUP.md`.

---

## The canonical Claude request (shown once — Flow 1's triage call)

This is the one request shape used by every Claude call in this build. Flows 2, 3, and 6
change only the `model`, `max_tokens`, the system prompt text, the user message, and the
schema — everything else stays identical.

```json
{
  "model": "claude-sonnet-5",
  "max_tokens": 1500,
  "system": [
    {
      "type": "text",
      "text": "<PASTE THE FULL TRIAGE SYSTEM PROMPT FROM docs/PROMPTS.md — Triage section>\n\nLEARNED CONTEXT (from this PM's confirmations — trust it):\n@{outputs('Compose_learned_context')}",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "FROM: @{triggerOutputs()?['body/from']}\nSUBJECT: @{triggerOutputs()?['body/subject']}\nDATE: @{triggerOutputs()?['body/receivedDateTime']}\nATTACHMENTS: @{join(body('Select_attachment_names'), ', ')}\n\nBODY:\n@{body('Html_to_text')}"
    }
  ],
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "email_category": { "type": "string", "enum": ["Bid Invite", "Bid Pricing Request", "Vendor Quote Request", "PO Confirmation", "Delivery Update", "Submittal Submission", "Submittal Approval", "Closeout Docs", "Change Order", "RFI Field Coordination", "Acknowledgment", "General Other"] },
          "job_name": { "type": "string" },
          "job_number": { "type": "string" },
          "job_location": { "type": "string" },
          "gc_or_customer": { "type": "string" },
          "vendor": { "type": "string" },
          "vendor_contact_name": { "type": "string" },
          "vendor_contact_email": { "type": "string" },
          "vendor_contact_phone": { "type": "string" },
          "sender_role": { "type": "string", "enum": ["GC", "Vendor", "Internal", "Subcontractor", "Owner", "Architect", "Unknown"] },
          "po_number": { "type": "string" },
          "order_number": { "type": "string" },
          "item_description": { "type": "string" },
          "quantity": { "type": "string" },
          "amount": { "type": "string" },
          "delivery_date": { "type": "string" },
          "bid_due_date": { "type": "string" },
          "job_walk_date": { "type": "string" },
          "submittal_number": { "type": "string" },
          "submittal_status": { "type": "string" },
          "lead_times_raw": { "type": "string" },
          "delivery_location": { "type": "string" },
          "delivery_attn": { "type": "string" },
          "closeout_docs": { "type": "string" },
          "action_required": { "type": "boolean" },
          "action_type": { "type": "string", "enum": ["Bid Decision Needed", "Quote Approval Needed", "PO Request to Send", "Foreman Alert Needed", "Vendor Follow-Up Needed", "Submittal Action Needed", "Closeout Doc to File", "Field Response Needed", "No Action"] },
          "urgency": { "type": "string", "enum": ["High", "Normal", "Low"] },
          "summary": { "type": "string" },
          "confidence": { "type": "number" },
          "needs_review": { "type": "boolean" }
        },
        "required": ["email_category", "job_name", "job_number", "job_location", "gc_or_customer", "vendor", "vendor_contact_name", "vendor_contact_email", "vendor_contact_phone", "sender_role", "po_number", "order_number", "item_description", "quantity", "amount", "delivery_date", "bid_due_date", "job_walk_date", "submittal_number", "submittal_status", "lead_times_raw", "delivery_location", "delivery_attn", "closeout_docs", "action_required", "action_type", "urgency", "summary", "confidence", "needs_review"],
        "additionalProperties": false
      }
    }
  }
}
```

Notes that apply to every call:

- **Guaranteed JSON.** `output_config` uses structured outputs — the API physically cannot
  return anything but schema-valid JSON. No beta header needed. Schema rules: every object
  needs `"additionalProperties": false` and a full `required` list; enums are allowed; no
  min/max constraints.
- **Read the answer** with **Parse JSON** on `body('HTTP')?['content'][0]['text']`.
- **Prompt caching.** The `cache_control: {"type":"ephemeral"}` on the system block makes
  the API cache the big stable prompt. Cache writes cost 1.25×, cache reads cost ~0.1×, and
  cached tokens don't count against your rate limits. The cache lives 5 minutes and every
  email refreshes it, so on a normal day almost every call is a cheap cache read. The
  system block must be at least 1,024 tokens to cache on Sonnet 5 — the triage prompt in
  PROMPTS.md is comfortably over that. The block only changes when you add a lesson to
  `AgentMemory`, which is exactly when you want a fresh cache anyway.
- **PDFs.** To show Claude a PDF, prepend a document block before the text in the user
  content array (Flow 2 does this):
  `{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"<base64 contentBytes>"}}`.
  Limits: 32 MB total request, 600 pages. Keep each PDF ≤ ~15 MB.

---

## Flow 1 — Email Intake & Triage (the backbone)

Reads every inbound email, extracts the facts, logs it, files attachments, and routes the
action. Build this first.

**Create it:** make.powerautomate.com → **+ Create → Automated cloud flow** → name it
`Flow 1 - Email Intake & Triage` → search trigger **"When a new email arrives (V3)"**
(Office 365 Outlook) → Create.

### Step 1 — Trigger

1. **Folder:** Inbox. **Include Attachments:** Yes. (Open "Show advanced options" to see it.)
2. Add trigger conditions so junk never starts a run: select the trigger → **Settings →
   Trigger conditions → + Add**, one per line:
   - `@not(startsWith(toLower(triggerOutputs()?['body/subject']), 'automatic reply'))`
     (skips auto-replies)
   - `@not(contains(toLower(string(triggerOutputs()?['body/attachments'])), '.ics'))`
     (skips calendar invites)
   - `@not(equals(toLower(triggerOutputs()?['body/from']), 'your-address@example.com'))`
     (skips mail from you — replace with your own work address, lowercase)

### Step 2 — Html to text

**+ New step → search "Html to text" → Html to text** (Content Conversion). Content =
the trigger's **Body** token. This strips the HTML so Claude reads clean text.

### Step 3 — Load the learned context (the memory read)

1. **Get items** (SharePoint). Site = the team site, List = `AgentMemory`.
   **Filter Query:** `Active eq 1`  **Top Count:** `200`.
2. **Select** (Data Operations), rename it `Select memory`. From =
   `body('Get_items')?['value']`. Switch Map to text mode (the small icon on the right)
   and enter: `concat(item()?['EntryType'], ': ', item()?['Content'])`.
3. **Compose**, rename it `Compose learned context`. Inputs (expression):
   `join(body('Select_memory'), decodeUriComponent('%0A'))`.

This turns every active lesson — job aliases like `"Perplexity" = "181 Fremont" = "PPLX"`,
past corrections, house rules — into a text block Claude sees on every single email. This
is the learning loop: Flow 5 writes lessons, Flow 1 reads them.

### Step 4 — Select attachment names

**Select** (Data Operations), rename it `Select attachment names`. From =
`triggerOutputs()?['body/attachments']`. Map (text mode): `item()?['name']`.

### Step 5 — HTTP (the Claude call)

Add the **HTTP** action exactly as in "Settings for EVERY HTTP action" above (Secure
Inputs/Outputs On, Exponential retry ×4 at PT10S). Body = the full canonical request shown
above: model `claude-sonnet-5`, `max_tokens` 1500, the Triage system prompt from
`docs/PROMPTS.md` plus the learned-context token, and the full triage schema.

### Step 6 — Parse JSON

**Parse JSON** (Data Operations). **Content:** `body('HTTP')?['content'][0]['text']`.
**Schema:** click "Use sample payload" and paste the sample triage output from
`docs/PROMPTS.md` (Triage section). Structured outputs guarantee this always parses.

### Step 7 — Create item in `Email Intake Log`

**Create item** (SharePoint), List = `Email Intake Log`. Map:

| Column | Value |
| --- | --- |
| Title | trigger **Subject** |
| SenderName | trigger **From name** (`triggerOutputs()?['body/from/emailAddress/name']` if the plain token isn't offered) |
| SenderEmail | trigger **From** |
| SenderCompany | expression: `if(equals(body('Parse_JSON')?['sender_role'], 'Vendor'), body('Parse_JSON')?['vendor'], body('Parse_JSON')?['gc_or_customer'])` |
| SenderRole | `sender_role` |
| ReceivedDate | trigger **Received Time** |
| Job | `job_name` |
| EmailCategory | `email_category` |
| AIConfidence | `confidence` |
| NeedsManualReview | `needs_review` |
| ActionRequired | `action_type` |
| ActionStatus | `New` |
| KeyDataExtracted | expression: `string(body('Parse_JSON'))` (the whole extraction, so nothing is lost — job_number, PO, amounts, lead times all live here) |
| AttachmentsSaved | fill in Step 8 (leave blank here; Step 8 updates it) |

### Step 8 — File the attachments (when the job matched)

1. **Condition:** `job_number` is not equal to blank.
2. If yes → **Get items** (SharePoint) on `Jobs`, rename `Get job row`. **Filter Query:**
   `JobNumber eq '@{body('Parse_JSON')?['job_number']}'`.
3. **Apply to each** over `triggerOutputs()?['body/attachments']` → **Create file**
   (SharePoint):
   - **Folder Path:**
     `/Shared Documents/Jobs/@{first(body('Get_job_row')?['value'])?['Title']} (@{body('Parse_JSON')?['job_number']})/Emails/@{formatDateTime(utcNow(), 'yyyyMMdd')}`
   - **File Name:** `items('Apply_to_each')?['name']`
   - **File Content** (expression): `base64ToBinary(items('Apply_to_each')?['contentBytes'])`
     — the trigger hands each attachment to you as base64 `contentBytes`; this turns it
     back into a real file.
4. **Update item** on the log row: AttachmentsSaved = the folder path from 3.

Example result: a Ferguson quote PDF on the Perplexity job lands in
`Shared Documents/Jobs/Perplexity 181 Fremont (11836-15)/Emails/20260702/`.

### Step 9 — Confidence gate

Two nested **Condition** actions on `confidence`:

1. **Condition:** expression `less(float(body('Parse_JSON')?['confidence']), 0.7)`.
   - **Yes (below 0.70):** **Post card in a chat or channel** (Teams) to yourself — a
     "Verify this email" card showing the summary and Claude's guesses, with choice inputs
     to pick the right category and job. Include hidden data in the card's Submit action:
     `cardType: "verify"`, the log row **ID**, the subject, and the guessed category. Then
     stop this branch (**Terminate**, status Succeeded). Flow 5 handles whatever you answer.
   - **No:** continue to condition 2.
2. **Condition:** expression `less(float(body('Parse_JSON')?['confidence']), 0.9)`.
   - **Yes (0.70–0.89):** **Update item** on the log row → NeedsManualReview = Yes. Continue.
   - **No (0.90 or higher):** continue as-is.

### Step 10 — Switch on `action_type` (all 9 branches)

**Switch** (Control). **On:** `body('Parse_JSON')?['action_type']`. Add a case for each of
the nine values:

1. **"Bid Decision Needed"**
   - **Create item** in `Bids`: Job = `job_name`, GC = `gc_or_customer`,
     BidInviteReceived = received time, JobWalkDate = `job_walk_date`, BidDueDate =
     `bid_due_date`, DecisionStatus = `Pending Approval`, Notes = the summary, the
     attachments folder path from Step 8, then a line `--- ORIGINAL EMAIL ---` followed by
     From, Subject, and the **Html to text** body. Flow 2 reads the path to find the bid
     PDFs and feeds the original email text to its extraction call. Creating this row
     automatically fires **Flow 2**.
   - **Create event (V4)** (Office 365 Outlook) twice — one for the job walk, one for the
     bid due date (skip either if the date is blank).
   - **Post card in a chat or channel** (Teams): the Bid / No-Bid card (hidden data:
     `cardType: "bid_decision"`, the Bids row ID). Flow 5 records your answer.
2. **"Quote Approval Needed"**
   - **HTTP** (second Claude call — same canonical shape, `claude-sonnet-5`, max_tokens
     1500, Secure I/O + retry as always) to draft the reply, using the **Reply Draft**
     section of `docs/PROMPTS.md` (Shawn's voice, `{to, subject, body}` output).
   - **Post card in a chat or channel**: Approve / Edit / Decline, with the draft shown and
     carried in the card's hidden data (`cardType: "approve_send"`, log row ID, draft to /
     subject / body). **Never auto-send** — money leaves this flow only through Flow 5
     after you tap Approve.
3. **"PO Request to Send"** — same two actions as branch 2 (draft + Approve/Edit/Decline
   card). Same rule: never auto-send money items.
4. **"Foreman Alert Needed"** — **Get items** on `Jobs` for the foreman's name/phone →
   **Post message in a chat or channel** (Teams) to the foreman with the delivery details
   (e.g. "Kohler K-30810 floor drains arriving Thursday, attn: your name, Fremont St
   loading dock"). If the foreman isn't on Teams, use your SMS option instead.
5. **"Vendor Follow-Up Needed"** — **Create item** in `OpenItems`: Title = the ask (e.g.
   "Quote for floor drains"), Kind per context (`Quote Request`, `PO Confirmation`,
   `Submittal`, or `Closeout Docs`), Job/JobNumber, Vendor, ContactName/ContactEmail,
   ThreadSubject = subject, SentAt = now, NudgeCount = 0, Urgency = `urgency`, Status =
   `Open`. Flow 3 takes it from here.
6. **"Submittal Action Needed"** — **Create item** (or **Update item** if the
   SubmittalNumber already exists — check with **Get items**, Filter Query
   `SubmittalNumber eq '@{body('Parse_JSON')?['submittal_number']}'`) in `Submittals`:
   Job, SubmittalNumber, VendorManufacturer = `vendor`, Description = `item_description`,
   Status = `submittal_status` when it matches a choice value. This fires **Flow 4**.
7. **"Closeout Doc to File"** — **Get items** on `Closeout Docs`, Filter Query
   `(Job eq '@{body('Parse_JSON')?['job_name']}') and (Status ne 'Filed')` → **Update item**
   on the matching rows → Status = `Received`, ReceivedDate = now. File the attachment to
   the job's Closeout folder with **Create file** (same `base64ToBinary(...contentBytes)`
   pattern as Step 8).
8. **"Field Response Needed"** — **HTTP** draft-reply call (same as branch 2 — the
   **Reply Draft** section of `docs/PROMPTS.md`) → **Post card in a chat or channel** to
   you with the summary and the drafted reply (`cardType: "approve_send"`). You approve,
   edit, or answer yourself.
9. **"No Action"** — nothing. The log row from Step 7 is the record.

### Step 11 — Close the loop on open items

A vendor reply should stop the chaser. After the Switch:

1. **Get items** on `OpenItems`, **Filter Query:**
   `(ContactEmail eq '@{triggerOutputs()?['body/from']}') and ((Status eq 'Open') or (Status eq 'Nudged') or (Status eq 'Escalated'))`.
2. **Apply to each** result → **Condition:** the email subject contains the item's
   ThreadSubject (expression: `contains(toLower(triggerOutputs()?['body/subject']), toLower(items('Apply_to_each')?['ThreadSubject']))`)
   → **Update item** → Status = `Closed`.

So when Ferguson finally sends the floor-drain quote, the matching `OpenItems` row closes
and Flow 3 stops nudging them automatically.

### Step 12 — Microsoft To Do task (the personal mirror)

**Condition:** `action_required` is equal to `true` → **Add a to-do (V3)** (Microsoft To
Do): To-do list = `UMI Action Items` (create this list once in the To Do app), Title =
`summary`, Due date = the extracted date that drives it (`bid_due_date` or
`delivery_date`; leave blank if none). This is your personal to-do mirror — `OpenItems`
remains the canonical tracker the agent works from.

---

## Flow 2 — Bid Capture & Proposal Draft

Fires when Flow 1 creates a `Bids` row. Reads the bid package PDFs with Opus, then drafts
your clarification questions, a proposal-skeleton email, and a bid checklist.

**Create it:** **+ Create → Automated cloud flow** → trigger **"When an item is created"**
(SharePoint) → Site = the team site, List = `Bids`.

1. **Get item** context comes free from the trigger (Job, GC, dates, Notes). Flow 1 put
   the attachments folder path in **Notes** — that is where the bid package PDFs are.
2. **Get files (properties only)** (SharePoint) on that folder.
3. **Filter array** (Data Operations): keep only files where
   `endsWith(toLower(item()?['{FilenameWithExtension}']), '.pdf')`.
4. **Initialize variable** `BidFacts`, type Array, value `[]`.
5. **Apply to each** PDF (this is the 120-second protection — the flow makes one Claude
   call **per PDF**; PROMPTS.md also shows how to stack several small PDFs into one call,
   but per-PDF is the shape this flow builds because it keeps every call safely under the
   timeout and the body template fixed):
   1. **Get file content** (SharePoint) for the current file.
   2. **HTTP** — canonical shape with these changes: `"model": "claude-opus-4-8"`,
      `"max_tokens": 4000`; system = the **Bid Extraction** prompt from `docs/PROMPTS.md`
      (with `cache_control` as always); user content is an **array** with the document
      block first, then the text — including the original bid-invite email that Flow 1
      stored in the row's **Notes**:

      ```json
      "content": [
        { "type": "document",
          "source": { "type": "base64", "media_type": "application/pdf",
                      "data": "@{base64(body('Get_file_content'))}" } },
        { "type": "text",
          "text": "JOB: @{triggerOutputs()?['body/Job']}\nGC: @{triggerOutputs()?['body/GC']}\n\nBID INVITE EMAIL AND CONTEXT (from the Bids row):\n@{triggerOutputs()?['body/Notes']}\n\nExtract the bid facts from the attached bid package PDF." }
      ]
      ```

      `output_config` = the bid-extraction schema from PROMPTS.md (scope summary,
      plumbing/HVAC scope lines, bid due date, job walk, RFIs-by date, bonding/insurance
      asks, addenda). Secure Inputs/Outputs On, Exponential retry ×4 PT10S — every time.
      Size rules: each PDF ≤ ~15 MB (base64 grows it ~33%; the whole request must stay
      under 32 MB and 600 pages).
   3. **Parse JSON** on `body('HTTP')?['content'][0]['text']` → **Append to array
      variable** `BidFacts`.
6. **HTTP** — second Claude call, `claude-opus-4-8`, `max_tokens` 4000. System = the
   **Proposal Draft** prompt from `docs/PROMPTS.md` (Shawn's voice: direct, professional,
   no fluff). User = `string(variables('BidFacts'))` plus the Bids row fields. Output
   schema (in PROMPTS.md): (a) clarification questions, (b) a proposal-skeleton email,
   (c) a bid to-do checklist.
7. **Parse JSON** on `body('HTTP_2')?['content'][0]['text']`.
8. **Update item** on the `Bids` row: JobWalkDate and BidDueDate if the PDFs had better
   dates than the email, Notes = scope summary + addenda + bonding/insurance asks.
9. **Apply to each** checklist entry → **Create item** in `OpenItems`: Kind = `Task`,
   Title = the checklist line, Job/JobNumber, DueDate = bid due date, Status = `Open`,
   NudgeCount = 0. Your bid to-dos now live where the chaser and the briefing can see them.
10. **Send an HTTP request** (Office 365 Outlook action — standard, not the premium HTTP):
    Method `POST`, URI `https://graph.microsoft.com/v1.0/me/messages`, Body =
    `{ "subject": "<proposal subject>", "body": { "contentType": "Text", "content": "<proposal body>" }, "toRecipients": [ { "emailAddress": { "address": "<GC contact>" } } ] }`
    with the drafted values. This creates a **DRAFT** in your Outlook Drafts folder. It is
    never sent by the flow — you review and send it yourself.
11. **Post card in a chat or channel** (Teams) to you: scope summary, the clarification
    questions, "draft proposal is in your Drafts folder", plus Bid/No-Bid buttons if Flow 1
    hasn't already asked (hidden data `cardType: "bid_decision"` → Flow 5).

---

## Flow 3 — Daily Follow-Up Chaser

Every weekday morning it looks at every open ask and decides, item by item: send a nudge,
wait, or escalate to you. This kills the manual chasing.

**Create it:** **+ Create → Scheduled cloud flow** → **Recurrence**: Frequency = Week,
Interval = 1, On these days = Monday–Friday, At these hours = 8, At these minutes = 0,
Time zone = **(UTC-08:00) Pacific Time (US & Canada)**.

1. **Get items** (SharePoint) on `OpenItems`. **Filter Query:**
   `(Status eq 'Open') or (Status eq 'Nudged')`.
2. **Apply to each** returned item — one Claude call per item:
   1. **HTTP** — canonical shape: `"model": "claude-sonnet-5"`, `"max_tokens": 1200`.
      System = the **Chaser** prompt from `docs/PROMPTS.md` (with `cache_control`). It
      embeds the cadence table:

      | Kind | First nudge | Then every | Max nudges |
      | --- | --- | --- | --- |
      | Quote Request | +2 business days | +2 | 3 |
      | PO Confirmation | +1 | +2 | 3 |
      | Submittal | +3 | +3 | 2 |
      | Closeout Docs | +3 | +4 | 3 |
      | Task | never emails anyone | — | — |

      `Task` rows are your internal to-dos (Flow 2's bid checklist lands here) — the
      chaser never drafts an email for them; it waits, and escalates to you on a Teams
      card once the DueDate has passed. High urgency, or a DueDate within 2 business
      days, tightens each vendor-facing wait by 1 day. Weekends are excluded. User message = today's date + the item as JSON (expression:
      `string(items('Apply_to_each'))`). Secure I/O On, Exponential retry ×4 PT10S.
   2. **Parse JSON** on `body('HTTP')?['content'][0]['text']`. Schema (full version in
      PROMPTS.md, Chaser section):
      `{ "action": "send" | "wait" | "escalate", "reason": "...", "draft": { "to": "...", "subject": "...", "body": "..." }, "next_check": "YYYY-MM-DD" }`
   3. **Switch** on `action`:
      - **send** → **Send an email (V2)** (Office 365 Outlook) using draft.to /
        draft.subject / draft.body. The subject is already `RE: <ThreadSubject>`, so it
        lands on the same thread. Then **Update item**: NudgeCount = expression
        `add(int(items('Apply_to_each')?['NudgeCount']), 1)`, LastNudgeAt = `utcNow()`,
        Status = `Nudged`. Tone escalates with the count — 1st: "Just following up",
        2nd: "Circling back", 3rd: "Third time checking in… I'll need to look at other
        options". The prompt handles the wording.
      - **escalate** → **Post card in a chat or channel** (Teams) to you: "Ferguson —
        3 nudges on the Perplexity (11836-15) floor-drain quote, no answer. Call them or
        switch vendor?" (hidden data `cardType: "escalation"`, the OpenItems row ID —
        Flow 5 records your answer). Then **Update item**: Status = `Escalated`.
      - **wait** → nothing (optionally stamp `next_check` into Notes).

Vendor replies are closed by **Flow 1, Step 11** — when the vendor answers, the row goes
to `Closed` and the chaser leaves them alone.

---

## Flow 4 — Submittal & Closeout Filing (no AI)

Pure plumbing — no Claude call. Two jobs: (a) when a submittal is logged, open the closeout
paper trail and ask the vendor for the docs; (b) when a submittal is approved, file
everything from staging into the job folder.

**Create it:** **+ Create → Automated cloud flow** → trigger **"When an item is created or
modified"** (SharePoint) → List = `Submittals`.

1. **Get changes for an item or a file (properties only)** (SharePoint): ID = trigger ID,
   Since = trigger token **Trigger Window Start Token**.
2. **Condition — is it brand new?** Expression:
   `startsWith(triggerOutputs()?['body/{VersionNumber}'], '1.')`
   **Yes (new submittal):**
   1. **Create item** in `Closeout Docs` five times — one row per doc type, Material =
      VendorManufacturer + Description (e.g. "Kohler K-30810 floor drains"), Job and
      SubmittalNumber from the trigger:

      | DocType | Status | Source |
      | --- | --- | --- |
      | Cut Sheet | Requested | Vendor |
      | Installation | Requested | Vendor |
      | O&M Manual | Requested | Vendor |
      | Warranty Letter | Requested | Vendor |
      | As-Built | Needed | Internal |

   2. **Send an email (V2)** to the vendor — the closeout-request template:
      > Subject: Closeout docs — <Job> — <Material>
      > Body: "Hi <name> — for our closeout binder on <Job>, please send the cut sheet,
      > installation instructions, O&M manual, and warranty letter for <Material>
      > (submittal <SubmittalNumber>). PDF is fine. Thanks — Shawn, United Mechanical."
3. **Condition — was it just approved?** From the Get changes output, **Has Column
   Changed: Status** is true, AND Status is `Approved` **or** `Approved as Noted`.
   **Yes:**
   1. **List files in folder** (OneDrive for Business) on the staging folder
      `PM Docs/All Closeout Docs/<material>/` (your synced staging area).
   2. **Apply to each** file: **Get file content** (OneDrive) → **Create file**
      (SharePoint) into
      `Shared Documents/Jobs/<Job Name> (<Job#>)/Closeout/<material>/` → **Delete file**
      (OneDrive). That is the move.
   3. **Get items** + **Update item** on `Closeout Docs`: matching rows → Status =
      `Filed`, FiledDate = `utcNow()`, JobPath = the destination folder.
   4. **Copy file** (SharePoint) for every O&M Manual, Warranty Letter, and As-Built into
      `Shared Documents/Jobs/<Job Name> (<Job#>)/Closeout/_Final Handover/` — the handover
      binder builds itself as the job runs.

`Closeout Docs.Status` moves through its full life: `Needed` → `Requested` → `Received`
(Flow 1, branch 7) → `Filed` (here), with `Waived` available for docs the GC agrees to skip.

---

## Flow 5 — Learning & Corrections (no AI)

Catches every button you press on a Teams card from Flows 1–3 and turns corrections into
memory. This is why the agent gets smarter every week without retraining anything.

**Create it:** **+ Create → Automated cloud flow** → trigger **"When someone responds to an
adaptive card"** (Microsoft Teams). This trigger catches responses to any card posted with
"Post card in a chat or channel" — which is why Flows 1–3 always post cards that way and
never wait.

1. **Parse JSON** on the trigger's response data. Every card in this build carries hidden
   data: `cardType`, the SharePoint row ID it is about, and (for approval cards) the draft.
2. **Switch** on `cardType`:
   - **"verify"** (Flow 1's low-confidence gate):
     1. **Condition:** did you pick a different category or job than Claude guessed?
     2. **Yes → Create item** in `AgentMemory`:
        - Title: a short label (e.g. "floor drains → Change Order")
        - EntryType: `Correction`
        - Content: `Subject "RE: floor drains" → Change Order, NOT RFI Field Coordination`
          (always this shape: `Subject "<hint>" → <right>, NOT <wrong>`)
        - Job / JobNumber: if the correction is job-specific
        - Active: Yes
        - Source: `Teams card correction 2026-07-02` (today's date)
     3. **Update item** on the `Email Intake Log` row: EmailCategory = your pick, Job =
        your pick, NeedsManualReview = No.
   - **"approve_send"** (money cards from Flow 1 branches 2, 3, 8):
     - **Approve** → **Send an email (V2)** with the draft carried in the card data. Then
       **Update item** on the log row: ActionStatus = `Complete`.
     - **Edit** → send your edited text instead, AND create an `AgentMemory` `Correction`
       row capturing what you changed — next time the draft starts closer to right.
     - **Decline** → **Update item**: ActionStatus = `No Action Needed`. If you typed a
       reason, save it as a `Correction`.
   - **"bid_decision"** → **Update item** on the `Bids` row: DecisionStatus =
     `Approved - Bidding` or `Declined - No Bid`.
   - **"escalation"** (Flow 3) → **Update item** on the `OpenItems` row: `Closed` if you
     handled it by phone, or leave `Escalated` and add your note to Notes.
3. **New job alias confirmed** (from a verify card where you matched an unknown name to a
   known job) → **Create item** in `AgentMemory`: EntryType = `Job Alias`, Job =
   `Perplexity 181 Fremont`, JobNumber = `11836-15`, Content =
   `"Perplexity" = "181 Fremont" = "PPLX"`, Active = Yes.

Because Flow 1 (Step 3) reads every Active `AgentMemory` item on every run, the very next
email already benefits from today's correction.

**Monthly hygiene:** once a month, open `AgentMemory`, skim the list, and flip **Active**
off on stale or superseded rows. Keep it under ~200 active items so the learned context
stays sharp and cheap.

---

## Flow 6 — Daily Briefing

One message every weekday at 7:30 AM Pacific: what needs you today, what the agent handled,
what's coming.

**Create it:** **+ Create → Scheduled cloud flow** → **Recurrence**: Week / Monday–Friday /
7:30 AM / Time zone **(UTC-08:00) Pacific Time (US & Canada)**.

1. Five **Get items** calls (SharePoint), renamed so the tokens stay readable:
   - `Get yesterday emails` — `Email Intake Log`, Filter Query:
     `ReceivedDate ge '@{formatDateTime(addDays(utcNow(), -1), 'yyyy-MM-dd')}'`
   - `Get open items` — `OpenItems`, Filter Query:
     `(Status eq 'Open') or (Status eq 'Escalated')`
   - `Get bids due` — `Bids`, Filter Query:
     `BidDueDate le '@{formatDateTime(addDays(utcNow(), 7), 'yyyy-MM-dd')}'`
   - `Get at-risk submittals` — `Submittals`, Filter Query:
     `(ScheduleRisk eq 'Yellow') or (ScheduleRisk eq 'Red')`
   - `Get outstanding closeout` — `Closeout Docs`, Filter Query:
     `(Status eq 'Needed') or (Status eq 'Requested')`
2. **HTTP** — canonical shape: `"model": "claude-sonnet-5"`, `"max_tokens": 2000`. System =
   the **Briefing** prompt from `docs/PROMPTS.md` (with `cache_control`). User message =
   today's date plus the five result sets, each dropped in with
   `string(body('Get_yesterday_emails')?['value'])` and so on. `output_config` = the
   three-key briefing schema from PROMPTS.md (`what_needs_you_today`, `what_i_handled`,
   `whats_coming`). Secure I/O On, Exponential retry ×4 PT10S, as always.
3. **Parse JSON** on `body('HTTP')?['content'][0]['text']` with that three-key schema.
4. **Post message in a chat or channel** (Teams) to yourself — or **Send an email (V2)**
   if you'd rather read it in Outlook — assembled from the three keys in this order:
   **What needs you today** / **What I handled** / **What's coming**.

---

## Quick reference — every Claude call in this build

| Flow | Call | Model | max_tokens | Output |
| --- | --- | --- | --- | --- |
| 1 | Triage | claude-sonnet-5 | 1500 | Triage JSON (schema above) |
| 1 | Reply drafts (branches 2, 3, 8) | claude-sonnet-5 | 1500 | Draft reply |
| 2 | Bid extraction (per PDF) | claude-opus-4-8 | 4000 | Bid facts JSON |
| 2 | Proposal draft | claude-opus-4-8 | 4000 | Questions + proposal + checklist |
| 3 | Chase decision (per item) | claude-sonnet-5 | 1200 | `{action, reason, draft, next_check}` |
| 6 | Briefing | claude-sonnet-5 | 2000 | `{what_needs_you_today, what_i_handled, whats_coming}` |

Same endpoint, same three headers, Secure Inputs/Outputs On, Exponential retry ×4 at
PT10S, and the 120-second ceiling — on every one of them.
