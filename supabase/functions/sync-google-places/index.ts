// Bobby Billiards — venue sync (Supabase Edge Function, Deno).
//
// Primary source: Google Places API (New). Fallback source: OpenStreetMap
// Overpass (keyless), used per-region whenever the Google call fails or no
// GOOGLE_PLACES_API_KEY secret is configured. Both paths upsert into
// public.venues WITHOUT touching proprietary crowd-validated fields
// (cloth_quality, pocket_widths, cue_spacing, is_verified,
// table_specifications).
//
// Schedule (crontab-style) via pg_cron + pg_net, e.g. hourly:
//   select cron.schedule(
//     'sync-google-places-hourly', '0 * * * *',
//     $$ select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/sync-google-places',
//          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
//        ) $$);

import { createClient } from "jsr:@supabase/supabase-js@2";

interface BoundingBox {
  name: string;
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
}

/**
 * Target sync regions — California metro coverage.
 *
 * Google's searchText caps at 20 results per query, so dense metros get their
 * own (or several) boxes. ~32 boxes × 1 sync/day ≈ 960 Places calls/month,
 * which stays inside the Enterprise-SKU free tier (1,000/month) required by
 * the phone-number field. Add regions sparingly or drop the sync to weekly
 * before growing this list much further.
 */
const box = (
  name: string,
  s: number,
  w: number,
  n: number,
  e: number,
): BoundingBox => ({
  name,
  low: { latitude: s, longitude: w },
  high: { latitude: n, longitude: e },
});

const TARGET_BOUNDING_BOXES: BoundingBox[] = [
  // Bay Area
  box("south-bay-sj", 37.2, -122.05, 37.45, -121.75),
  box("east-bay", 37.45, -122.35, 37.9, -121.9),
  box("sf-peninsula", 37.4, -122.55, 37.85, -122.2),
  box("north-bay-marin", 37.85, -122.75, 38.35, -122.2),
  box("santa-rosa", 38.3, -122.9, 38.6, -122.5),
  box("tri-valley", 37.6, -122.0, 37.75, -121.65),
  box("santa-cruz", 36.9, -122.15, 37.1, -121.9),
  // Central Valley & Sierra
  box("stockton-modesto", 37.5, -121.45, 38.05, -120.9),
  box("sacramento", 38.4, -121.6, 38.8, -121.1),
  box("yuba-chico", 39.0, -122.0, 39.8, -121.4),
  box("redding", 40.4, -122.5, 40.8, -122.2),
  box("merced-turlock", 37.2, -121.0, 37.6, -120.3),
  box("fresno", 36.6, -119.95, 36.9, -119.6),
  box("visalia-tulare", 36.2, -119.5, 36.5, -119.1),
  box("bakersfield", 35.2, -119.3, 35.5, -118.8),
  box("tahoe-truckee", 38.8, -120.3, 39.4, -119.9),
  // Central Coast
  box("monterey-salinas", 36.5, -122.0, 36.9, -121.5),
  box("san-luis-obispo", 35.1, -120.9, 35.5, -120.4),
  box("santa-barbara", 34.3, -120.0, 34.6, -119.4),
  box("ventura-oxnard", 34.1, -119.4, 34.5, -118.7),
  // Los Angeles metro (split — too many venues for one box)
  box("san-fernando-valley", 34.13, -118.7, 34.35, -118.2),
  box("la-west", 33.9, -118.7, 34.13, -118.25),
  box("la-central-east", 33.9, -118.25, 34.13, -117.7),
  box("long-beach-south-bay-la", 33.6, -118.5, 33.9, -117.95),
  box("orange-county", 33.4, -118.05, 33.9, -117.5),
  box("inland-empire", 33.8, -117.7, 34.2, -117.1),
  box("victorville-lancaster", 34.4, -118.4, 34.8, -117.2),
  box("palm-springs", 33.6, -116.8, 34.0, -116.2),
  // San Diego & far south
  box("san-diego-north", 33.1, -117.4, 33.4, -116.9),
  box("san-diego", 32.5, -117.4, 33.1, -116.8),
  box("imperial-el-centro", 32.6, -115.7, 32.9, -115.3),
  // North coast
  box("eureka-humboldt", 40.6, -124.3, 40.9, -123.9),
];

const BATCH_SIZE = 50;

interface VenueRow {
  google_place_id: string;
  name: string;
  phone: string | null;
  hours: Record<string, unknown> | null;
  rating: number | null;
  coordinates: string;
}

// ---------------------------------------------------------------------------
// Google Places (New) source
// ---------------------------------------------------------------------------

interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

async function searchGooglePlaces(apiKey: string, box: BoundingBox): Promise<VenueRow[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.rating",
        "places.location",
        "places.regularOpeningHours",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: "billiards OR pool hall",
      locationRestriction: { rectangle: { low: box.low, high: box.high } },
      maxResultCount: 20,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places API ${response.status} for ${box.name}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const places = (payload.places ?? []) as PlaceResult[];
  return places
    .map((place): VenueRow | null => {
      if (!place.location || !place.displayName?.text) return null;
      return {
        google_place_id: place.id,
        name: place.displayName.text,
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        hours: place.regularOpeningHours?.weekdayDescriptions
          ? { weekday_descriptions: place.regularOpeningHours.weekdayDescriptions }
          : null,
        rating: place.rating ?? null,
        coordinates: `SRID=4326;POINT(${place.location.longitude} ${place.location.latitude})`,
      };
    })
    .filter((row): row is VenueRow => row !== null);
}

