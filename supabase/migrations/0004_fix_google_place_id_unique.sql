-- ON CONFLICT (google_place_id) cannot target a partial unique index;
-- replace it with a full unique constraint (multiple NULLs remain allowed).
drop index if exists public.venues_google_place_id_key;
alter table public.venues add constraint venues_google_place_id_unique unique (google_place_id);
