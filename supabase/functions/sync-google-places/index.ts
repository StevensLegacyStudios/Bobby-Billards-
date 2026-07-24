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

/** Target sync regions — the Central Valley → South Bay corridor. */
const TARGET_BOUNDING_BOXES: BoundingBox[] = [
  {
    name: "stockton-metro",
    low: { latitude: 37.85, longitude: -121.45 },
    high: { latitude: 38.05, longitude: -121.15 },
  },
  {
    name: "tri-valley",
    low: { latitude: 37.6, longitude: -122.0 },
    high: { latitude: 37.75, longitude: -121.65 },
  },
  {
    name: "south-bay",
    low: { latitude: 37.2, longitude: -122.05 },
    high: { latitude: 37.45, longitude: -121.75 },
  },
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