// ---------------------------------------------------------------------------
// OpenStreetMap Overpass fallback (keyless)
// ---------------------------------------------------------------------------

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Single query over the merged corridor bbox — Overpass rate-limits rapid
 * sequential queries, so one polite request beats three fast ones. */
function mergedBbox(boxes: BoundingBox[]): BoundingBox {
  return {
    name: "merged-corridor",
    low: {
      latitude: Math.min(...boxes.map((b) => b.low.latitude)),
      longitude: Math.min(...boxes.map((b) => b.low.longitude)),
    },
    high: {
      latitude: Math.max(...boxes.map((b) => b.high.latitude)),
      longitude: Math.max(...boxes.map((b) => b.high.longitude)),
    },
  };
}

async function searchOsm(box: BoundingBox): Promise<VenueRow[]> {
  const bbox = `${box.low.latitude},${box.low.longitude},${box.high.latitude},${box.high.longitude}`;
  // Keep the query single-line and simple — Overpass's frontend rejects
  // multi-line regex-heavy queries with an Apache 406.
  const query = `[out:json][timeout:25];nwr["sport"="billiards"](${bbox});out center tags;`;

  // Overpass's usage policy requires an identifying User-Agent; requests
  // without one are rejected by its Apache frontend (406).
  const response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "BobbyBilliards/1.0 (venue sync; contact: admin@bobbybilliards.app)",
      },
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Overpass ${response.status} for ${box.name}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const elements = (payload.elements ?? []) as OverpassElement[];
  return elements
    .map((el): VenueRow | null => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const name = el.tags?.name;
      if (lat === undefined || lon === undefined || !name) return null;
      return {
        // Stable synthetic id keeps the dedup upsert working for OSM rows.
        google_place_id: `osm:${el.type}/${el.id}`,
        name,
        phone: el.tags?.phone ?? el.tags?.["contact:phone"] ?? null,
        hours: el.tags?.opening_hours ? { osm_opening_hours: el.tags.opening_hours } : null,
        rating: null,
        coordinates: `SRID=4326;POINT(${lon} ${lat})`,
      };
    })
    .filter((row): row is VenueRow => row !== null);
}

// ---------------------------------------------------------------------------
// Sync loop
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase environment not configured" }, { status: 500 });
  }

  // Non-secret fingerprint so operators can confirm WHICH key the running
  // instance loaded (compare the last 4 chars against the console).
  const keyFingerprint = googleApiKey
    ? `${googleApiKey.slice(0, 4)}…${googleApiKey.slice(-4)} (len ${googleApiKey.length})`
    : "not set — OSM only";

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const summary: Record<
    string,
    { source: string; fetched: number; upserted: number; googleError?: string; error?: string }
  > = {};

  const upsertRows = async (rows: VenueRow[]) => {
    // Batched upsert keyed on google_place_id. onConflict merge only
    // rewrites the source-owned columns above, so any proprietary
    // crowd-validated data on the row survives every sync.
    let upserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase
        .from("venues")
        .upsert(batch, { onConflict: "google_place_id", count: "exact" });
      if (error) throw new Error(error.message);
      upserted += count ?? batch.length;
    }
    return upserted;
  };

  // Preferred source: Google Places per region.
  let googleSucceeded = false;
  for (const box of TARGET_BOUNDING_BOXES) {
    summary[box.name] = { source: "google", fetched: 0, upserted: 0 };
    if (!googleApiKey) continue;
    try {
      const rows = await searchGooglePlaces(googleApiKey, box);
      summary[box.name].fetched = rows.length;
      summary[box.name].upserted = await upsertRows(rows);
      googleSucceeded = true;
    } catch (err) {
      summary[box.name].googleError = err instanceof Error ? err.message : String(err);
    }
  }

  // Fallback: one merged-corridor OSM query when Google produced nothing.
  if (!googleSucceeded) {
    summary["osm-fallback"] = { source: "osm", fetched: 0, upserted: 0 };
    try {
      const rows = await searchOsm(mergedBbox(TARGET_BOUNDING_BOXES));
      summary["osm-fallback"].fetched = rows.length;
      summary["osm-fallback"].upserted = await upsertRows(rows);
    } catch (err) {
      summary["osm-fallback"].error = err instanceof Error ? err.message : String(err);
      console.error("osm fallback failed:", err);
    }
  }

  const failed = Object.values(summary).filter((s) => s.error).length;
  return Response.json(
    { ok: failed === 0, keyFingerprint, regions: summary },
    { status: failed === TARGET_BOUNDING_BOXES.length ? 502 : 200 },
  );
});
