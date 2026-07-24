-- Bobby Billiards — core venue schema with PostGIS spatial support.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- venues: canonical directory of billiard rooms, synced from Google Places
-- and enriched with crowd-sourced play-condition data.
-- ---------------------------------------------------------------------------
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  hours jsonb,
  rating numeric(3, 2) check (rating is null or (rating >= 0 and rating <= 5)),
  coordinates geography(Point, 4326) not null,
  -- Crowd-sourced play-condition metrics. These fields are user-validated and
  -- must never be clobbered by automated Places syncs.
  cloth_quality text,
  pocket_widths text,
  cue_spacing text,
  is_verified boolean not null default false,
  -- Verified merchant profiles, e.g. [{"label": "Verified 9ft Diamond Tables", ...}]
  table_specifications jsonb,
  google_place_id text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spatial GIST index powering corridor intersection queries.
create index if not exists venues_coordinates_gist on public.venues using gist (coordinates);

-- Dedup guards for automated API syncs:
-- 1) a source-synced row is unique by its external place id (a full unique
--    constraint, not a partial index, so ON CONFLICT can target it);
create unique index if not exists venues_google_place_id_key
  on public.venues (google_place_id)
  where google_place_id is not null;
-- NOTE: superseded by 0004_fix_google_place_id_unique.sql on live projects.
-- 2) manually-entered rows are unique by normalized name at a ~1m snapped location.
create unique index if not exists venues_name_location_key
  on public.venues (lower(name), st_snaptogrid(coordinates::geometry, 0.00001));

-- ---------------------------------------------------------------------------
-- venue_validations: append-only crowd-sourced condition reports. The venue
-- row's headline metrics are recomputed from the latest consensus.
-- ---------------------------------------------------------------------------
create table if not exists public.venue_validations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cloth_quality text,
  pocket_widths text,
  cue_spacing text,
  notes text,
  created_at timestamptz not null default now(),
  unique (venue_id, user_id, created_at)
);

create index if not exists venue_validations_venue_idx on public.venue_validations (venue_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.venue_validations enable row level security;

-- Public read access to the venue directory.
drop policy if exists "venues are publicly readable" on public.venues;
create policy "venues are publicly readable"
  on public.venues for select
  using (true);

-- Only the verified business owner may edit their merchant profile directly.
drop policy if exists "owners manage their verified profile" on public.venues;
create policy "owners manage their verified profile"
  on public.venues for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Authenticated users contribute crowd-sourced validations.
drop policy if exists "validations are publicly readable" on public.venue_validations;
create policy "validations are publicly readable"
  on public.venue_validations for select
  using (true);

drop policy if exists "authenticated users submit validations" on public.venue_validations;
create policy "authenticated users submit validations"
  on public.venue_validations for insert
  to authenticated
  with check (user_id = auth.uid());
