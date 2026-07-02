# Automation & learning model — "I just manage and confirm"

Your directive: smart, always learning, automated as much as possible, with you only
managing and confirming. This is the operating model that delivers that.

## Who does what

| The system does automatically | You confirm / decide |
| --- | --- |
| Read & classify every inbound email; log it to SharePoint with extracted fields | Bid / No-Bid decisions |
| Save attachments to the job's `Emails/` folder | Sending the proposal / final price to the GC |
| Create calendar events (bid due, job walk, delivery, submittal review) | Change-order pricing before it goes to the GC |
| Send foreman delivery alerts + vendor delivery confirmations (day before) | Anything involving money, contract, or scope commitment |
| Chase vendors who didn't reply (auto follow-up on a timer) | Anything the system flags as low-confidence |
| Track submittal lead times; flag schedule risk (Green/Yellow/Red) | Approving a quote before the PO request goes out |
| Request closeout docs with the submittal; file them on approval | — |

Everything in the right column lands in a **Confirm queue** (a Teams card or a SharePoint
view) where you tap Approve / Edit / Decline. Nothing money- or commitment-related leaves
without your tap.

## Confidence tiers (how "automatic" each email is)

The extraction returns a `confidence` 0.00–1.00. The flow acts on it:

| Confidence | Behavior |
| --- | --- |
| **≥ 0.90** | Auto-process: log, route, fire the automatic actions above. |
| **0.70 – 0.89** | Auto-process **but** drop a note in the Confirm queue so you can glance and correct. |
| **< 0.70** | Don't guess — send you a "verify this email" card. Your answer trains it (below). |

Start at 0.70; after a week of real mail, raise to 0.80 if you see false positives or lower
to 0.65 if it asks too often. (Bible edge case #7.)

## How it learns (gets better every week)

Every correction or confirmation you make is captured and fed back into the next
extraction — so it stops repeating mistakes and learns *your* jobs and vendors:

- **Job aliases** — when you confirm "this email is the Perplexity job," the alias
  ("181 Fremont", "PPLX", "10th & 11th") is remembered. Future emails match instantly.
- **Category corrections** — when you fix a miscategorized email (e.g. "this is a Change
  Order, not an RFI"), that example is injected into the prompt as a "don't repeat this"
  note.
- **Contacts** — new vendor/GC contacts seen in real mail are remembered and used to
  auto-address outgoing email.

Mechanically: your correction (from a Teams card) is written as a row in the **AgentMemory**
SharePoint list — aliases as "Job Alias" rows, fixes as "Correction" rows, standing
preferences as "House Rule" rows. Flow 1 reads every Active row and injects them into the
prompt on each call, so the very next email benefits. No retraining, no ML pipeline, no
server to keep alive — the memory lives in SharePoint where you can see and edit it. (Flow 5
in `FLOW_SPECS.md` does the writing; retire a stale lesson by flipping its Active flag off.)

## What this looks like day-to-day

You open Teams in the morning to a short Confirm queue: 3 cards — approve a PO request,
confirm a bid is worth pursuing, fix one miscategorized email. Tap, tap, tap. Everything
else — the 40 emails that got logged, the two deliveries that got foreman alerts, the
vendor who got chased for a quote, the closeout docs that got requested — already happened.
