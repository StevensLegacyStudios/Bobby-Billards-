import type { Profile } from "@/lib/profile";

export interface PrivateSellerLink {
  name: string;
  url: string;
  note: string;
}

// Map a few CA ZIP prefixes to their Craigslist region. Defaults to Sacramento.
function craigslistRegion(zip: string): string {
  const p = zip.slice(0, 3);
  if (["940", "941", "943", "944", "945", "946", "947", "948", "949"].includes(p)) return "sfbay";
  if (["950", "951"].includes(p)) return "sfbay";
  if (["952"].includes(p)) return "stockton";
  return "sacramento";
}

function queryText(profile: Profile): string {
  const fuel = profile.fuelTypes.includes("hybrid")
    ? "hybrid"
    : profile.fuelTypes.includes("electric")
      ? "electric"
      : "";
  return [fuel, "car"].filter(Boolean).join(" ").trim() || "car";
}

/**
 * Build deep links into private-seller marketplaces, pre-filtered to the user's
 * criteria. We link out (compliant) rather than scrape — these sites prohibit it.
 */
export function buildPrivateSellerLinks(profile: Profile): PrivateSellerLink[] {
  const q = queryText(profile);
  const maxPrice = Math.round((profile.loanCap ?? 0) + profile.downPayment) || 15000;
  const minYear = profile.minYear ?? 2012;
  const region = craigslistRegion(profile.zip);

  return [
    {
      name: "Facebook Marketplace",
      url: `https://www.facebook.com/marketplace/category/vehicles?query=${encodeURIComponent(
        q,
      )}&maxPrice=${maxPrice}&exact=false`,
      note: "Largest pool of private sellers. Requires a Facebook login.",
    },
    {
      name: "Craigslist",
      url: `https://${region}.craigslist.org/search/cta?query=${encodeURIComponent(
        q,
      )}&max_price=${maxPrice}&min_auto_year=${minYear}&purveyor=owner`,
      note: "Filtered to owner (private) listings near you.",
    },
    {
      name: "OfferUp",
      url: `https://offerup.com/search?q=${encodeURIComponent(q)}&price_max=${maxPrice}`,
      note: "Local private listings, mobile-friendly.",
    },
  ];
}
