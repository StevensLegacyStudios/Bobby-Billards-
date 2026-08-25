import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
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
 *
 * The "Verified" badge is a trust signal players see — it must only ever go
 * to the account that actually owns the venue. `venueId`/`userId` in the
 * request body are NOT trusted for that: the caller's identity is resolved
 * server-side from their Supabase access token, and for verified_venue the
 * venue's `owner_id` must match before a checkout session is created.
 */
export async function POST(req: NextRequest) {
  let body: { plan?: keyof typeof PLANS; venueId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = body.plan && PLANS[body.plan] ? body.plan : "premium";
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const origin = req.nextUrl.origin;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const admin = getSupabaseAdminClient();

  let userId: string | null = null;
  let userEmail: string | null = body.email ?? null;
  if (token && admin) {
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? userEmail;
    }
  }

  if (plan === "verified_venue") {
    if (!userId || !admin) {
      return NextResponse.json(
        { error: "sign_in_required", message: "Sign in and select a venue you own before verifying." },
        { status: 401 }
      );
    }
    if (!body.venueId) {
      return NextResponse.json({ error: "missing_venue" }, { status: 400 });
    }
    const { data: venueRow } = await admin
      .from("venues")
      .select("owner_id")
      .eq("id", body.venueId)
      .maybeSingle();
    if (!venueRow || venueRow.owner_id !== userId) {
      return NextResponse.json(
        {
          error: "not_owner",
          message: "That venue isn't linked to your account yet — claim it from the dashboard first.",
        },
        { status: 403 }
      );
    }
  }

  if (secretKey) {
    const stripe = new Stripe(secretKey);
    // The webhook links the purchase back to the account via metadata, so it
    // must ride on both the session (checkout.session.completed) and the
    // subscription (customer.subscription.updated/deleted).
    const metadata = {
      plan,
      ...(userId ? { user_id: userId } : {}),
      ...(body.venueId ? { venue_id: body.venueId } : {}),
    };
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
      metadata,
      subscription_data: { metadata },
      ...(userEmail ? { customer_email: userEmail } : {}),
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
