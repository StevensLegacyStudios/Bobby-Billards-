// Bobby Billiards — Google Places venue sync (Supabase Edge Function, Deno).
//
// Periodically queries the Google Places API for billiard venues inside the
// configured bounding boxes and upserts them into public.venues WITHOUT
// touching proprietary crowd-validated fields (cloth_quality, pocket_widths,
// cue_spacing, is_verified, table_specifications).
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

interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

async function searchPlacesInBox(
  apiKey: string,
  box: BoundingBox,
): Promise<PlaceResult[]> {
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
      locationRestriction: { rectangle: box },
      maxResultCount: 20,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places API ${response.status} for ${box.name}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  return (payload.places ?? []) as PlaceResult[];
}

function toVenueRow(place: PlaceResult) {
  if (!place.location || !place.displayName?.text) return null;
  const hours = place.regularOpeningHours?.weekdayDescriptions
    ? { weekday_descriptions: place.regularOpeningHours.weekdayDescriptions }
    : null;
  return {
    google_place_id: place.id,
    name: place.displayName.text,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    hours,
    rating: place.rating ?? null,
    coordinates: `SRID=4326;POINT(${place.location.longitude} ${place.location.latitude})`,
    // Deliberately NOT setting cloth_quality / pocket_widths / cue_spacing /
    // is_verified / table_specifications — those are user- and merchant-owned.
  };
}

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
  if (!googleApiKey) {
    return Response.json(
      { error: "GOOGLE_PLACES_API_KEY secret is not set", synced: 0 },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const summary: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  for (const box of TARGET_BOUNDING_BOXES) {
    summary[box.name] = { fetched: 0, upserted: 0 };
    try {
      const places = await searchPlacesInBox(googleApiKey, box);
      summary[box.name].fetched = places.length;

      const rows = places.map(toVenueRow).filter((row) => row !== null);

      // Batched upsert keyed on google_place_id. onConflict merge only
      // rewrites the Places-owned columns listed in toVenueRow, so any
      // proprietary crowd-validated data on the row survives every sync.
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error, count } = await supabase
          .from("venues")
          .upsert(batch, { onConflict: "google_place_id", count: "exact" });
        if (error) throw new Error(error.message);
        summary[box.name].upserted += count ?? batch.length;
      }
    } catch (err) {
      summary[box.name].error = err instanceof Error ? err.message : String(err);
      // Keep syncing remaining regions — one bad bounding box must not
      // abort the whole run.
      console.error(`sync failed for ${box.name}:`, err);
    }
  }

  const failed = Object.values(summary).filter((s) => s.error).length;
  return Response.json(
    { ok: failed === 0, regions: summary },
    { status: failed === TARGET_BOUNDING_BOXES.length ? 502 : 200 },
  );
});
