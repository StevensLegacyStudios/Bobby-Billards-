import type { FuelType } from "@/lib/profile";
import type { Car, InventoryProvider, SearchQuery } from "./types";

// Auto.dev Vehicle Listings API adapter.
// Docs: https://docs.auto.dev/v2/products/vehicle-listings  (free tier: 1k calls/mo)
// Field names are mapped defensively because the live payload can vary slightly;
// anything missing degrades gracefully rather than crashing, and the provider
// selector falls back to sample data if the call fails.

const BASE = process.env.AUTODEV_API_BASE || "https://api.auto.dev/listings";

function pick<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeFuel(v: unknown): FuelType | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase();
  if (s.includes("plug")) return "phev";
  if (s.includes("electric") || s === "ev") return "electric";
  if (s.includes("hybrid")) return "hybrid";
  if (s.includes("gas") || s.includes("petrol") || s.includes("flex")) return "gas";
  return undefined;
}

function mapRecord(r: Record<string, unknown>, i: number): Car | null {
  const year = toNumber(pick(r, ["year", "modelYear"]));
  const make = pick<string>(r, ["make", "makeName"]);
  const model = pick<string>(r, ["model", "modelName"]);
  const price = toNumber(pick(r, ["price", "priceUnformatted", "listPrice", "salePrice"]));
  if (!year || !make || !model || !price) return null;

  const listingUrl =
    pick<string>(r, ["clickoffUrl", "vdpUrl", "clickURL", "detailUrl", "url", "link"]) ||
    `https://www.google.com/search?q=${encodeURIComponent(`${year} ${make} ${model} for sale`)}`;

  return {
    id: pick<string>(r, ["id", "vin", "listingId"]) || `autodev-${i}`,
    vin: pick<string>(r, ["vin"]),
    year,
    make,
    model,
    trim: pick<string>(r, ["trim", "trimName"]),
    price,
    mileage: toNumber(pick(r, ["mileage", "mileageUnformatted", "miles", "odometer"])) ?? 0,
    mpg: toNumber(pick(r, ["mpg", "combinedMpg", "mpgCombined"])),
    fuelType: normalizeFuel(pick(r, ["fuelType", "fuel", "fuelTypePrimary"])),
    dealerName: pick<string>(r, ["dealerName", "dealer", "sellerName"]),
    city: pick<string>(r, ["city", "dealerCity"]),
    state: pick<string>(r, ["state", "dealerState"]),
    distanceMiles: toNumber(pick(r, ["distance", "distanceMiles", "dist"])),
    photoUrl: pick<string>(r, ["primaryPhotoUrl", "photoUrl", "thumbnail", "image"]),
    listingUrl,
    source: "Auto.dev",
  };
}

export class AutoDevProvider implements InventoryProvider {
  readonly name = "Auto.dev";
  constructor(private apiKey: string) {}

  async search(query: SearchQuery): Promise<Car[]> {
    const params = new URLSearchParams();
    params.set("apikey", this.apiKey);
    if (query.zip) params.set("zip", query.zip);
    if (query.radiusMiles) params.set("radius", String(query.radiusMiles));
    if (query.maxPrice) params.set("price_max", String(Math.round(query.maxPrice)));
    if (query.minYear) params.set("year_min", String(query.minYear));
    if (query.maxMileage) params.set("mileage_max", String(query.maxMileage));
    if (query.makes?.length) params.set("make", query.makes[0]);
    if (query.models?.length) params.set("model", query.models[0]);
    params.set("limit", String(query.limit ?? 25));

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
      // Inventory is fresh-ish; cache briefly to stay under the free tier.
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Auto.dev responded ${res.status}`);

    const data = (await res.json()) as Record<string, unknown>;
    const records =
      (pick<Record<string, unknown>[]>(data, ["records", "listings", "data", "results", "hits"]) as
        | Record<string, unknown>[]
        | undefined) ?? [];

    const cars = records
      .map((r, i) => mapRecord(r, i))
      .filter((c): c is Car => c !== null);

    // Apply client-side filters the API may not support precisely.
    return cars.filter((c) => {
      if (query.fuelTypes?.length && c.fuelType && !query.fuelTypes.includes(c.fuelType)) return false;
      if (query.minMpg && c.mpg != null && c.mpg < query.minMpg) return false;
      return true;
    });
  }
}
