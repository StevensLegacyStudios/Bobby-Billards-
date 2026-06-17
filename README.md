# CarMan AI 🚗

A personal AI car finder. Tell it your real situation — budget, down payment,
credit, commute, what you need — and it surfaces **real cars you can actually
get**, ranked by fit, with the subprime financing math (payment, required down,
total cost, refinance plan) done for you.

It was built for people with thin or damaged credit, where the hard part isn't
*finding* a car — it's getting one you can be approved for without getting
gouged.

## What it does

- **Searches real dealer inventory** (via the [Auto.dev](https://auto.dev) API)
  and links you straight to each listing. Falls back to bundled sample data so
  it runs with no API key.
- **Does the money math per car**: estimated monthly payment *at your credit-tier
  APR*, the down payment a lender will actually require (respecting a loan cap),
  total cost over the term, and monthly fuel cost for your commute.
- **Ranks by fit**: affordability + reliability + MPG + mileage/age.
- **Plans your refinance**: shows how much you'd save by refinancing in ~12
  months once on-time payments lift your score, plus a credit-repair checklist.
- **Covers private sellers compliantly**: generates pre-filtered deep links into
  Facebook Marketplace, Craigslist, and OfferUp (these sites have no data feed
  and prohibit scraping, so CarMan links out rather than scraping).
- **AI advisor chat** (Anthropic Claude) that knows your numbers and answers
  buying/financing questions bluntly. Falls back to templated advice with no key.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — runs on sample data without keys
npm run dev                  # http://localhost:3000
```

It works immediately on sample data. To go live, add keys to `.env.local`:

| Variable | What it unlocks | Where |
|---|---|---|
| `AUTODEV_API_KEY` | Real nationwide dealer listings (free: 1k calls/mo) | https://auto.dev |
| `ANTHROPIC_API_KEY` | Live AI advisor answers | https://console.anthropic.com |

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm run test    # unit tests for the finance engine
npm run lint    # eslint
```

## How it's built

- **Next.js (App Router) + TypeScript + Tailwind**, deployable on Vercel.
- `lib/finance/` — the "CarMan brain": APR tables, amortization, loan-cap logic,
  fuel cost, reliability scoring, fit ranking, refinance projection. Pure and
  unit-tested.
- `lib/inventory/` — a provider interface with an Auto.dev adapter and a mock
  provider, selected by env. Marketcheck-ready.
- `app/api/` — `search`, `advisor`, and `private-links` route handlers.
- `components/` — the UI.

## Privacy

CarMan stores your profile in your browser (localStorage) only. No street
address, SSN, or other identifying info is collected or committed to the repo.

## Disclaimer

CarMan AI gives estimates, not financial advice. Rates and inventory are
illustrative until live API keys are configured. Always verify terms with the
lender and inspect any used car before buying.
