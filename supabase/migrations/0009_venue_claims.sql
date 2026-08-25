-- Self-serve "this is my venue" claim requests. There is no owner-verification
-- flow yet — a real person (Shawn, via the SQL editor or a future admin view)
-- reviews each claim and, if legitimate, sets venues.owner_id manually. This
-- table exists so a venue owner has *something* to submit instead of a dead
-- end, which is what unlocks the Verified Venue checkout for real.

create table if not exists public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists venue_claims_venue_idx on public.venue_claims (venue_id);
create index if not exists venue_claims_status_idx on public.venue_claims (status);

alter table public.venue_claims enable row level security;

-- A signed-in user can submit a claim for themselves, and only ever see
-- their own claims — reviewing/approving is a manual, service-role-only
-- action until there's an admin surface for it.
drop policy if exists "users submit their own venue claims" on public.venue_claims;
create policy "users submit their own venue claims"
  on public.venue_claims for insert
  to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "users read their own venue claims" on public.venue_claims;
create policy "users read their own venue claims"
  on public.venue_claims for select
  to authenticated
  using (requested_by = auth.uid());
