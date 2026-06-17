# Money Man OS — Liquidity Maximizer (prototype)

A runnable proof of the one mechanic that makes Money Man OS different from
Rocket Money / Cleo / Monarch / Copilot / Simplifi: **tell me the exact day to
pay each bill so I keep the most cash on hand AND lift my credit score — without
ever tripping an overdraft or a late fee — on irregular, multi-stream income.**

No incumbent does this. Rocket Money's "safe-to-spend" can't even handle variable
income; everyone else tells you to time payments *manually*. This prototype does
it automatically.

## Run it

```bash
python3 run.py
```

Pure Python 3 standard library — nothing to install. It prints two reports to the
console and writes two HTML files you can open in a browser.

## What you'll see

**1. Intake demo** — answers "how does info get in?" Money Man "reads" the sample
documents in `sample_docs/` (a credit-card statement, a utility bill, a gig
payout, a phone bill), pulls out the fields it needs, and asks a targeted
follow-up *only* for what's missing (the phone bill has no due date, so it asks
just that one thing). No giant forms. In production this is OCR + an LLM; the
*flow* — extract → detect missing → ask only what's missing — is what ships.
The intended hierarchy, easiest first:
  1. **Bank/card linking** (auto, zero typing) — the eventual default.
  2. **Document upload** — snap/upload, Money Man reads it (this demo).
  3. **Conversational fallback** — asks for the few fields it still can't get.

**2. Liquidity Maximizer**, run on two weeks of the same user:

- **Good week** (`report_good.html`): cash is flowing, so the credit-timing move
  fires — it pays Apex Visa **$420 before its 6/28 statement close** to report
  **71% → 29%** utilization, and Summit **60% → 29%**, while *holding* the phone
  and rent until the last safe day and still keeping the $200 buffer + spare cash
  liquid. Status: SAFE.
- **Tight week** (`report_tight.html`): too broke to chase a score, and it says
  so — *"you need about $635 more by Fri 7/3"* — paying only minimums to protect
  payment history instead of draining the buffer. Honest, not reckless.

## How the engine decides (`liquidity_maximizer.py`)

- **Hold** no-credit-impact bills as late as safely possible (maximize float).
- **Pay credit cards before statement close** to report low utilization, but only
  with cash that keeps the safety buffer intact — and target the **30% line**
  first, chasing the under-10% sweet spot only when there's still a healthy cash
  cushion left (liquidity beats a marginal score point).
- **Treat income as events with a confidence.** Plan conservatively on confirmed
  ("safe") money; when there's a gap, surface the exact number to drive to
  ("earn $X by <day>").
- **Check every day with worst-case intraday ordering** (bills post before
  income) so an overdraft can't hide.
- **Set aside taxes** on 1099 / gig income automatically.

## Files

| File | What it is |
|------|-----------|
| `liquidity_maximizer.py` | The engine: model, optimizer, simulator, console + HTML reports |
| `intake.py` | Document extraction + "ask only what's missing" follow-ups |
| `scenario.py` | The wedge-user seed profile (good week / tight week) |
| `run.py` | Entry point — runs the intake demo + both scenarios |
| `sample_docs/` | Plain-text stand-ins for uploaded bills/statements/payouts |

## Deliberately out of scope

Real bank linking (Plaid/Argyle), real OCR, auth/security, persistence, the 3D
UI, and any actual money movement. This is the advisory brain on seed data — the
part that has to feel like magic first. It recommends; it never moves a dollar.
