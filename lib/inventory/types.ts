import type { BodyStyle, FuelType } from "@/lib/profile";

/** A normalized car listing from any provider. `listingUrl` is the real link. */
export interface Car {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage: number;
  mpg?: number;
  fuelType?: FuelType;
  bodyStyle?: BodyStyle;
  seats?: number;
  dealerName?: string;
  city?: string;
  state?: string;
  distanceMiles?: number;
  photoUrl?: string;
  /** Direct link to the original listing (dealer VDP / marketplace page). */
  listingUrl: string;
  /** Where this listing came from, e.g. "Auto.dev" or "Sample data". */
  source: string;
}

export interface SearchQuery {
  zip: string;
  radiusMiles: number;
  maxPrice?: number;
  minYear?: number;
  maxMileage?: number;
  minMpg?: number;
  fuelTypes?: FuelType[];
  bodyStyles?: BodyStyle[];
  makes?: string[];
  models?: string[];
  limit?: number;
}

export interface InventoryProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<Car[]>;
}
