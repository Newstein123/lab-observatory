-- Discoveries: objects and their features (craters, moons, rings, nebula
-- regions) saved from the Astronomical Object Explorer. One record per thing
-- per user; owner-only like the rest of the observatory.

create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_id text not null check (target_id ~ '^[a-z0-9-]{1,100}$'),
  kind text not null check (kind in ('object', 'feature', 'companion', 'ring')),
  feature_id text check (feature_id ~ '^[a-z0-9-]{1,100}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  note text check (char_length(note) <= 2000),
  observed_at timestamptz,
  site_name text check (char_length(site_name) <= 120),
  setup_summary text check (char_length(setup_summary) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The object itself has no feature id; a feature, moon or ring always has one.
  constraint discoveries_feature_matches_kind check ((kind = 'object') = (feature_id is null))
);

create unique index discoveries_owner_thing_idx on public.discoveries (owner_id, target_id, kind, coalesce(feature_id, ''));
create index discoveries_owner_created_idx on public.discoveries (owner_id, created_at desc);

create trigger discoveries_set_updated_at
  before update on public.discoveries
  for each row execute function public.set_updated_at();

alter table public.discoveries enable row level security;

create policy "Owners manage their discoveries" on public.discoveries
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.discoveries from anon;
