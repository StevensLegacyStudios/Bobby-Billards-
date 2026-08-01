import type { LngLat } from "./geo";

/**
 * Real geocoding via the Open-Meteo geocoding API (free, keyless, CORS-open),
 * so any US city — Half Moon Bay included — resolves. A static list of
 * common California cities acts as an offline/outage fallback.
 */

export interface GeocodedPlace {
  name: string;
  /** "Half Moon Bay, CA" */
  label: string;
  state: string | null;
  lngLat: LngLat;
}

const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "District of Columbia": "DC",
};

/** Offline fallback: cities players actually route between in California. */
const FALLBACK_CITIES: Record<string, LngLat> = {
  "san francisco": [-122.4194, 37.7749],
  oakland: [-122.2712, 37.8044],
  berkeley: [-122.2728, 37.8716],
  "san jose": [-121.8863, 37.3382],
  fremont: [-121.9886, 37.5485],
  "half moon bay": [-122.4286, 37.4636],
  "santa cruz": [-122.0308, 36.9741],
  monterey: [-121.8947, 36.6002],
  stockton: [-121.2908, 37.9577],
  sacramento: [-121.4944, 38.5816],
  modesto: [-120.9969, 37.6391],
  fresno: [-119.7871, 36.7378],
  bakersfield: [-119.0187, 35.3733],
  "los angeles": [-118.2437, 34.0522],
  "san diego": [-117.1611, 32.7157],
  "santa barbara": [-119.6982, 34.4208],
  "san luis obispo": [-120.6596, 35.2828],
  "palm springs": [-116.5453, 33.8303],
  redding: [-122.3917, 40.5865],
  eureka: [-124.1637, 40.8021],
  tracy: [-121.4252, 37.7397],
  manteca: [-121.216, 37.7974],
  livermore: [-121.768, 37.6819],
  "santa rosa": [-122.7141, 38.4404],
  napa: [-122.2869, 38.2975],
  "south lake tahoe": [-119.9772, 38.9399],
  "las vegas": [-115.1398, 36.1699],
  reno: [-119.8138, 39.5296],
};

function fallbackLookup(query: string): GeocodedPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(FALLBACK_CITIES)
    .filter(([name]) => name.startsWith(q))
    .slice(0, 6)
    .map(([name, lngLat]) => ({
      name: name.replace(/\b\w/g, (m) => m.toUpperCase()),
      label: name.replace(/\b\w/g, (m) => m.toUpperCase()),
      state: null,
      lngLat,
    }));
}

/** Search US places matching the query, best matches first. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodedPlace[]> {
  // The geocoder matches on place name only — split "Half Moon Bay, CA" into
  // the name to search and a state to filter by.
  const [rawName, rawState] = query.split(",").map((s) => s.trim());
  const q = rawName ?? "";
  const stateFilter = rawState
    ? (Object.entries(STATE_ABBR).find(
        ([full, abbr]) =>
          abbr === rawState.toUpperCase() || full.toLowerCase() === rawState.toLowerCase()
      )?.[1] ?? rawState.toUpperCase())
    : null;
  if (q.length < 2) return [];

  try {
    const url = `${GEOCODE_ENDPOINT}?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`geocoder ${res.status}`);
    const data = (await res.json()) as {
      results?: {
        name: string;
        latitude: number;
        longitude: number;
        country_code?: string;
        admin1?: string;
        population?: number;
      }[];
    };
    const places = (data.results ?? [])
      .filter((r) => r.country_code === "US")
      .filter((r) => !stateFilter || (r.admin1 && STATE_ABBR[r.admin1] === stateFilter))
      .map((r) => {
        const state = r.admin1 ? (STATE_ABBR[r.admin1] ?? r.admin1) : null;
        return {
          name: r.name,
          label: state ? `${r.name}, ${state}` : r.name,
          state,
          lngLat: [r.longitude, r.latitude] as LngLat,
          population: r.population ?? 0,
        };
      })
      // California first (that's where our venue coverage lives), then by size.
      .sort((a, b) => {
        const caA = a.state === "CA" ? 1 : 0;
        const caB = b.state === "CA" ? 1 : 0;
        if (caA !== caB) return caB - caA;
        return b.population - a.population;
      })
      .slice(0, 6)
      .map(({ name, label, state, lngLat }) => ({ name, label, state, lngLat }));
    if (places.length > 0) return places;
    return fallbackLookup(q);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return fallbackLookup(q);
  }
}

/** Resolve a single freeform city string to coordinates, or null. */
export async function geocodeCity(query: string): Promise<GeocodedPlace | null> {
  const places = await searchPlaces(query);
  return places[0] ?? null;
}
