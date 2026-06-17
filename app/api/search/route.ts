import { NextResponse } from "next/server";
import { searchInventory, type SearchQuery } from "@/lib/inventory";
import { rankCars } from "@/lib/finance/fit";
import { refiProjection } from "@/lib/finance/refi";
import { buildPrivateSellerLinks } from "@/lib/privateLinks";
import type { Profile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let profile: Profile;
  try {
    ({ profile } = (await req.json()) as { profile: Profile });
    if (!profile?.zip) throw new Error("missing profile");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Show cars a bit above the lender cap too, so the user sees "needs more down".
  const ceiling = (profile.loanCap ?? 60000) + profile.downPayment + 6000;

  const query: SearchQuery = {
    zip: profile.zip,
    radiusMiles: profile.radiusMiles,
    maxPrice: ceiling,
    minYear: profile.minYear,
    maxMileage: profile.maxMileage,
    fuelTypes: profile.fuelTypes,
    bodyStyles: profile.bodyStyles,
    limit: 30,
  };

  const inv = await searchInventory(query);
  const results = rankCars(inv.cars, profile);

  // Use the best affordable car's financed amount for the refi projection,
  // falling back to the lender cap.
  const affordable = results.find((r) => r.canAfford);
  const financedForRefi = affordable?.amountFinanced ?? profile.loanCap ?? 13500;
  const refi = refiProjection(financedForRefi, profile);

  return NextResponse.json({
    results,
    refi,
    privateLinks: buildPrivateSellerLinks(profile),
    provider: { name: inv.providerName, live: inv.live, usedFallback: inv.usedFallback, error: inv.error },
  });
}
