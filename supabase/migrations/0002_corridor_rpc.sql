-- Bobby Billiards — spatial corridor matching RPC.
--
-- Given an active route polyline (WKT LINESTRING, lng/lat WGS84) and a buffer
-- distance in meters, return every venue whose location intersects the buffered
-- corridor, ordered by distance from the route. ST_DWithin on the geography
-- type uses the GIST index on venues.coordinates, so this stays fast even at
-- continental scale.

create or replace function public.get_venues_in_corridor(
  route_polyline text,
  buffer_meters double precision default 5000
)
returns table (
  id uuid,
  name text,
  phone text,
  hours jsonb,
  rating numeric,
  lat double precision,
  lng double precision,
  cloth_quality text,
  pocket_widths text,
  cue_spacing text,
  is_verified boolean,
  table_specifications jsonb,
  distance_from_route_m double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with route as (
    select st_geogfromtext('SRID=4326;' || route_polyline) as line
  )
  select
    v.id,
    v.name,
    v.phone,
    v.hours,
    v.rating,
    st_y(v.coordinates::geometry) as lat,
    st_x(v.coordinates::geometry) as lng,
    v.cloth_quality,
    v.pocket_widths,
    v.cue_spacing,
    v.is_verified,
    v.table_specifications,
    st_distance(v.coordinates, route.line) as distance_from_route_m
  from public.venues v
  cross join route
  where st_dwithin(v.coordinates, route.line, buffer_meters)
  order by distance_from_route_m asc;
$$;

comment on function public.get_venues_in_corridor is
  'Returns venues intersecting the corridor formed by buffering the given WKT LINESTRING route by buffer_meters.';

-- Anyone (anon or authenticated) may run corridor searches.
grant execute on function public.get_venues_in_corridor(text, double precision) to anon, authenticated;
