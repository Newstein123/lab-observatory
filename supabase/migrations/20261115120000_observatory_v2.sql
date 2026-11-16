-- Universal Observatory v2: equipment status and identity, an accessory
-- inventory (eyepieces, cameras, Barlows, filters, mounts), mounts and
-- catalogue references on configurations, and observation projects.
-- Additive only: existing rows keep their meaning (profiles default to owned).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.json_optional_boolean(s jsonb, key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (s -> key) is null or jsonb_typeof(s -> key) in ('null', 'boolean')
$$;

-- Adds descriptive optional fields and the mount type. Same signature, so the
-- existing CHECK constraint picks up the new definition.
create or replace function public.is_valid_component(component_type text, spec jsonb)
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
      and public.json_optional_number_between(spec, 'barrelIn', 1.25, 2)
      and public.json_optional_number_between(spec, 'eyeReliefMm', 1, 50)
      and public.json_optional_text(spec, 'label', 100)
    when 'camera' then
          public.json_number_between(spec, 'sensorWidthMm', 1, 100)
      and public.json_number_between(spec, 'sensorHeightMm', 1, 100)
      and public.json_number_between(spec, 'pixelSizeUm', 0.5, 30)
      and public.json_optional_number_between(spec, 'resolutionX', 1, 100000)
      and public.json_optional_number_between(spec, 'resolutionY', 1, 100000)
      and public.json_optional_boolean(spec, 'color')
      and public.json_optional_text(spec, 'label', 100)
    when 'barlow' then
          public.json_number_between(spec, 'factor', 1, 5)
      and public.json_optional_number_between(spec, 'barrelIn', 1.25, 2)
      and public.json_optional_text(spec, 'label', 100)
    when 'filter' then
          jsonb_typeof(spec -> 'name') = 'string'
      and char_length(spec ->> 'name') between 1 and 100
      and ((spec -> 'kind') is null or (spec ->> 'kind') in
            ('neutral_density', 'uhc', 'oiii', 'light_pollution', 'color_blue', 'color_orange', 'other'))
    when 'mount' then
          (spec ->> 'type') in ('alt_azimuth', 'equatorial', 'dobsonian', 'goto')
      and public.json_optional_number_between(spec, 'payloadKg', 0.1, 1000)
      and public.json_optional_boolean(spec, 'goto')
      and public.json_optional_boolean(spec, 'tracking')
      and public.json_optional_text(spec, 'label', 100)
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Telescope profiles: status and identification metadata.
-- ---------------------------------------------------------------------------

alter table public.telescope_profiles
  add column status text not null default 'owned' check (status in ('owned', 'experimental', 'planned')),
  add column manufacturer text check (char_length(manufacturer) <= 100),
  add column model text check (char_length(model) <= 100),
  add column notes text check (char_length(notes) <= 2000);

-- ---------------------------------------------------------------------------
-- Configurations: telescope label, catalogue reference and a mount component.
-- ---------------------------------------------------------------------------

alter table public.telescope_configurations
  add column telescope_label text check (char_length(telescope_label) <= 100),
  add column catalog_ref text check (char_length(catalog_ref) between 1 and 100);

alter table public.configuration_components
  drop constraint configuration_components_component_type_check,
  add constraint configuration_components_component_type_check
    check (component_type in ('eyepiece', 'camera', 'barlow', 'filter', 'mount'));

create or replace function public.save_configuration(p_id uuid, p_spec jsonb)
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
    insert into public.telescope_configurations
      (name, status, profile_id, catalog_ref, aperture_mm, focal_length_mm, optical_design, telescope_label, notes)
    values (
      p_spec ->> 'name',
      p_spec ->> 'status',
      (p_spec ->> 'profileId')::uuid,
      p_spec ->> 'catalogRef',
      (v_t ->> 'apertureMm')::double precision,
      (v_t ->> 'focalLengthMm')::double precision,
      v_t ->> 'opticalDesign',
      v_t ->> 'label',
      p_spec ->> 'notes'
    )
    returning id into v_id;
  else
    update public.telescope_configurations
    set name = p_spec ->> 'name',
        status = p_spec ->> 'status',
        profile_id = (p_spec ->> 'profileId')::uuid,
        catalog_ref = p_spec ->> 'catalogRef',
        aperture_mm = (v_t ->> 'apertureMm')::double precision,
        focal_length_mm = (v_t ->> 'focalLengthMm')::double precision,
        optical_design = v_t ->> 'opticalDesign',
        telescope_label = v_t ->> 'label',
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
  where c.key in ('eyepiece', 'camera', 'barlow', 'filter', 'mount') and jsonb_typeof(c.value) <> 'null';

  return v_id;
end;
$$;

create or replace function public.duplicate_configuration(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.telescope_configurations
    (name, status, profile_id, catalog_ref, aperture_mm, focal_length_mm, optical_design, telescope_label, notes)
  select left(name || ' (copy)', 100), status, profile_id, catalog_ref, aperture_mm, focal_length_mm, optical_design,
         telescope_label, notes
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

-- ---------------------------------------------------------------------------
-- Accessory inventory.
-- ---------------------------------------------------------------------------

create table public.accessories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('eyepiece', 'camera', 'barlow', 'filter', 'mount')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  status text not null check (status in ('owned', 'experimental', 'planned')),
  manufacturer text check (char_length(manufacturer) <= 100),
  model text check (char_length(model) <= 100),
  notes text check (char_length(notes) <= 2000),
  spec jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accessories_valid_spec check (public.is_valid_component(kind, spec))
);

create index accessories_owner_created_idx on public.accessories (owner_id, created_at desc);

create trigger accessories_set_updated_at
  before update on public.accessories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Observation projects. Sessions join through project_sessions so sessions
-- themselves stay immutable.
-- ---------------------------------------------------------------------------

create table public.observation_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (char_length(description) <= 2000),
  target_ids text[] not null default '{}' check (cardinality(target_ids) <= 50 and array_position(target_ids, null) is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index observation_projects_owner_created_idx on public.observation_projects (owner_id, created_at desc);

create trigger observation_projects_set_updated_at
  before update on public.observation_projects
  for each row execute function public.set_updated_at();

create table public.project_sessions (
  project_id uuid not null references public.observation_projects (id) on delete cascade,
  session_id uuid not null references public.simulation_sessions (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, session_id)
);

create index project_sessions_session_idx on public.project_sessions (session_id);

-- ---------------------------------------------------------------------------
-- Row-level security.
-- ---------------------------------------------------------------------------

alter table public.accessories enable row level security;
alter table public.observation_projects enable row level security;
alter table public.project_sessions enable row level security;

create policy "Owners manage their accessories" on public.accessories
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their projects" on public.observation_projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Both the project and the session must belong to the caller.
create policy "Owners read their project sessions" on public.project_sessions
  for select to authenticated
  using (exists (select 1 from public.observation_projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners add their sessions to their projects" on public.project_sessions
  for insert to authenticated
  with check (
    exists (select 1 from public.observation_projects p where p.id = project_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.simulation_sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
  );
create policy "Owners remove sessions from their projects" on public.project_sessions
  for delete to authenticated
  using (exists (select 1 from public.observation_projects p where p.id = project_id and p.owner_id = (select auth.uid())));

revoke all on public.accessories, public.observation_projects, public.project_sessions from anon;
revoke update on public.project_sessions from authenticated;
