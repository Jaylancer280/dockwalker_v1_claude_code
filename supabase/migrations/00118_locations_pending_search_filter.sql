-- Locations V2 — exclude pending + hidden rows from search RPCs
--
-- Wave A (00117) added `'pending'` as a valid `source` value plus
-- `hidden_at timestamptz null` on `cities` and `ports`. The fuzzy-search
-- and top-N RPCs created in 00102 didn't filter by source, so without
-- this migration a manually-requested ("source=pending") row would
-- surface in everyone else's search the moment it's inserted.
--
-- This migration replaces `search_locations` and `top_locations` with
-- versions that filter to `source IN ('curated', 'osm')` and
-- `hidden_at IS NULL` for cities + ports. The submitting user's own
-- profile/posting FK still resolves through `get_locations_by_ids`
-- (intentionally NOT filtered) so they keep seeing the name they typed.
-- Region rows aren't affected because they don't carry `source` or
-- `hidden_at` (no manual-request flow at the region level).

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
          and c.source in ('curated', 'osm')
          and c.hidden_at is null
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
          and p.source in ('curated', 'osm')
          and p.hidden_at is null
      )
    ) results
    order by score desc, name asc
    limit 50
  $$;

grant execute on function public.search_locations(text) to authenticated, anon;

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
    where p.source in ('curated', 'osm')
      and p.hidden_at is null
    order by coalesce(counts.n, 0) desc, p.sort_order asc, p.name asc
    limit greatest(port_limit, 0)
  $$;

grant execute on function public.top_locations(int) to authenticated, anon;
