# Stripe setup for Buddy Billiards

The code creates prices on the fly, so you do **not** need to create Products
or Prices in the Stripe dashboard. The whole setup is: get two keys, register
one webhook, and paste three values into Vercel.

## 1. Create the Stripe account

1. Go to https://dashboard.stripe.com/register and sign up (use the same email
   you use for the business).
2. Business name: **Buddy Billiards** (or your LLC name — this is what shows on
   customers' card statements; you can customize the statement descriptor under
   Settings → Business → Public details).
3. You can start in **Test mode** immediately. To charge real cards you'll need
   to complete "Activate payments" (business details, bank account for payouts,
   EIN or SSN). Do that whenever — test mode works end to end without it.

## 2. Get your API keys

Dashboard → **Developers → API keys**:

- **Secret key** (`sk_test_...` in test mode, `sk_live_...` once activated).
  This is the only key the app needs — checkout runs entirely server-side.

## 3. Register the webhook

Dashboard → **Developers → Webhooks → Add endpoint**:

- Endpoint URL: `https://buddy-billiards.vercel.app/api/webhooks/stripe`
- Events to send (exactly these three):
  - `checkout.session.completed` — grants Premium / verified-venue on purchase
  - `customer.subscription.updated` — keeps the tier in sync (past-due, etc.)
  - `customer.subscription.deleted` — downgrades on cancellation
- After creating it, copy the **Signing secret** (`whsec_...`).

## 4. Add the env vars in Vercel

Vercel → buddy-billiards project → **Settings → Environment Variables**
(Production, and Preview if you want to test on PR deploys):

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` (later swap to `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 3 |

Redeploy after saving (Vercel → Deployments → ⋯ → Redeploy) so the functions
pick them up.

## 5. Test it

1. In test mode, hit **Upgrade with Stripe** on `/upgrade` while signed in.
2. Pay with card `4242 4242 4242 4242`, any future expiry, any CVC.
3. You should land back on `/upgrade?success=1`, and the webhook flips your
   profile row in Supabase to `tier: premium`.
4. Cancel the subscription from the Stripe dashboard (Customers → the test
   customer → Cancel subscription) and confirm the tier drops back to `free`.

## Going live

- Complete "Activate payments" in Stripe.
- Flip the dashboard out of test mode, create a **second webhook endpoint**
  with the same URL and events (live mode has its own signing secret).
- Replace both env vars in Vercel with the live values and redeploy.

## What the two products are

Both are created inline by the code — no dashboard setup:

| Plan | Price | Who buys it |
| --- | --- | --- |
| Buddy Billiards Premium | $4.99/mo | Players (60-mile detours, offline routes, unlimited AI photo reads) |
| Verified Venue Profile | $14.99/mo | Room owners (verified badge via the B2B dashboard) |

Prices live in `lib/tier.ts` (`PREMIUM_PRICE_USD`, `VERIFIED_VENUE_PRICE_USD`)
if you ever want to change them.

---

**Status: LIVE.** Account activated, live keys and webhook configured in Vercel
(August 2026). To rotate keys later: create new ones in the Stripe dashboard,
update the two Vercel env vars, redeploy.
