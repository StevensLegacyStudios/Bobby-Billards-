# Money Man OS — Liquidity Maximizer

The financial brain for people with messy, multi-stream income: it forecasts your
real (irregular) cashflow, tells you the **exact day** to pay each bill to keep
the most cash on hand AND lift your credit score — without ever tripping an
overdraft or a late fee — and keeps gig / business / personal money straight for
tax time.

## Use it

**`index.html`** is the live app — open it in any browser (or the deployed URL).
Edit your own checking balance, income, bills, and credit cards; the plan
recomputes live. Your data stays in your browser (localStorage); nothing is sent
anywhere, and it never moves a dollar — it only recommends.

- `engine.js` — the Liquidity Maximizer engine (also runs in Node, fully tested).
- `index.html` — the interactive cockpit UI (edit inputs, see the plan + chart).
- Try **Example: good week** to see the credit-timing move fire, and **Example:
  tight week** to see it honestly refuse to drain your buffer for a score.

## How the engine decides

- **Hold** no-credit-impact bills as late as safely possible (maximize cash on hand).
- **Pay credit cards before statement close** to report low utilization — but only
  with cash that keeps your safety buffer intact, targeting the 30% line first.
- **Treat income as confidence-weighted events**; plan on confirmed money and
  surface the exact number to earn ("you need $X by <day>") when there's a gap.
- **Check every day worst-case** (bills post before income) so an overdraft can't hide.
- **Set aside taxes** on 1099 / gig income automatically.

## Reference prototype

`money-man-os-prototype/` holds the original Python version (console + static
HTML reports) that proved the engine — run it with `python3 run.py`. The
JavaScript engine in `engine.js` is a verified line-for-line port.

## Not yet wired (deliberately)

Bank/card linking (Plaid/Argyle), real OCR document import, accounts/auth, and
any money movement. This is the advisory brain on data you enter yourself — the
part that has to feel like magic first.
