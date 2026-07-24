-- Bobby Billiards — subscriptions, trips, B2B events, and the CPC ad engine.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, tracks Stripe subscription state.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  ai_shot_uploads_this_month integer not null default 0,
  uploads_reset_at timestamptz not null default date_trunc('month', now()) + interval '1 month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- trips: shareable corridor itineraries (/trip-planner?tripId=...).
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  origin text not null,
  destination text not null,
  route geography(LineString, 4326) not null,
  buffer_meters double precision not null default 5000,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_stops (
  trip_id uuid not null references public.trips (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (trip_id, venue_id)
);

-- ---------------------------------------------------------------------------
-- venue_events: B2B direct publishing (brackets, tournaments, specials).
-- ---------------------------------------------------------------------------
create table if not exists public.venue_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null check (kind in ('tournament', 'bracket', 'special')),
  title text not null,
  starts_at timestamptz not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists venue_events_venue_idx on public.venue_events (venue_id, starts_at);

-- ---------------------------------------------------------------------------
-- venue_analytics: rollup counters surfaced on the B2B dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.venue_analytics (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  page_views bigint not null default 0,
  engagement_events bigint not null default 0,
  travel_log_additions bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CPC ad auction: campaigns, and an append-only click ledger written by the
-- /api/ads/click-track charge calculator.
-- ---------------------------------------------------------------------------
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  bid_cpc_cents integer not null check (bid_cpc_cents > 0),
  daily_budget_cents integer not null check (daily_budget_cents > 0),
  spent_today_cents integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'budget_exhausted')),
  created_at timestamptz not null default now()
);

create index if not exists ad_campaigns_venue_idx on public.ad_campaigns (venue_id);

create table if not exists public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  charged_cents integer not null,
  clearing_rule text not null default 'second_price_plus_one',
  clicked_at timestamptz not null default now(),
  route_context text
);

-- Atomic second-price charge: called by the click-track API with the service
-- role. Charges min(bid, runner-up bid + 1¢), updates spend, exhausts budget.
create or replace function public.record_ad_click(
  p_campaign_id uuid,
  p_route_context text default null
)
returns table (click_id uuid, charged_cents integer, campaign_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.ad_campaigns%rowtype;
  v_second_bid integer;
  v_charge integer;
  v_click_id uuid;
begin
  select * into v_campaign
  from public.ad_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'campaign % not found', p_campaign_id;
  end if;

  if v_campaign.status <> 'active' then
    raise exception 'campaign % is not active (status: %)', p_campaign_id, v_campaign.status;
  end if;

  select max(bid_cpc_cents) into v_second_bid
  from public.ad_campaigns
  where id <> p_campaign_id and status = 'active';

  v_charge := least(v_campaign.bid_cpc_cents, coalesce(v_second_bid, 0) + 1);

  insert into public.ad_clicks (campaign_id, venue_id, charged_cents, route_context)
  values (p_campaign_id, v_campaign.venue_id, v_charge, p_route_context)
  returning id into v_click_id;

  update public.ad_campaigns
  set
    spent_today_cents = spent_today_cents + v_charge,
    status = case
      when spent_today_cents + v_charge >= daily_budget_cents then 'budget_exhausted'
      else status
    end
  where id = p_campaign_id
  returning status into v_campaign.status;

  return query select v_click_id, v_charge, v_campaign.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;
alter table public.venue_events enable row level security;
alter table public.venue_analytics enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_clicks enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "trips are publicly readable" on public.trips;
create policy "trips are publicly readable"
  on public.trips for select using (true);

drop policy if exists "anyone authenticated creates trips" on public.trips;
create policy "anyone authenticated creates trips"
  on public.trips for insert to authenticated
  with check (owner_id = auth.uid() or owner_id is null);

drop policy if exists "trip stops are publicly readable" on public.trip_stops;
create policy "trip stops are publicly readable"
  on public.trip_stops for select using (true);

drop policy if exists "collaborators add trip stops" on public.trip_stops;
create policy "collaborators add trip stops"
  on public.trip_stops for insert to authenticated
  with check (added_by = auth.uid());

drop policy if exists "events are publicly readable" on public.venue_events;
create policy "events are publicly readable"
  on public.venue_events for select using (true);

drop policy if exists "venue owners publish events" on public.venue_events;
create policy "venue owners publish events"
  on public.venue_events for insert to authenticated
  with check (
    exists (
      select 1 from public.venues v
      where v.id = venue_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "venue owners read their analytics" on public.venue_analytics;
create policy "venue owners read their analytics"
  on public.venue_analytics for select to authenticated
  using (
    exists (
      select 1 from public.venues v
      where v.id = venue_analytics.venue_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "venue owners manage their campaigns" on public.ad_campaigns;
create policy "venue owners manage their campaigns"
  on public.ad_campaigns for all to authenticated
  using (
    exists (
      select 1 from public.venues v
      where v.id = ad_campaigns.venue_id and v.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.venues v
      where v.id = ad_campaigns.venue_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "venue owners read their clicks" on public.ad_clicks;
create policy "venue owners read their clicks"
  on public.ad_clicks for select to authenticated
  using (
    exists (
      select 1 from public.venues v
      where v.id = ad_clicks.venue_id and v.owner_id = auth.uid()
    )
  );
