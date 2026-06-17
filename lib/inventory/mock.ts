import type { Car, InventoryProvider, SearchQuery } from "./types";

// Sample inventory modeled on real Sacramento-area hybrid listings (mid-2026).
// Used when no live API key is configured so the app always works. `listingUrl`
// points at a real marketplace search for that vehicle.
const SAMPLE: Car[] = [
  {
    id: "mock-prius-2017",
    year: 2017,
    make: "Toyota",
    model: "Prius",
    trim: "Two",
    price: 14990,
    mileage: 78000,
    mpg: 52,
    fuelType: "hybrid",
    bodyStyle: "hatchback",
    seats: 5,
    dealerName: "Sample Dealer",
    city: "Sacramento",
    state: "CA",
    distanceMiles: 8,
    listingUrl: "https://www.carvana.com/cars/toyota-prius-hybrid-under-15000",
    source: "Sample data",
  },
  {
    id: "mock-prius-2016",
    year: 2016,
    make: "Toyota",
    model: "Prius",
    trim: "Three",
    price: 13500,
    mileage: 96000,
    mpg: 50,
    fuelType: "hybrid",
    bodyStyle: "hatchback",
    seats: 5,
    city: "Elk Grove",
    state: "CA",
    distanceMiles: 14,
    listingUrl: "https://www.cargurus.com/Cars/l-Used-Toyota-Prius-Sacramento-d15_L2795",
    source: "Sample data",
  },
  {
    id: "mock-ioniq-2018",
    year: 2018,
    make: "Hyundai",
    model: "Ioniq Hybrid",
    trim: "SEL",
    price: 13590,
    mileage: 120000,
    mpg: 55,
    fuelType: "hybrid",
    bodyStyle: "hatchback",
    seats: 5,
    city: "Roseville",
    state: "CA",
    distanceMiles: 19,
    listingUrl: "https://www.carvana.com/cars/hybrid-under-15000",
    source: "Sample data",
  },
  {
    id: "mock-ioniq-2019",
    year: 2019,
    make: "Hyundai",
    model: "Ioniq Hybrid",
    trim: "Blue",
    price: 14990,
    mileage: 86000,
    mpg: 57,
    fuelType: "hybrid",
    bodyStyle: "hatchback",
    seats: 5,
    city: "Stockton",
    state: "CA",
    distanceMiles: 46,
    listingUrl: "https://www.carvana.com/cars/hybrid-under-15000",
    source: "Sample data",
  },
  {
    id: "mock-malibu-2017",
    year: 2017,
    make: "Chevrolet",
    model: "Malibu Hybrid",
    price: 12590,
    mileage: 102000,
    mpg: 46,
    fuelType: "hybrid",
    bodyStyle: "sedan",
    seats: 5,
    city: "Sacramento",
    state: "CA",
    distanceMiles: 11,
    listingUrl: "https://www.cars.com/shopping/chevrolet-malibu_hybrid/sacramento-ca/",
    source: "Sample data",
  },
  {
    id: "mock-fusion-2018",
    year: 2018,
    make: "Ford",
    model: "Fusion Hybrid",
    trim: "SE",
    price: 13900,
    mileage: 97000,
    mpg: 42,
    fuelType: "hybrid",
    bodyStyle: "sedan",
    seats: 5,
    city: "Roseville",
    state: "CA",
    distanceMiles: 20,
    listingUrl: "https://www.cars.com/shopping/ford-fusion_hybrid/sacramento-ca/",
    source: "Sample data",
  },
  {
    id: "mock-prius-v-2015",
    year: 2015,
    make: "Toyota",
    model: "Prius v",
    trim: "Three",
    price: 12900,
    mileage: 110000,
    mpg: 41,
    fuelType: "hybrid",
    bodyStyle: "wagon",
    seats: 5,
    city: "Sacramento",
    state: "CA",
    distanceMiles: 9,
    listingUrl: "https://www.cargurus.com/Cars/l-Used-Toyota-Prius-v-Sacramento-d2150_L2795",
    source: "Sample data",
  },
  {
    id: "mock-camry-2018",
    year: 2018,
    make: "Toyota",
    model: "Camry Hybrid",
    trim: "LE",
    price: 17995,
    mileage: 88000,
    mpg: 46,
    fuelType: "hybrid",
    bodyStyle: "sedan",
    seats: 5,
    city: "Sacramento",
    state: "CA",
    distanceMiles: 7,
    listingUrl:
      "https://www.truecar.com/used-cars-for-sale/listings/toyota/camry/location-sacramento-ca/?fuelType%5B%5D=Hybrid",
    source: "Sample data",
  },
  {
    id: "mock-accord-2019",
    year: 2019,
    make: "Honda",
    model: "Accord Hybrid",
    price: 18400,
    mileage: 92000,
    mpg: 47,
    fuelType: "hybrid",
    bodyStyle: "sedan",
    seats: 5,
    city: "Elk Grove",
    state: "CA",
    distanceMiles: 15,
    listingUrl: "https://www.cars.com/shopping/honda-accord_hybrid/sacramento-ca/",
    source: "Sample data",
  },
];

function matches(car: Car, q: SearchQuery): boolean {
  if (q.maxPrice && car.price > q.maxPrice) return false;
  if (q.minYear && car.year < q.minYear) return false;
  if (q.maxMileage && car.mileage > q.maxMileage) return false;
  if (q.minMpg && (car.mpg ?? 0) < q.minMpg) return false;
  if (q.fuelTypes && q.fuelTypes.length && car.fuelType && !q.fuelTypes.includes(car.fuelType))
    return false;
  if (q.bodyStyles && q.bodyStyles.length && car.bodyStyle && !q.bodyStyles.includes(car.bodyStyle))
    return false;
  if (q.makes && q.makes.length && !q.makes.map((m) => m.toLowerCase()).includes(car.make.toLowerCase()))
    return false;
  if (
    car.distanceMiles != null &&
    q.radiusMiles &&
    car.distanceMiles > q.radiusMiles
  )
    return false;
  return true;
}

export class MockProvider implements InventoryProvider {
  readonly name = "Sample data";

  async search(query: SearchQuery): Promise<Car[]> {
    const out = SAMPLE.filter((c) => matches(c, query));
    return query.limit ? out.slice(0, query.limit) : out;
  }
}
