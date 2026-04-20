-- Rollback for 00102_pg_trgm_location_search.sql
--
-- Drops the search RPCs, label resolver, top-locations RPC, trigram indexes,
-- and the immutable_unaccent wrapper. Leaves the pg_trgm + unaccent
-- extensions installed (they are cheap and other features may adopt them).
-- Self-contained — no manual steps.

drop function if exists public.top_locations(int);
drop function if exists public.get_locations_by_ids(uuid[], uuid[]);
drop function if exists public.search_locations(text);

drop index if exists public.idx_ports_name_trgm;
drop index if exists public.idx_cities_name_trgm;
drop index if exists public.idx_regions_name_trgm;

drop function if exists public.immutable_unaccent(text);
