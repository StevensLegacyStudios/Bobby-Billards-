-- Shot Lab drill score tracking — personal practice history per drill.

create table if not exists public.drill_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  drill_key text not null,
  score integer not null,
  max_score integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists drill_scores_user_drill_idx
  on public.drill_scores (user_id, drill_key, created_at desc);

alter table public.drill_scores enable row level security;

drop policy if exists "users read own drill scores" on public.drill_scores;
create policy "users read own drill scores"
  on public.drill_scores for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users log own drill scores" on public.drill_scores;
create policy "users log own drill scores"
  on public.drill_scores for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users delete own drill scores" on public.drill_scores;
create policy "users delete own drill scores"
  on public.drill_scores for delete
  to authenticated
  using (user_id = auth.uid());
