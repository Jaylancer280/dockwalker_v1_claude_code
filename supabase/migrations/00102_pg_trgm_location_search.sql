-- Locations V1 — fuzzy search infrastructure
--
-- Enables pg_trgm + unaccent extensions, adds an IMMUTABLE wrapper around
-- unaccent (required because pg_trgm GIN indexes demand an IMMUTABLE
-- expression), builds trigram indexes on regions/cities/ports names, and
-- exposes a `search_locations(q text)` RPC that returns the top-50 matches
-- across all three tables ranked by trigram similarity.

create extension if not exists unaccent with schema public;
create extension if not exists pg_trgm with schema public;

-- unaccent() is STABLE (volatility depends on the underlying dictionary),
-- so PostgreSQL refuses to use it inside a GIN index. Wrap it in an
-- IMMUTABLE function — safe here because the dockwalker schema loads the
-- unaccent dictionary once and never mutates it at runtime.
create or replace function public.immutable_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
  as $$
    select public.unaccent('public.unaccent', $1)
  $$;

-- Trigram indexes. Lower-cased + unaccented so the query-side match uses
-- the same normalisation.
create index if not exists idx_regions_name_trgm
  on public.regions
  using gin (public.immutable_unaccent(lower(name)) gin_trgm_ops);

create index if not exists idx_cities_name_trgm
  on public.cities
  using gin (public.immutable_unaccent(lower(name)) gin_trgm_ops);

create index if not exists idx_ports_name_trgm
  on public.ports
  using gin (public.immutable_unaccent(lower(name)) gin_trgm_ops);

-- Unified search RPC: union across regions / cities / ports, ranked by
-- similarity score. Requires at least 2 characters in the needle; returns
-- up to 50 rows ordered by score DESC, then alphabetical for ties.
create or replace function public.search_locations(q text)
  returns table (
    id           uuid,
    kind         text,
    name         text,
    parent_id    uuid,
    parent_name  text,
    country_code char(2),
    score        real
  )
  language sql
  stable
  parallel safe
  as $$
    with needle as (
      select public.immutable_unaccent(lower(coalesce(nullif(trim(q), ''), ''))) as n
    )
    select * from (
      (
        select
          r.id,
          'region'::text as kind,
          r.name,
          null::uuid as parent_id,
          null::text as parent_name,
          r.country_code,
          similarity(public.immutable_unaccent(lower(r.name)), (select n from needle)) as score
        from public.regions r, needle
        where length(needle.n) >= 2
          and public.immutable_unaccent(lower(r.name)) % needle.n
      )
      union all
      (
        select
          c.id,
          'city'::text as kind,
          c.name,
          c.region_id as parent_id,
          reg.name as parent_name,
          reg.country_code,
          similarity(public.immutable_unaccent(lower(c.name)), (select n from needle)) as score
        from public.cities c
        left join public.regions reg on reg.id = c.region_id, needle
        where length(needle.n) >= 2
          and public.immutable_unaccent(lower(c.name)) % needle.n
      )
      union all
      (
        select
          p.id,
          'port'::text as kind,
          p.name,
          p.city_id as parent_id,
          c.name as parent_name,
          reg.country_code,
          similarity(public.immutable_unaccent(lower(p.name)), (select n from needle)) as score
        from public.ports p
        left join public.cities c on c.id = p.city_id
        left join public.regions reg on reg.id = c.region_id, needle
        where length(needle.n) >= 2
          and public.immutable_unaccent(lower(p.name)) % needle.n
      )
    ) results
    order by score desc, name asc
    limit 50
  $$;

grant execute on function public.search_locations(text) to authenticated, anon;

-- Label resolver: given arrays of port_ids and city_ids, return their full
-- display labels in a single round-trip. Used by LocationPicker to hydrate
-- a selected UUID into "Port Vauban - Antibes, France".
create or replace function public.get_locations_by_ids(
  port_ids uuid[],
  city_ids uuid[]
)
  returns table (
    id           uuid,
    kind         text,
    name         text,
    city_id      uuid,
    city_name    text,
    region_id    uuid,
    region_name  text,
    country_code char(2)
  )
  language sql
  stable
  parallel safe
  as $$
    select
      p.id,
      'port'::text as kind,
      p.name,
      p.city_id,
      c.name as city_name,
      c.region_id,
      reg.name as region_name,
      reg.country_code
    from public.ports p
    left join public.cities c on c.id = p.city_id
    left join public.regions reg on reg.id = c.region_id
    where p.id = any(coalesce(port_ids, array[]::uuid[]))
    union all
    select
      c.id,
      'city'::text as kind,
      c.name,
      null::uuid as city_id,
      null::text as city_name,
      c.region_id,
      reg.name as region_name,
      reg.country_code
    from public.cities c
    left join public.regions reg on reg.id = c.region_id
    where c.id = any(coalesce(city_ids, array[]::uuid[]))
  $$;

grant execute on function public.get_locations_by_ids(uuid[], uuid[]) to authenticated, anon;

-- Top ports RPC: returns the top-N most-frequently-referenced ports across
-- profiles.location_port_id, dayworks.location_port_id,
-- permanent_postings.port_id. Used as the picker's empty-state list.
--
-- Until the marina import lands (~15-25K ports), the reference counts will
-- be mostly zero on new ports, and sort_order is the more meaningful
-- ordering within curated launch hubs. We sort by (usage_count desc,
-- sort_order asc) so curated hubs surface first while still letting real
-- usage data take over once crew + employers build up activity.
create or replace function public.top_locations(port_limit int)
  returns table (
    id           uuid,
    name         text,
    city_id      uuid,
    city_name    text,
    region_id    uuid,
    region_name  text,
    country_code char(2),
    usage_count  bigint
  )
  language sql
  stable
  parallel safe
  as $$
    with usage as (
      select location_port_id as port_id from public.profiles where location_port_id is not null
      union all
      select location_port_id from public.dayworks where location_port_id is not null
      union all
      select port_id from public.permanent_postings where port_id is not null
    ),
    counts as (
      select port_id, count(*)::bigint as n
      from usage
      group by port_id
    )
    select
      p.id,
      p.name,
      p.city_id,
      c.name as city_name,
      c.region_id,
      reg.name as region_name,
      reg.country_code,
      coalesce(counts.n, 0) as usage_count
    from public.ports p
    left join public.cities c on c.id = p.city_id
    left join public.regions reg on reg.id = c.region_id
    left join counts on counts.port_id = p.id
    order by coalesce(counts.n, 0) desc, p.sort_order asc, p.name asc
    limit greatest(port_limit, 0)
  $$;

grant execute on function public.top_locations(int) to authenticated, anon;
