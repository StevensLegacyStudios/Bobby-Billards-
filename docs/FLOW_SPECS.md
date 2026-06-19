# Power Automate flow specs (ready to build)

Concrete, build-it-now specs for the first two flows. They assume:

- **Team site:** `https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam`
  *(your existing team site — confirmed in use. Lists and flows below live here.)*
- **Extraction service** deployed and reachable over HTTPS at `https://<your-host>` with
  `ANTHROPIC_API_KEY` and `UMI_EXTRACT_TOKEN` set as secrets (see `docs/DEPLOY.md`).

---

## SharePoint lists to create first

### List: `Emails` (the log every inbound email lands in)
| Column | Type |
| --- | --- |
| Title | Single line (use the email subject) |
| Category | Choice (the 10 categories from extraction) |
| Job / Job Number / Location | Single line ×3 |
| GC or Customer / Vendor | Single line ×2 |
| Contact Name / Email / Phone | Single line ×3 |
| Amount / PO / Order # | Single line ×3 |
| Delivery Date / Bid Due / Job Walk | Date ×3 |
| Urgency | Choice (High/Normal/Low) |
| Confidence | Number |
| Needs Review | Yes/No |
| Summary | Multi-line |
| From / Received | Single line / Date |

### List: `OpenItems` (what the auto-chaser watches)
| Column | Type |
| --- | --- |
| Title | Single line (the ask) |
| Kind | Choice: quote_request, po_confirmation, submittal, closeout_docs |
| Job / Job Number / Vendor | Single line ×3 |
| Contact Name / Email | Single line ×2 |
| Thread Subject | Single line |
| Sent At / Last Nudge At / Due Date | Date ×3 |
| Nudge Count | Number |
| Urgency | Choice (High/Normal/Low) |
| Status | Choice: open, nudged, escalated, closed |

---

## Flow 1 — Classify & log inbound mail

**Trigger:** Office 365 Outlook → *When a new email arrives (V3)*, Inbox, include attachments.

1. **HTTP** → `POST https://<your-host>/extract`
   - Header `x-umi-token: @{<UMI_EXTRACT_TOKEN secret>}`
   - Body:
     ```json
     {
       "subject": "@{triggerOutputs()?['body/subject']}",
       "from_name": "@{triggerOutputs()?['body/from/emailAddress/name']}",
       "from_email": "@{triggerOutputs()?['body/from/emailAddress/address']}",
       "date": "@{triggerOutputs()?['body/receivedDateTime']}",
       "body": "@{triggerOutputs()?['body/body']}"
     }
     ```
2. **Parse JSON** → use the schema from the `/extract` response (the `ExtractionSchema` fields).
3. **Create item** in `Emails` from the parsed fields.
4. **Condition on `confidence`** (see `docs/AUTOMATION_AND_LEARNING.md`):
   - `>= 0.90` → continue to routing (step 5).
   - `0.70–0.89` → continue, but set **Needs Review = Yes**.
   - `< 0.70` → post a "verify this email" **Teams** adaptive card to you; stop.
5. **Switch on `email_category`** → route:
   - `Foreman Alert Needed` → Teams/SMS to the foreman with delivery details.
   - `Vendor Follow-Up Needed` → create/update an `OpenItems` row (kind from context).
   - `Bid Decision Needed` / `Quote Approval Needed` / `PO Request to Send` → Teams
     **confirm card** to you (Approve / Edit / Decline) — never auto-send.
   - `Submittal Action Needed` / `Closeout Doc to File` → file to the job folder + task.
   - `No Action` → done.

**Confirm-card "Edit/Decline" → learning:** when you correct the category on a card, the
flow calls `POST /feedback { subjectHint, wrong, right }` so it learns (see below).

---

## Flow 2 — Vendor follow-up auto-chaser (the manual-chasing killer)

**Trigger:** Recurrence → every weekday at 8:00 AM.

1. **Get items** from `OpenItems` where `Status` is `open` or `nudged`.
2. **HTTP** → `POST https://<your-host>/followup`
   - Body: `{ "items": [ <each row mapped to the OpenItem shape> ] }`
3. **Parse JSON** → `decisions[]`, each `{ item, action, reason, draft?, nextCheck? }`.
4. **Apply to each decision:**
   - `action == "send"` → **send the `draft`** via Outlook (reply on the thread),
     increment `Nudge Count`, set `Last Nudge At = now`, `Status = nudged`.
   - `action == "escalate"` → Teams **confirm card** to you ("Ferguson hasn't responded
     after 3 nudges on Perplexity floor drains — call them / pick a backup vendor?"),
     set `Status = escalated`.
   - `action == "wait"` → do nothing (optionally store `nextCheck`).
5. When a vendor reply arrives (Flow 1 sees it), set the matching `OpenItems` row
   `Status = closed`.

Cadence is baked into the service (`src/microsoft/followup.ts`): quote requests nudge at
+2 business days then every +2 (max 3), POs at +1 then +2, submittals/closeout slower.
High urgency or a near deadline tightens it by a day. After max nudges it escalates to you
instead of nagging.

---

## The `/feedback` learning call (used by both flows)

Whenever you correct a category or confirm a job alias on a Teams card:

```
POST https://<your-host>/feedback
{ "subjectHint": "RE: floor drains", "wrong": "RFI Field Coordination", "right": "Change Order",
  "job": "Perplexity", "aliases": ["181 Fremont","PPLX"], "jobNumber": "11836-15" }
```

The next `/extract` call automatically includes what it learned. That's the "always
getting better" loop — no retraining, just your accumulated corrections carried forward.
