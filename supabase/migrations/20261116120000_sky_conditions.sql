-- Sky and location conditions on saved simulations (engine 1.3.0).
-- Additive: existing sessions (seeing only) stay valid.

create function public.is_valid_conditions(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
     and public.json_optional_number_between(c, 'seeingArcsec', 0.1, 20)
     and public.json_optional_number_between(c, 'skyBrightnessMagArcsec2', -5, 23)
     and public.json_optional_number_between(c, 'extinctionMag', 0, 20)
     and public.json_optional_number_between(c, 'airmass', 1, 40)
     and public.json_optional_number_between(c, 'cloudTransmission', 0, 1)
     and public.json_optional_number_between(c, 'targetAltitudeDeg', -90, 90)
$$;

-- Where a session was observed from: optional, coordinates in range, short name.
create function public.is_valid_view_site(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (v -> 'site') is null
      or jsonb_typeof(v -> 'site') = 'null'
      or (
        jsonb_typeof(v -> 'site') = 'object'
        and public.json_number_between(v -> 'site', 'latDeg', -90, 90)
        and public.json_number_between(v -> 'site', 'lonDeg', -180, 180)
        and public.json_optional_text(v -> 'site', 'name', 120)
        and public.json_optional_text(v -> 'site', 'timeZone', 64)
      )
$$;

alter table public.simulation_sessions drop constraint simulation_sessions_conditions_check;
alter table public.simulation_sessions
  add constraint simulation_sessions_conditions_check check (public.is_valid_conditions(conditions));

alter table public.simulation_sessions
  add constraint simulation_sessions_view_site_check check (public.is_valid_view_site(view_settings));
