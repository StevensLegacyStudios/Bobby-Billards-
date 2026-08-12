import type { FuelType } from "@/lib/profile";
import type { Car, InventoryProvider, SearchQuery } from "./types";

// Auto.dev Vehicle Listings API adapter.
// Docs: https://docs.auto.dev/v2/products/vehicle-listings
// - Auth is Bearer only (no apikey query param).
// - v2 uses dotted filter params (e.g. vehicle.make). To stay robust against the
//   exact spec (which we can't test blind), we send only safe params and apply
//   the rest of the filtering client-side. On any error the provider selector
//   falls back to sample data, so the app never breaks.

const BASE = process.env.AUTODEV_API_BASE || "https://api.auto.dev/listings";

/** Read the first present value across several possible (dot-notation) paths. */
function pathVal(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = obj;
    for (const seg of p.split(".")) {
      if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
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

function toStr(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function normalizeFuel(v: unknown): FuelType | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase();
  if (s.includes("plug")) return "phev";
  if (s.includes("electric") || s === "ev" || s === "bev") return "electric";
  if (s.includes("hybrid")) return "hybrid";
  if (s.includes("gas") || s.includes("petrol") || s.includes("flex")) return "gas";
  return undefined;
}

// Handles both flat listing objects and nested ones ({ vehicle: {...}, dealer: {...} }).
function mapRecord(r: Record<string, unknown>, i: number): Car | null {
  const year = toNumber(pathVal(r, ["year", "modelYear", "vehicle.year", "vehicle.modelYear"]));
  const make = toStr(pathVal(r, ["make", "makeName", "vehicle.make", "vehicle.makeName"]));
  const model = toStr(pathVal(r, ["model", "modelName", "vehicle.model", "vehicle.modelName"]));
  const price = toNumber(
    pathVal(r, ["price", "retailPrice", "listPrice", "salePrice", "priceUnformatted", "vehicle.price", "pricing.retail"]),
  );
  if (!year || !make || !model || !price) return null;

  const listingUrl =
    toStr(pathVal(r, ["clickoffUrl", "vdpUrl", "clickURL", "detailUrl", "url", "link", "links.self", "vehicle.vdpUrl"])) ||
    `https://www.google.com/search?q=${encodeURIComponent(`${year} ${make} ${model} for sale`)}`;

  return {
    id: toStr(pathVal(r, ["id", "vin", "listingId", "vehicle.vin"])) || `autodev-${i}`,
    vin: toStr(pathVal(r, ["vin", "vehicle.vin"])),
    year,
    make,
    model,
    trim: toStr(pathVal(r, ["trim", "trimName", "vehicle.trim"])),
    price,
    mileage: toNumber(pathVal(r, ["mileage", "miles", "odometer", "mileageUnformatted", "vehicle.mileage"])) ?? 0,
    mpg: toNumber(pathVal(r, ["mpg", "combinedMpg", "mpgCombined", "vehicle.combinedMpg"])),
    fuelType: normalizeFuel(pathVal(r, ["fuelType", "fuel", "fuelTypePrimary", "vehicle.fuelType", "vehicle.fuel"])),
    dealerName: toStr(pathVal(r, ["dealerName", "dealer", "sellerName", "dealer.name"])),
    city: toStr(pathVal(r, ["city", "dealerCity", "dealer.city"])),
    state: toStr(pathVal(r, ["state", "dealerState", "dealer.state"])),
    distanceMiles: toNumber(pathVal(r, ["distance", "distanceMiles", "dist"])),
    photoUrl: toStr(pathVal(r, ["primaryPhotoUrl", "photoUrl", "thumbnail", "image", "photoUrls.0", "vehicle.photoUrl"])),
    listingUrl,
    source: "Auto.dev",
  };
}

/** True for California ZIP codes (900xx-961xx), used for best-effort geo filtering. */
function isCaZip(zip: string): boolean {
  const n = Number(zip.slice(0, 5));
  return n >= 90000 && n <= 96199;
}

export class AutoDevProvider implements InventoryProvider {
  readonly name = "Auto.dev";
  constructor(private apiKey: string) {}

  async search(query: SearchQuery): Promise<Car[]> {
    // Send only safe params; a wrong filter name returns 400, so we filter locally.
    const params = new URLSearchParams();
    params.set("limit", String(query.limit ?? 100));
    if (query.makes?.length) params.set("vehicle.make", query.makes.join(","));
    if (query.models?.length) params.set("vehicle.model", query.models.join(","));

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Auto.dev responded ${res.status}`);

    const data = (await res.json()) as Record<string, unknown>;
    const records =
      (pathVal(data, ["data", "records", "listings", "results", "hits"]) as Record<string, unknown>[] | undefined) ??
      (Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : []);

    const cars = records.map((r, i) => mapRecord(r, i)).filter((c): c is Car => c !== null);
    const caOnly = query.zip && isCaZip(query.zip);

    return cars.filter((c) => {
      if (query.maxPrice && c.price > query.maxPrice) return false;
      if (query.minYear && c.year < query.minYear) return false;
      if (query.maxMileage && c.mileage > query.maxMileage) return false;
      if (query.minMpg && c.mpg != null && c.mpg < query.minMpg) return false;
      if (query.fuelTypes?.length && c.fuelType && !query.fuelTypes.includes(c.fuelType)) return false;
      // Best-effort geo: if searching a CA ZIP and the dealer state is known, keep CA only.
      if (caOnly && c.state && c.state.toUpperCase() !== "CA") return false;
      return true;
    });
  }
}
