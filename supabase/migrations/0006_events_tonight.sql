-- Buddy Billiards — Tonight discovery: recurring events, tournament formats,
-- and community event submissions for unclaimed venues.

-- ---------------------------------------------------------------------------
-- venue_events: new columns for weekly recurrence and tournament metadata.
-- ---------------------------------------------------------------------------
alter table public.venue_events
  add column if not exists recurs_weekly boolean not null default false,
  -- 0 = Sunday .. 6 = Saturday; null unless the event recurs weekly.
  add column if not exists weekday smallint
    check (weekday is null or (weekday >= 0 and weekday <= 6)),
  add column if not exists entry_fee_cents integer
    check (entry_fee_cents is null or entry_fee_cents >= 0),
  add column if not exists race_format text,
  add column if not exists fargo_range text,
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Recurring events must carry a weekday; one-time events must not.
alter table public.venue_events
  drop constraint if exists venue_events_weekday_recurrence_check;
alter table public.venue_events
  add constraint venue_events_weekday_recurrence_check
  check ((recurs_weekly and weekday is not null) or (not recurs_weekly and weekday is null));

-- The Tonight page scans by start time and by weekday for recurring events.
create index if not exists venue_events_starts_at_idx on public.venue_events (starts_at);
create index if not exists venue_events_weekday_idx
  on public.venue_events (weekday)
  where recurs_weekly;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.venue_events enable row level security;

-- Public read access to the event calendar.
drop policy if exists "events are publicly readable" on public.venue_events;
create policy "events are publicly readable"
  on public.venue_events for select
  using (true);

-- Venue owners publish to their own venues. Community members may submit
-- events for unclaimed venues (owner_id is null) — league nights and weekly
-- tournaments predate venue claims, and the calendar is useless without them.
drop policy if exists "venue owners publish events" on public.venue_events;
drop policy if exists "owners and community publish events" on public.venue_events;
create policy "owners and community publish events"
  on public.venue_events for insert
  to authenticated
  with check (
    auth.uid() is not null
    and exists (
      select 1 from public.venues v
      where v.id = venue_id
        and (v.owner_id = auth.uid() or v.owner_id is null)
    )
  );

-- Only the submitter or the venue's owner may edit or remove an event.
drop policy if exists "authors and venue owners update events" on public.venue_events;
create policy "authors and venue owners update events"
  on public.venue_events for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.venues v
      where v.id = venue_events.venue_id and v.owner_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.venues v
      where v.id = venue_events.venue_id and v.owner_id = auth.uid()
    )
  );

drop policy if exists "authors and venue owners delete events" on public.venue_events;
create policy "authors and venue owners delete events"
  on public.venue_events for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.venues v
      where v.id = venue_events.venue_id and v.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Sample events (COMMENTS ONLY — not inserted; the live table stays clean of
-- fabricated tournaments; lib/demo-data.ts DEMO_EVENTS exercises the UI when
-- Supabase is not configured).
-- ---------------------------------------------------------------------------
-- insert into public.venue_events
--   (venue_id, kind, title, starts_at, details, recurs_weekly, weekday,
--    entry_fee_cents, race_format, fargo_range, created_by)
-- values
--   ('<venue-uuid>', 'tournament', 'Tuesday Night 9-Ball',
--    '2026-08-04 19:00:00-07', 'Open to all, BCA rules.', true, 2,
--    2000, 'Race to 5', 'Under 650', '<user-uuid>'),
--   ('<venue-uuid>', 'bracket', 'Summer Bracket — Round of 32',
--    '2026-08-08 12:00:00-07', 'Double elimination, alternating break.', false, null,
--    4000, 'Race to 7', null, '<user-uuid>'),
--   ('<venue-uuid>', 'special', 'Friday Happy Hour: half-price tables',
--    '2026-08-07 16:00:00-07', 'Includes house cue rental.', true, 5,
--    null, null, null, '<user-uuid>');
