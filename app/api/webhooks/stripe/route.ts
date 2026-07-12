import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Stripe Billing webhook.
 *
 * Monitors subscription provisioning and cancellation for both B2C Premium
 * ($4.99/mo) and B2B Verified Venue ($14.99/mo) products, and mirrors the
 * resulting entitlements into Supabase.
 */
export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await req.text();

  let event: Stripe.Event;
  if (secretKey && webhookSecret) {
    const stripe = new Stripe(secretKey);
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      return NextResponse.json(
        { error: "signature_verification_failed", message: err instanceof Error ? err.message : "unknown" },
        { status: 400 }
      );
    }
  } else {
    // Unconfigured/dev environments accept unsigned test payloads so the
    // provisioning flow can be exercised end-to-end without Stripe keys.
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
    if (!event?.type) {
      return NextResponse.json({ error: "invalid_event" }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan ?? "premium";
      if (supabase) {
        if (plan === "verified_venue" && session.metadata?.venue_id) {
          await supabase
            .from("venues")
            .update({ is_verified: true })
            .eq("id", session.metadata.venue_id);
        } else if (session.metadata?.user_id) {
          await supabase.from("profiles").upsert({
            id: session.metadata.user_id,
            email: session.customer_details?.email ?? null,
            tier: "premium",
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id:
              typeof session.subscription === "string" ? session.subscription : null,
            subscription_status: "active",
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const active = subscription.status === "active" || subscription.status === "trialing";
      if (supabase) {
        await supabase
          .from("profiles")
          .update({ tier: active ? "premium" : "free", subscription_status: subscription.status })
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (supabase) {
        await supabase
          .from("profiles")
          .update({ tier: "free", subscription_status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);
        // Cancellation of a verified-venue subscription revokes the badge.
        if (subscription.metadata?.plan === "verified_venue" && subscription.metadata?.venue_id) {
          await supabase
            .from("venues")
            .update({ is_verified: false })
            .eq("id", subscription.metadata.venue_id);
        }
      }
      break;
    }

    default:
      // Acknowledge unhandled event types so Stripe stops retrying them.
      break;
  }

  return NextResponse.json({ received: true, type: event.type });
}
