import { NextResponse } from "next/server";
import { searchInventory, type SearchQuery } from "@/lib/inventory";
import { rankCars } from "@/lib/finance/fit";
import { refiProjection } from "@/lib/finance/refi";
import { buildPrivateSellerLinks } from "@/lib/privateLinks";
import {
  DCAP_DEALERS,
  DCAP_DEFAULT_MAX_PRICE,
  DCAP_GRANT_EV,
  DCAP_GRANT_PHEV,
  DCAP_MAX_AGE_YEARS,
  DCAP_MAX_MILEAGE,
  dcapInfo,
} from "@/lib/dcap";
import type { Profile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchBody {
  profile: Profile;
  /** When true, restrict to DCAP-eligible EV/PHEVs and attach grant math. */
  dcap?: boolean;
  /** Optional price ceiling for DCAP mode (defaults to a low target). */
  dcapMaxPrice?: number;
}

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
    if (!body?.profile?.zip) throw new Error("missing profile");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { profile, dcap } = body;

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

  // DCAP mode: force the program's eligibility rules onto the query.
  if (dcap) {
    const minYear = new Date().getFullYear() - DCAP_MAX_AGE_YEARS;
    query.fuelTypes = ["phev", "electric"];
    query.bodyStyles = undefined; // don't over-constrain the narrow EV/PHEV pool
    query.minYear = Math.max(query.minYear ?? 0, minYear);
    query.maxMileage = Math.min(query.maxMileage ?? Infinity, DCAP_MAX_MILEAGE);
    query.maxPrice = body.dcapMaxPrice ?? DCAP_DEFAULT_MAX_PRICE;
  }

  const inv = await searchInventory(query);
  const ranked = rankCars(inv.cars, profile);
  const results = ranked.map((r) => (dcap ? { ...r, dcap: dcapInfo(r.car) } : r));

  const affordable = ranked.find((r) => r.canAfford);
  const financedForRefi = affordable?.amountFinanced ?? profile.loanCap ?? 13500;
  const refi = refiProjection(financedForRefi, profile);

  return NextResponse.json({
    results,
    refi,
    privateLinks: buildPrivateSellerLinks(profile),
    provider: { name: inv.providerName, live: inv.live, usedFallback: inv.usedFallback, error: inv.error },
    dcap: dcap
      ? {
          grantEV: DCAP_GRANT_EV,
          grantPHEV: DCAP_GRANT_PHEV,
          maxPrice: body.dcapMaxPrice ?? DCAP_DEFAULT_MAX_PRICE,
          maxMileage: DCAP_MAX_MILEAGE,
          maxAgeYears: DCAP_MAX_AGE_YEARS,
          dealers: DCAP_DEALERS,
        }
      : null,
  });
}
