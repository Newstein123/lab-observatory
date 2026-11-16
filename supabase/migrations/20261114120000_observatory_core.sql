-- Universal Observatory — core private data (spec §9.1).
--
-- Equipment profiles, configurations (+ components) and immutable simulation
-- sessions (+ configuration snapshot + result). Clients talk to these tables
-- directly through the Data API, so the database is the trust boundary:
--   * every table is owner-scoped with row-level security;
--   * value ranges mirror the application's validation (Zod) schemas;
--   * a configuration may only link to a profile its owner owns;
--   * sessions cannot be updated once written.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when s->key is a JSON number within [lo, hi]. CASE guarantees the cast
-- is only attempted on numbers.
create function public.json_number_between(s jsonb, key text, lo double precision, hi double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(s -> key) = 'number' then (s ->> key)::double precision between lo and hi else false end
$$;

create function public.json_optional_number_between(s jsonb, key text, lo double precision, hi double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (s -> key) is null or jsonb_typeof(s -> key) = 'null' or public.json_number_between(s, key, lo, hi)
$$;

create function public.json_optional_text(s jsonb, key text, max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (s -> key) is null
      or jsonb_typeof(s -> key) = 'null'
      or (jsonb_typeof(s -> key) = 'string' and char_length(s ->> key) <= max_len)
$$;

-- Structural validation of accessory specifications (spec §5.2 accessory fields).
create function public.is_valid_component(component_type text, spec jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(spec) = 'object' and case component_type
    when 'eyepiece' then
          public.json_number_between(spec, 'focalLengthMm', 1, 100)
      and public.json_number_between(spec, 'apparentFovDeg', 20, 120)
      and public.json_optional_number_between(spec, 'fieldStopMm', 1, 80)
      and public.json_optional_text(spec, 'label', 100)
    when 'camera' then
          public.json_number_between(spec, 'sensorWidthMm', 1, 100)
      and public.json_number_between(spec, 'sensorHeightMm', 1, 100)
      and public.json_number_between(spec, 'pixelSizeUm', 0.5, 30)
      and public.json_optional_number_between(spec, 'resolutionX', 1, 100000)
      and public.json_optional_number_between(spec, 'resolutionY', 1, 100000)
      and public.json_optional_text(spec, 'label', 100)
    when 'barlow' then
          public.json_number_between(spec, 'factor', 1, 5)
      and public.json_optional_text(spec, 'label', 100)
    when 'filter' then
          jsonb_typeof(spec -> 'name') = 'string'
      and char_length(spec ->> 'name') between 1 and 100
    else false
  end
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  new.owner_id := old.owner_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Equipment profiles (spec §5.1)
-- ---------------------------------------------------------------------------

create table public.telescope_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  optical_design text not null check (optical_design in ('refractor', 'reflector', 'catadioptric')),
  aperture_mm double precision not null check (aperture_mm between 10 and 10000),
  focal_length_mm double precision not null check (focal_length_mm between 50 and 100000),
  mount_type text not null check (mount_type in ('alt_azimuth', 'equatorial', 'dobsonian', 'goto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index telescope_profiles_owner_created_idx on public.telescope_profiles (owner_id, created_at desc);

create trigger telescope_profiles_set_updated_at
  before update on public.telescope_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Configurations (spec §5.2). Optics are stored inline so a configuration is
-- self-contained; when linked to a profile they mirror that profile.
-- ---------------------------------------------------------------------------

create table public.telescope_configurations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid references public.telescope_profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  status text not null check (status in ('owned', 'experimental', 'planned')),
  aperture_mm double precision not null check (aperture_mm between 10 and 10000),
  focal_length_mm double precision not null check (focal_length_mm between 50 and 100000),
  optical_design text check (optical_design in ('refractor', 'reflector', 'catadioptric')),
  notes text check (char_length(notes) <= 2000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index telescope_configurations_owner_created_idx on public.telescope_configurations (owner_id, created_at desc);
create index telescope_configurations_profile_idx on public.telescope_configurations (profile_id);

create table public.configuration_components (
  configuration_id uuid not null references public.telescope_configurations (id) on delete cascade,
  component_type text not null check (component_type in ('eyepiece', 'camera', 'barlow', 'filter')),
  spec jsonb not null,
  primary key (configuration_id, component_type),
  constraint configuration_components_valid_spec check (public.is_valid_component(component_type, spec))
);

-- A linked configuration must reference a profile with the same owner, and
-- takes its optics from that profile. Runs as the caller, so RLS also hides
-- other users' profiles from this lookup.
create function public.sync_configuration_optics()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.telescope_profiles;
begin
  if new.profile_id is not null then
    select * into p
    from public.telescope_profiles
    where id = new.profile_id and owner_id = new.owner_id;
    if not found then
      raise exception 'Linked equipment profile does not exist' using errcode = '23503';
    end if;
    new.aperture_mm := p.aperture_mm;
    new.focal_length_mm := p.focal_length_mm;
    new.optical_design := p.optical_design;
  end if;
  return new;
end;
$$;

create trigger telescope_configurations_sync_optics
  before insert or update on public.telescope_configurations
  for each row execute function public.sync_configuration_optics();

-- Every update produces a new version, whoever performs it.
create function public.bump_configuration_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger telescope_configurations_bump_version
  before update on public.telescope_configurations
  for each row execute function public.bump_configuration_version();

create trigger telescope_configurations_set_updated_at
  before update on public.telescope_configurations
  for each row execute function public.set_updated_at();

-- Profile optics changes propagate to linked configurations (new versions).
create function public.propagate_profile_optics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.telescope_configurations c
  set aperture_mm = new.aperture_mm,
      focal_length_mm = new.focal_length_mm,
      optical_design = new.optical_design
  where c.profile_id = new.id
    and (c.aperture_mm, c.focal_length_mm, c.optical_design)
        is distinct from (new.aperture_mm, new.focal_length_mm, new.optical_design);
  return null;
end;
$$;

create trigger telescope_profiles_propagate_optics
  after update of aperture_mm, focal_length_mm, optical_design on public.telescope_profiles
  for each row execute function public.propagate_profile_optics();

-- ---------------------------------------------------------------------------
-- Sessions (spec §6.2, FR-11): immutable once written.
-- ---------------------------------------------------------------------------

create table public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  target_id text not null check (char_length(target_id) between 1 and 100),
  target_snapshot jsonb not null check (jsonb_typeof(target_snapshot) = 'object'),
  mode text not null check (mode in ('eyepiece', 'camera')),
  conditions jsonb not null default '{}' check (
    jsonb_typeof(conditions) = 'object'
    and public.json_optional_number_between(conditions, 'seeingArcsec', 0.1, 20)
  ),
  exposure jsonb check (
    exposure is null or (
      jsonb_typeof(exposure) = 'object'
      and public.json_number_between(exposure, 'exposureS', 0.0001, 3600)
      and public.json_number_between(exposure, 'gain', 0.1, 1000)
    )
  ),
  view_settings jsonb not null check (jsonb_typeof(view_settings) = 'object'),
  simulation_version text not null check (char_length(simulation_version) between 1 and 50),
  created_at timestamptz not null default now()
);

create index simulation_sessions_owner_created_idx on public.simulation_sessions (owner_id, created_at desc);

create table public.session_configurations (
  session_id uuid primary key references public.simulation_sessions (id) on delete cascade,
  -- Historical reference only (no FK): the configuration may later change or be deleted.
  configuration_id uuid,
  configuration_version integer check (configuration_version >= 1),
  modified_from_saved boolean not null default false,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);

create table public.simulation_results (
  session_id uuid primary key references public.simulation_sessions (id) on delete cascade,
  engine_version text not null check (char_length(engine_version) between 1 and 50),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  assumptions text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security: every record is private to its owner (spec §10).
-- ---------------------------------------------------------------------------

alter table public.telescope_profiles enable row level security;
alter table public.telescope_configurations enable row level security;
alter table public.configuration_components enable row level security;
alter table public.simulation_sessions enable row level security;
alter table public.session_configurations enable row level security;
alter table public.simulation_results enable row level security;

create policy "Owners manage their profiles" on public.telescope_profiles
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their configurations" on public.telescope_configurations
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their configuration components" on public.configuration_components
  for all to authenticated
  using (exists (
    select 1 from public.telescope_configurations c
    where c.id = configuration_id and c.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.telescope_configurations c
    where c.id = configuration_id and c.owner_id = (select auth.uid())
  ));

create policy "Owners read their sessions" on public.simulation_sessions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Owners create their sessions" on public.simulation_sessions
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners delete their sessions" on public.simulation_sessions
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Owners read their session snapshots" on public.session_configurations
  for select to authenticated
  using (exists (select 1 from public.simulation_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));
create policy "Owners create their session snapshots" on public.session_configurations
  for insert to authenticated
  with check (exists (select 1 from public.simulation_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));

create policy "Owners read their session results" on public.simulation_results
  for select to authenticated
  using (exists (select 1 from public.simulation_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));
create policy "Owners create their session results" on public.simulation_results
  for insert to authenticated
  with check (exists (select 1 from public.simulation_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));

-- Signed-out visitors get no access at all; sessions can never be updated.
revoke all on public.telescope_profiles, public.telescope_configurations, public.configuration_components,
  public.simulation_sessions, public.session_configurations, public.simulation_results from anon;
revoke update on public.simulation_sessions, public.session_configurations, public.simulation_results from authenticated;

-- ---------------------------------------------------------------------------
-- Atomic write operations (called via the Data API as the signed-in user).
-- SECURITY INVOKER: they run under the caller's RLS policies.
-- ---------------------------------------------------------------------------

create function public.save_configuration(p_id uuid, p_spec jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_t jsonb := p_spec -> 'telescope';
begin
  if p_id is null then
    insert into public.telescope_configurations (name, status, profile_id, aperture_mm, focal_length_mm, optical_design, notes)
    values (
      p_spec ->> 'name',
      p_spec ->> 'status',
      (p_spec ->> 'profileId')::uuid,
      (v_t ->> 'apertureMm')::double precision,
      (v_t ->> 'focalLengthMm')::double precision,
      v_t ->> 'opticalDesign',
      p_spec ->> 'notes'
    )
    returning id into v_id;
  else
    update public.telescope_configurations
    set name = p_spec ->> 'name',
        status = p_spec ->> 'status',
        profile_id = (p_spec ->> 'profileId')::uuid,
        aperture_mm = (v_t ->> 'apertureMm')::double precision,
        focal_length_mm = (v_t ->> 'focalLengthMm')::double precision,
        optical_design = v_t ->> 'opticalDesign',
        notes = p_spec ->> 'notes'
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Configuration not found' using errcode = 'P0002';
    end if;
    delete from public.configuration_components where configuration_id = v_id;
  end if;

  insert into public.configuration_components (configuration_id, component_type, spec)
  select v_id, c.key, c.value
  from jsonb_each(p_spec) c
  where c.key in ('eyepiece', 'camera', 'barlow', 'filter') and jsonb_typeof(c.value) <> 'null';

  return v_id;
end;
$$;

create function public.duplicate_configuration(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.telescope_configurations (name, status, profile_id, aperture_mm, focal_length_mm, optical_design, notes)
  select left(name || ' (copy)', 100), status, profile_id, aperture_mm, focal_length_mm, optical_design, notes
  from public.telescope_configurations
  where id = p_id
  returning id into v_id;
  if v_id is null then
    raise exception 'Configuration not found' using errcode = 'P0002';
  end if;

  insert into public.configuration_components (configuration_id, component_type, spec)
  select v_id, component_type, spec from public.configuration_components where configuration_id = p_id;

  return v_id;
end;
$$;

create function public.create_session(p_session jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_ref jsonb := p_session -> 'configurationRef';
  v_result jsonb := p_session -> 'result';
begin
  insert into public.simulation_sessions (name, target_id, target_snapshot, mode, conditions, exposure, view_settings, simulation_version)
  values (
    p_session ->> 'name',
    p_session -> 'targetSnapshot' ->> 'id',
    p_session -> 'targetSnapshot',
    p_session ->> 'mode',
    coalesce(p_session -> 'conditions', '{}'::jsonb),
    nullif(p_session -> 'exposure', 'null'::jsonb),
    p_session -> 'view',
    p_session ->> 'engineVersion'
  )
  returning id into v_id;

  insert into public.session_configurations (session_id, configuration_id, configuration_version, modified_from_saved, snapshot)
  values (
    v_id,
    (v_ref ->> 'id')::uuid,
    (v_ref ->> 'version')::integer,
    coalesce((v_ref ->> 'modified')::boolean, false),
    p_session -> 'configurationSnapshot'
  );

  insert into public.simulation_results (session_id, engine_version, result, assumptions)
  values (
    v_id,
    v_result ->> 'engineVersion',
    v_result,
    coalesce(array(select jsonb_array_elements_text(v_result -> 'assumptions')), '{}')
  );

  return v_id;
end;
$$;

revoke execute on function public.save_configuration(uuid, jsonb), public.duplicate_configuration(uuid),
  public.create_session(jsonb) from public, anon;
grant execute on function public.save_configuration(uuid, jsonb), public.duplicate_configuration(uuid),
  public.create_session(jsonb) to authenticated;
