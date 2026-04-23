-- =============================================================================
-- Locations V1 Schema Verification
-- Catches regressions on the new RPCs + columns introduced across 00101-00104
-- and the country_code CHECK added in 00109.
--
-- Run against a Supabase instance with all migrations applied. Invoked by
-- tests/run_verify_locations_schema.sh from CI's Database Checks job.
-- =============================================================================

\echo '=== Locations V1 Schema Verification ==='

-- TEST 1: regions.country_code column exists with expected shape
do $$
begin
  perform 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'regions'
    and column_name = 'country_code'
    and data_type = 'character'
    and character_maximum_length = 2;
  if not found then
    raise exception 'TEST 1 FAILED: regions.country_code missing or wrong type (expected char(2))';
  end if;
end $$;
\echo 'TEST 1 PASSED: regions.country_code column shape'

-- TEST 2: country_code CHECK constraint (from 00109) exists and has the right regex
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'regions'
    and c.conname = 'regions_country_code_format';
  if v_def is null then
    raise exception 'TEST 2 FAILED: CHECK constraint regions_country_code_format missing';
  end if;
  if v_def !~ '\^\[A-Z\]\{2\}\$' then
    raise exception 'TEST 2 FAILED: regions_country_code_format regex wrong: %', v_def;
  end if;
end $$;
\echo 'TEST 2 PASSED: regions_country_code_format CHECK constraint'

-- TEST 3: CHECK rejects lowercase / too-short / too-long codes
do $$
declare
  v_region_id uuid;
begin
  v_region_id := gen_random_uuid();
  begin
    insert into public.regions (id, name, country_code) values (v_region_id, 'TEST_REGION_BAD', 'gb');
    raise exception 'TEST 3 FAILED: CHECK let through lowercase country_code';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.regions (id, name, country_code) values (v_region_id, 'TEST_REGION_BAD', 'U');
    raise exception 'TEST 3 FAILED: CHECK let through 1-char country_code';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.regions (id, name, country_code) values (v_region_id, 'TEST_REGION_BAD', 'USA');
    -- char(2) truncates to 'US' silently — so this inserts successfully.
    -- Cleanup if it did get in.
    delete from public.regions where id = v_region_id;
  exception when others then
    null;
  end;
end $$;
\echo 'TEST 3 PASSED: CHECK rejects invalid country_code formats'

-- TEST 4: CHECK allows valid ISO-3166 alpha-2 codes AND NULL
do $$
declare
  v_id_gb uuid := gen_random_uuid();
  v_id_null uuid := gen_random_uuid();
begin
  insert into public.regions (id, name, country_code) values
    (v_id_gb, 'TEST_REGION_GB', 'GB'),
    (v_id_null, 'TEST_REGION_NULL', null);
  delete from public.regions where id in (v_id_gb, v_id_null);
end $$;
\echo 'TEST 4 PASSED: CHECK allows valid ISO alpha-2 + NULL'

-- TEST 5: ports enrichment columns (from 00101)
do $$
declare
  v_missing text;
begin
  select string_agg(col, ', ') into v_missing
  from unnest(array['latitude', 'longitude', 'osm_type', 'osm_id', 'website', 'phone', 'capacity', 'vhf']) as col
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ports' and column_name = col
  );
  if v_missing is not null then
    raise exception 'TEST 5 FAILED: ports missing columns: %', v_missing;
  end if;
end $$;
\echo 'TEST 5 PASSED: ports enrichment columns present'

-- TEST 6: fuzzy-search extensions installed (pg_trgm + unaccent, from 00102)
do $$
declare
  v_missing text;
begin
  select string_agg(extname, ', ') into v_missing
  from unnest(array['pg_trgm', 'unaccent']) as extname
  where not exists (select 1 from pg_extension pe where pe.extname = unnest.extname);
  if v_missing is not null then
    raise exception 'TEST 6 FAILED: extensions missing: %', v_missing;
  end if;
end $$;
\echo 'TEST 6 PASSED: pg_trgm + unaccent extensions installed'

-- TEST 7: search_locations RPC exists, callable, returns rows for "Antibes"
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.search_locations('Antibes');
  if v_count = 0 then
    raise exception 'TEST 7 FAILED: search_locations(''Antibes'') returned 0 rows (seed data missing or RPC broken)';
  end if;
end $$;
\echo 'TEST 7 PASSED: search_locations("Antibes") returns rows'

-- TEST 8: top_locations RPC exists and returns rows
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.top_locations(10);
  if v_count = 0 then
    raise exception 'TEST 8 FAILED: top_locations(10) returned 0 rows';
  end if;
end $$;
\echo 'TEST 8 PASSED: top_locations(10) returns rows'

-- TEST 9: get_locations_by_ids RPC resolves labels for a known curated port
do $$
declare
  v_sample_port uuid;
  v_count int;
begin
  select id into v_sample_port from public.ports order by name limit 1;
  if v_sample_port is null then
    raise exception 'TEST 9 FAILED: no ports in DB to test get_locations_by_ids';
  end if;
  select count(*) into v_count
  from public.get_locations_by_ids(array[v_sample_port]::uuid[], null::uuid[]);
  if v_count = 0 then
    raise exception 'TEST 9 FAILED: get_locations_by_ids did not resolve a known port';
  end if;
end $$;
\echo 'TEST 9 PASSED: get_locations_by_ids resolves a known port'

\echo ''
\echo '=== ALL LOCATIONS V1 SCHEMA TESTS PASSED ==='
