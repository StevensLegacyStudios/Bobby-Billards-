# Supabase backend

## Layout

- `migrations/` — SQL migrations, applied in filename order:
  - `0001_venues_core.sql` — PostGIS, `venues`, `venue_validations`, GIST index, dedup constraints, RLS.
  - `0002_corridor_rpc.sql` — `get_venues_in_corridor(route_polyline, buffer_meters)` spatial RPC.
  - `0003_monetization_b2b.sql` — profiles/subscriptions, trips, venue events, analytics, CPC ad engine (`record_ad_click`).
- `seed.sql` — demo venues along the Stockton → San Jose corridor.
- `functions/sync-google-places/` — Deno edge function syncing venue data from the Google Places API.

## Local development

```bash
supabase start
supabase db reset          # applies migrations + seed.sql
supabase functions serve sync-google-places --env-file .env.local
```

## Deploying the sync function

```bash
supabase functions deploy sync-google-places
supabase secrets set GOOGLE_PLACES_API_KEY=...
```

Schedule it crontab-style with pg_cron + pg_net (see the header comment in
`functions/sync-google-places/index.ts`), or hit it manually:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/sync-google-places" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Quick verification

After `supabase db reset`, verify the corridor RPC against the seed data:

```sql
select name, round(distance_from_route_m) as dist_m
from get_venues_in_corridor(
  'LINESTRING(-121.2908 37.9577, -121.4252 37.7397, -121.768 37.6819, -121.8863 37.3382)',
  8000
);
-- Expect the Stockton→San Jose corridor venues; Sacramento Rack Room must NOT appear.
```
