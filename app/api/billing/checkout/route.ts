import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { PREMIUM_PRICE_USD, TIER_COOKIE, VERIFIED_VENUE_PRICE_USD } from "@/lib/tier";

export const runtime = "nodejs";

const PLANS = {
  premium: {
    name: "Buddy Billiards Premium",
    amountCents: Math.round(PREMIUM_PRICE_USD * 100),
  },
  verified_venue: {
    name: "Verified Venue Profile",
    amountCents: Math.round(VERIFIED_VENUE_PRICE_USD * 100),
  },
} as const;

/**
 * Creates a Stripe Checkout session for the requested plan. Without Stripe
 * keys configured it falls back to a demo grant so tier gating can be
 * exercised locally: the tier cookie is set directly.
 */
export async function POST(req: NextRequest) {
  let body: { plan?: keyof typeof PLANS; venueId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = body.plan && PLANS[body.plan] ? body.plan : "premium";
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const origin = req.nextUrl.origin;

  if (secretKey) {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: PLANS[plan].amountCents,
            product_data: { name: PLANS[plan].name },
          },
          quantity: 1,
        },
      ],
      metadata: { plan, ...(body.venueId ? { venue_id: body.venueId } : {}) },
      success_url: `${origin}/upgrade?success=1`,
      cancel_url: `${origin}/upgrade?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  }

  // Demo mode: grant the entitlement directly via cookie.
  const response = NextResponse.json({
    url: plan === "premium" ? "/upgrade?success=demo" : "/b2b/dashboard?verified=demo",
    demo: true,
  });
  if (plan === "premium") {
    response.cookies.set(TIER_COOKIE, "premium", { path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}
