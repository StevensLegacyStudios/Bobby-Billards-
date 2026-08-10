-- Real page-view tracking for the Merchant Portal analytics panel. The
-- previous dashboard showed a hash-of-venue-id fake number here — this table
-- replaces it with an actual timeseries so 30-day counts and the weekly
-- chart are both true.

create table if not exists public.venue_page_views (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists venue_page_views_venue_time_idx
  on public.venue_page_views (venue_id, viewed_at desc);

alter table public.venue_page_views enable row level security;

-- Any visitor (including anonymous) loading a venue page logs a view.
drop policy if exists "anyone logs a page view" on public.venue_page_views;
create policy "anyone logs a page view"
  on public.venue_page_views for insert
  with check (true);

-- Only the venue's owner can read its view history.
drop policy if exists "venue owners read their page views" on public.venue_page_views;
create policy "venue owners read their page views"
  on public.venue_page_views for select
  to authenticated
  using (
    exists (
      select 1 from public.venues v
      where v.id = venue_page_views.venue_id and v.owner_id = auth.uid()
    )
  );
