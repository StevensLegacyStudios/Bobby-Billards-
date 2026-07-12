import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { DEMO_CAMPAIGNS } from "@/lib/demo-data";

export const runtime = "nodejs";

/**
 * CPC click transaction endpoint.
 *
 * Fired when an end consumer clicks a boosted ad card or routing instruction
 * for a verified venue. Charges the campaign using a second-price rule
 * (min(own bid, runner-up bid + 1¢)) and marks the campaign exhausted when
 * the daily budget is consumed. With Supabase configured the charge runs
 * atomically inside the record_ad_click Postgres function.
 */
export async function POST(req: NextRequest) {
  let body: { campaignId?: string; routeContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.campaignId) {
    return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("record_ad_click", {
      p_campaign_id: body.campaignId,
      p_route_context: body.routeContext ?? null,
    });
    if (error) {
      const notActive = error.message.includes("not active");
      return NextResponse.json(
        { error: notActive ? "campaign_not_active" : "charge_failed", message: error.message },
        { status: notActive ? 409 : 500 }
      );
    }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      clickId: row.click_id,
      chargedCents: row.charged_cents,
      clearingRule: "second_price_plus_one",
      campaignStatus: row.campaign_status,
    });
  }

  // Demo fallback: same clearing rule computed over the in-memory campaigns.
  const campaign = DEMO_CAMPAIGNS.find((c) => c.id === body.campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (campaign.status !== "active" || campaign.spent_today_cents >= campaign.daily_budget_cents) {
    return NextResponse.json(
      { error: "campaign_not_active", message: `Campaign is ${campaign.status}.` },
      { status: 409 }
    );
  }

  const secondBid = Math.max(
    0,
    ...DEMO_CAMPAIGNS.filter((c) => c.id !== campaign.id && c.status === "active").map(
      (c) => c.bid_cpc_cents
    )
  );
  const chargedCents = Math.min(campaign.bid_cpc_cents, secondBid + 1);
  const spent = campaign.spent_today_cents + chargedCents;

  return NextResponse.json({
    clickId: `demo-${Date.now().toString(36)}`,
    chargedCents,
    clearingRule: "second_price_plus_one",
    campaignStatus: spent >= campaign.daily_budget_cents ? "budget_exhausted" : "active",
    demo: true,
  });
}
