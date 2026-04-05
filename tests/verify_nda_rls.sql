-- =============================================================================
-- NDA Vessel RLS Verification Test
-- CRITICAL: Must pass before Stage 5 (Daywork Posting) is built on top.
--
-- Run against a Supabase instance with migrations applied.
-- Uses service role to set up test data, then tests RLS as different users.
-- =============================================================================

-- Setup + TEST 1 + TEST 2 (run as postgres/service role)
do $$
declare
  v_owner_id uuid := '00000000-0000-0000-0000-000000000001';
  v_crew_id uuid := '00000000-0000-0000-0000-000000000002';
  v_vessel_id uuid;
  v_imo_visible text;
  v_name_visible text;
begin
  -- Clean up any previous test data
  delete from public.vessels where owner_person_id = v_owner_id;
  delete from public.profiles where person_id in (v_owner_id, v_crew_id);
  delete from public.persons where id in (v_owner_id, v_crew_id);
  delete from auth.users where id in (v_owner_id, v_crew_id);

  -- Create test auth users (required: persons.id FK references auth.users)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) values
    ('00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated', 'nda-test-owner@test.local', crypt('testpass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_crew_id, 'authenticated', 'authenticated', 'nda-test-crew@test.local', crypt('testpass', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  -- Create test persons
  insert into public.persons (id, identity_type, current_hat) values
    (v_owner_id, 'crew', 'employer'),
    (v_crew_id, 'crew', 'crew');

  -- Create test profiles
  insert into public.profiles (person_id, display_name, identity_type) values
    (v_owner_id, 'Test Owner', 'crew'),
    (v_crew_id, 'Test Crew', 'crew');

  -- Create an NDA vessel
  insert into public.vessels (imo_number, name, vessel_type, size_band_id, nda_flag, owner_person_id)
  values (
    '9999999',
    'M/Y Secret',
    'motor',
    'f1000000-0000-0000-0000-000000000003', -- 40-50m
    true,
    v_owner_id
  )
  returning id into v_vessel_id;

  -- =========================================================================
  -- TEST 1: get_vessel_public as crew (non-owner) — IMO must be NULL
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_crew_id::text, true);

  select imo_number, name into v_imo_visible, v_name_visible
  from public.get_vessel_public(v_vessel_id);

  if v_imo_visible is not null then
    raise exception 'TEST FAILED: Crew user can see IMO on NDA vessel! IMO returned: %', v_imo_visible;
  end if;

  if v_name_visible != 'NDA Vessel' then
    raise exception 'TEST FAILED: Crew user can see vessel name on NDA vessel! Name returned: %', v_name_visible;
  end if;

  raise notice 'TEST 1 PASSED: Crew user cannot see IMO or name on NDA vessel';

  -- =========================================================================
  -- TEST 2: get_vessel_public as owner — IMO must be visible
  -- =========================================================================
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  select imo_number, name into v_imo_visible, v_name_visible
  from public.get_vessel_public(v_vessel_id);

  if v_imo_visible is null then
    raise exception 'TEST FAILED: Owner cannot see IMO on their own NDA vessel!';
  end if;

  if v_imo_visible != '9999999' then
    raise exception 'TEST FAILED: Owner sees wrong IMO. Expected 9999999, got: %', v_imo_visible;
  end if;

  raise notice 'TEST 2 PASSED: Owner can see IMO (%) and name (%) on their NDA vessel', v_imo_visible, v_name_visible;

  -- Store vessel_id for TEST 3 (requires SET ROLE, not allowed inside PL/pgSQL)
  perform set_config('test.nda_vessel_id', v_vessel_id::text, false);
  perform set_config('test.nda_crew_id', v_crew_id::text, false);
end $$;

-- =========================================================================
-- TEST 3: Direct table RLS — must run as 'authenticated' role
-- (superuser/postgres bypasses RLS, so SET ROLE is required)
-- =========================================================================
SET ROLE authenticated;
SET request.jwt.claim.sub TO current_setting('test.nda_crew_id');

DO $test3$
DECLARE
  v_vessel_id uuid := current_setting('test.nda_vessel_id')::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.vessels WHERE id = v_vessel_id) THEN
    RAISE EXCEPTION 'TEST FAILED: Crew user can directly query NDA vessel from vessels table!';
  END IF;
  RAISE NOTICE 'TEST 3 PASSED: Crew user cannot directly access NDA vessel via table RLS';
END $test3$;

RESET ROLE;

-- =========================================================================
-- Cleanup (runs as postgres after RESET ROLE)
-- =========================================================================
DO $cleanup$
DECLARE
  v_owner_id uuid := '00000000-0000-0000-0000-000000000001';
  v_crew_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  delete from public.vessels where owner_person_id = v_owner_id;
  delete from public.profiles where person_id in (v_owner_id, v_crew_id);
  delete from public.persons where id in (v_owner_id, v_crew_id);
  delete from auth.users where id in (v_owner_id, v_crew_id);
  RAISE NOTICE '=== ALL NDA RLS TESTS PASSED ===';
END $cleanup$;
