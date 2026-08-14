// DCAP (California Driving Clean Assistance Program) eligibility + grant math.
// Program rules: used vehicle must be an EV or plug-in hybrid, 8 model years or
// newer, 75,000 miles or less, priced at or under $45,000. The grant is paid to
// the dealer as a down payment (EV $7,500 / PHEV $7,000) and can be applied to a
// cash purchase — no loan required.

import type { Car } from "@/lib/inventory/types";
import type { FuelType } from "@/lib/profile";

export const DCAP_MAX_AGE_YEARS = 8;
export const DCAP_MAX_MILEAGE = 75_000;
export const DCAP_PRICE_CAP = 45_000;
export const DCAP_GRANT_EV = 7_500;
export const DCAP_GRANT_PHEV = 7_000;
/**
 * Default sticker-price ceiling for DCAP searches. This is NOT the buyer's
 * target out-of-pocket cost — the grant ($7,000-7,500) comes off the sticker
 * price afterward, so the search ceiling needs headroom above the target
 * out-of-pocket price or it misses cars that are genuinely affordable once
 * the grant is applied. Per-car "you pay" math is still computed and shown.
 */
export const DCAP_DEFAULT_MAX_PRICE = 20_000;

export function grantFor(fuel: FuelType | undefined): number {
  if (fuel === "electric") return DCAP_GRANT_EV;
  if (fuel === "phev") return DCAP_GRANT_PHEV;
  return 0;
}

export interface DcapInfo {
  eligible: boolean;
  /** Reasons the car does NOT qualify (empty when eligible). */
  reasons: string[];
  grant: number;
  /** Roughly what the buyer pays after the grant (price minus grant). */
  youPay: number;
  /** Best-effort flag that the listing is at a known DCAP-network dealer. */
  atNetworkDealer: boolean;
}

export function dcapInfo(car: Car, now = new Date()): DcapInfo {
  const reasons: string[] = [];
  const fuelOk = car.fuelType === "electric" || car.fuelType === "phev";
  if (!fuelOk) reasons.push("Not an EV or plug-in hybrid");

  const minYear = now.getFullYear() - DCAP_MAX_AGE_YEARS;
  if (car.year < minYear) reasons.push(`Older than ${DCAP_MAX_AGE_YEARS} model years (needs ${minYear}+)`);
  if (car.mileage > DCAP_MAX_MILEAGE) reasons.push(`Over ${DCAP_MAX_MILEAGE.toLocaleString()} miles`);
  if (car.price > DCAP_PRICE_CAP) reasons.push(`Over the $${DCAP_PRICE_CAP.toLocaleString()} price cap`);

  const grant = grantFor(car.fuelType);
  return {
    eligible: reasons.length === 0,
    reasons,
    grant,
    youPay: Math.max(0, car.price - grant),
    atNetworkDealer: isNetworkDealer(car),
  };
}

export interface DcapDealer {
  name: string;
  address: string;
  city: string;
  phone: string;
  note?: string;
}

// Northern California DCAP-participating dealers (compiled from drivingcleanca.org
// and evequity.org, 2026). Not exhaustive — the full list is at
// drivingcleanca.org/vehicles/dealership-network/, and any licensed CA dealer that
// can provide the required documentation can process a DCAP purchase.
export const DCAP_DEALERS: DcapDealer[] = [
  { name: "Stockton Honda", address: "", city: "Stockton", phone: "", note: "Serves Sacramento, Elk Grove, Lodi, Modesto, Stockton" },
  { name: "Sacramento auto dealer", address: "2820 Auburn Blvd", city: "Sacramento", phone: "916-604-4095" },
  { name: "Stockton auto dealer", address: "2002 E Hammer Ln", city: "Stockton", phone: "209-314-1571" },
  { name: "Stockton used dealer", address: "744 E Miner Ave", city: "Stockton", phone: "209-871-6645" },
  { name: "Modesto used dealer", address: "4813 McHenry Ave", city: "Modesto", phone: "209-593-3200" },
  { name: "Fairfield auto dealer", address: "2855 Auto Mall Pkwy", city: "Fairfield", phone: "707-366-0703" },
  { name: "Fairfield used dealer", address: "2525 Martin Rd", city: "Fairfield", phone: "707-639-9073" },
  { name: "Vacaville used dealer", address: "641 Orange Dr", city: "Vacaville", phone: "707-317-6357" },
];

const NETWORK_CITIES = new Set(DCAP_DEALERS.map((d) => d.city.toLowerCase()));
const NETWORK_NAMES = DCAP_DEALERS.map((d) => d.name.toLowerCase());

/** Best-effort: does this listing look like it's at a DCAP-network dealer? */
export function isNetworkDealer(car: Car): boolean {
  const name = (car.dealerName ?? "").toLowerCase();
  if (name && NETWORK_NAMES.some((n) => n && name.includes(n))) return true;
  // Fall back to city match (approximate — user must confirm enrollment).
  return !!car.city && NETWORK_CITIES.has(car.city.toLowerCase());
}
