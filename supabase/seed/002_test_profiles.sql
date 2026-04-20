-- =============================================================================
-- Test profiles for local development — NOT for production
-- =============================================================================
--
-- Employer "Hein van der Merwe"  → e@1 / 87654321  (hat: employer, Captain)
-- Crew     "James Thornton"      → c@1 / 87654321  (hat: crew, Deckhand)
-- Crew     "Sophie Laurent"      → g@1 / 87654321  (hat: crew, Stewardess)
-- Unboarded                      → d@1 / 87654321  (auth only, no onboarding)
-- Agent    "Victoria Chase"      → a@1 / 87654321  (hat: agent, Meridian Yacht Crew)
--
-- Includes: vessels, crew availability, crew experience, agent vessel + postings
-- =============================================================================

-- Fixed UUIDs for deterministic seeding
-- Employer user:  11111111-1111-1111-1111-111111111111
-- Crew user:      22222222-2222-2222-2222-222222222222
-- Crew user 2:    77777777-7777-7777-7777-777777777777
-- Unboarded user: 88888888-8888-8888-8888-888888888888
-- Agent user:     99999999-9999-9999-9999-999999999999
-- Vessel 1:       33333333-3333-3333-3333-333333333333  (M/Y Serenity, 65m, employer)
-- Vessel 2:       33333333-3333-3333-3333-333333333334  (M/Y Phantom, 45m, NDA, employer)
-- Empl vessel 3:  33333333-3333-3333-3333-333333333335  (S/Y Wanderer, 35m, employer)
-- Crew vessel 1:  33333333-3333-3333-3333-33333333333a  (S/Y Wanderer, 35m, crew-owned copy)
-- Crew vessel 2:  33333333-3333-3333-3333-33333333333b  (M/Y Serenity, 65m, crew-owned copy)
-- Crew vessel 3:  33333333-3333-3333-3333-33333333333c  (M/Y Phantom, 45m, crew-owned copy)
-- g@1 vessel:     33333333-3333-3333-3333-333333333338  (M/Y Azure Dream, 40m)
-- Agent vessel:   33333333-3333-3333-3333-333333333339  (M/Y Meridian, 55m)

-- ========================= AUTH USERS =========================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'e@1',
  crypt('87654321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'c@1',
  crypt('87654321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-7777-7777-777777777777',
  'authenticated', 'authenticated',
  'g@1',
  crypt('87654321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888',
  'authenticated', 'authenticated',
  'd@1',
  crypt('87654321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-9999-9999-999999999999',
  'authenticated', 'authenticated',
  'a@1',
  crypt('87654321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
);

-- Auth identities (required for email login to work)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'e@1',
  '{"sub": "11111111-1111-1111-1111-111111111111", "email": "e@1"}'::jsonb,
  'email',
  now(), now(), now()
), (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'c@1',
  '{"sub": "22222222-2222-2222-2222-222222222222", "email": "c@1"}'::jsonb,
  'email',
  now(), now(), now()
), (
  '77777777-7777-7777-7777-777777777777',
  '77777777-7777-7777-7777-777777777777',
  'g@1',
  '{"sub": "77777777-7777-7777-7777-777777777777", "email": "g@1"}'::jsonb,
  'email',
  now(), now(), now()
), (
  '88888888-8888-8888-8888-888888888888',
  '88888888-8888-8888-8888-888888888888',
  'd@1',
  '{"sub": "88888888-8888-8888-8888-888888888888", "email": "d@1"}'::jsonb,
  'email',
  now(), now(), now()
), (
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999999',
  'a@1',
  '{"sub": "99999999-9999-9999-9999-999999999999", "email": "a@1"}'::jsonb,
  'email',
  now(), now(), now()
);

-- ========================= ONBOARD EMPLOYER =========================
-- Hein van der Merwe: South African Captain, 15yr experience, Port Vauban Antibes

select public.onboard_person(
  'crew',
  'employer',
  jsonb_build_object(
    'display_name', 'Hein van der Merwe',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000001',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005","e0000000-0000-0000-0000-000000000011","e0000000-0000-0000-0000-000000000012","e0000000-0000-0000-0000-000000000010"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000005',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000004","f1000000-0000-0000-0000-000000000005","f1000000-0000-0000-0000-000000000006"]'::jsonb,
    'bio', 'Captain with 15 years in the superyacht industry. Currently managing a 65m M/Y based in the Med. Looking for reliable dayworkers for the upcoming charter season.',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'avatar_url', '/images/dw-system-avatar.png',
    'nationality_id', (select id from public.nationalities where country_code = 'ZA'),
    'entry_right_ids', (select jsonb_agg(id) from public.entry_rights where name in ('Schengen visa', 'US B1/B2'))
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= ONBOARD CREW =========================
-- James Thornton: British Deckhand, 3yr experience, Port Vauban Antibes

select public.onboard_person(
  'crew',
  'crew',
  jsonb_build_object(
    'display_name', 'James Thornton',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000006',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005","e0000000-0000-0000-0000-000000000007","e0000000-0000-0000-0000-000000000008","e0000000-0000-0000-0000-000000000019","e0000000-0000-0000-0000-000000000020"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000002","f1000000-0000-0000-0000-000000000003","f1000000-0000-0000-0000-000000000004"]'::jsonb,
    'bio', 'Qualified deckhand with 3 years on yachts ranging from 30-60m. PADI Divemaster, Powerboat Level 2. Available for daywork in the Antibes/Cannes area.',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'avatar_url', '/images/dw-system-avatar.png',
    'nationality_id', (select id from public.nationalities where country_code = 'GB'),
    'entry_right_ids', (select jsonb_agg(id) from public.entry_rights where name in ('Schengen visa'))
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= EMPLOYER VESSELS =========================

-- Vessel 1: M/Y Serenity — 65m charter vessel, public
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333333',
  'vessel',
  'employer',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333333',
    'imo_number', '9876543',
    'name', 'Serenity',
    'vessel_type', 'motor',
    'vessel_operation', 'charter',
    'size_band_id', 'f1000000-0000-0000-0000-000000000005',
    'loa_meters', 65,
    'nda_flag', false
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Vessel 2: M/Y Phantom — 45m private vessel, NDA
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333334',
  'vessel',
  'employer',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333334',
    'imo_number', '9876544',
    'name', 'Phantom',
    'vessel_type', 'motor',
    'vessel_operation', 'private',
    'size_band_id', 'f1000000-0000-0000-0000-000000000003',
    'loa_meters', 45,
    'nda_flag', true
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Vessel 3: S/Y Wanderer — 35m sail vessel (employer-owned, used in DW-03)
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333335',
  'vessel',
  'employer',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333335',
    'imo_number', '9876545',
    'name', 'Wanderer',
    'vessel_type', 'sail',
    'vessel_operation', 'charter',
    'size_band_id', 'f1000000-0000-0000-0000-000000000002',
    'loa_meters', 35,
    'nda_flag', false
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= CREW-OWNED VESSELS (for James's experiences) =========================
-- Per architectural rule: crew must own vessel copies used in their experience entries.
-- Same IMOs as employer vessels, different UUIDs, owned by crew.

-- Crew copy of S/Y Wanderer (35m sail)
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-33333333333a',
  'vessel',
  'crew',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-33333333333a',
    'imo_number', '9876545',
    'name', 'Wanderer',
    'vessel_type', 'sail',
    'size_band_id', 'f1000000-0000-0000-0000-000000000002',
    'loa_meters', 35,
    'nda_flag', false
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Crew copy of M/Y Serenity (65m motor)
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-33333333333b',
  'vessel',
  'crew',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-33333333333b',
    'imo_number', '9876543',
    'name', 'Serenity',
    'vessel_type', 'motor',
    'size_band_id', 'f1000000-0000-0000-0000-000000000005',
    'loa_meters', 65,
    'nda_flag', false
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Crew copy of M/Y Phantom (45m motor)
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-33333333333c',
  'vessel',
  'crew',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-33333333333c',
    'imo_number', '9876544',
    'name', 'Phantom',
    'vessel_type', 'motor',
    'size_band_id', 'f1000000-0000-0000-0000-000000000003',
    'loa_meters', 45,
    'nda_flag', false
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= CREW AVAILABILITY (next 14 days in Antibes) =========================

select public.append_event(
  'AVAILABILITY.SET',
  '22222222-2222-2222-2222-222222222222',
  'person',
  'crew',
  jsonb_build_object(
    'start_date', current_date,
    'end_date', (current_date + interval '13 days')::date,
    'expires_at', (now() + interval '7 days')::timestamptz,
    'city_id', 'b0000000-0000-0000-0000-000000000001',
    'port_id', 'c0000000-0000-0000-0000-000000000001'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= ONBOARD CREW 2 (g@1) =========================
-- Sophie Laurent: French Stewardess, 8mo experience, Palma

select public.onboard_person(
  'crew',
  'crew',
  jsonb_build_object(
    'display_name', 'Sophie Laurent',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000014',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000003"]'::jsonb,
    'bio', 'Stewardess with 8 months experience on a 40m M/Y. STCW and ENG1 certified. Based in Palma, looking for daywork and permanent positions.',
    'location_port_id', 'c0000000-0000-0000-0000-000000000008',
    'avatar_url', '/images/dw-system-avatar.png',
    'nationality_id', (select id from public.nationalities where country_code = 'FR'),
    'entry_right_ids', (select jsonb_agg(id) from public.entry_rights where name in ('Schengen visa'))
  ),
  '77777777-7777-7777-7777-777777777777'
);

-- Sophie's vessel: M/Y Azure Dream (40m motor)
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333338',
  'vessel',
  'crew',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333338',
    'imo_number', '9876548',
    'name', 'Azure Dream',
    'vessel_type', 'motor',
    'size_band_id', 'f1000000-0000-0000-0000-000000000003',
    'loa_meters', 40,
    'nda_flag', false
  ),
  '77777777-7777-7777-7777-777777777777'
);

-- Sophie's experience: Stewardess on M/Y Azure Dream, 8 months
insert into public.crew_experiences (
  id, person_id, vessel_id, role_id,
  start_date, end_date, is_current, vessel_operation,
  flag_state, contract_type, description
) values (
  'aa000000-0000-0000-0000-000000000003',
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333338',
  'd0000000-0000-0000-0000-000000000014',
  (current_date - interval '12 months')::date,
  (current_date - interval '4 months')::date,
  false, 'charter', 'MLT', 'seasonal',
  'Interior service during busy Med charter season — silver service, table setting, laundry, guest cabins.'
);

select public.derive_experience_profile('77777777-7777-7777-7777-777777777777');

-- Sophie's daywork availability: next 14 days in Palma
select public.append_event(
  'AVAILABILITY.SET',
  '77777777-7777-7777-7777-777777777777',
  'person',
  'crew',
  jsonb_build_object(
    'start_date', current_date,
    'end_date', (current_date + interval '13 days')::date,
    'expires_at', (now() + interval '7 days')::timestamptz,
    'city_id', 'b0000000-0000-0000-0000-000000000004',
    'port_id', 'c0000000-0000-0000-0000-000000000008'
  ),
  '77777777-7777-7777-7777-777777777777'
);

-- Sophie's permanent availability: immediate
select public.append_event(
  'PROFILE.UPDATED',
  '77777777-7777-7777-7777-777777777777',
  'person',
  'crew',
  jsonb_build_object(
    'permanent_availability', 'immediate',
    'currently_employed', false
  ),
  '77777777-7777-7777-7777-777777777777'
);

-- ========================= ONBOARD AGENT (a@1) =========================
-- Victoria Chase: Agency agent, Meridian Yacht Crew, Fort Lauderdale

select public.onboard_person(
  'agent',
  'agent',
  jsonb_build_object(
    'display_name', 'Victoria Chase',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000001',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000005',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000003","f1000000-0000-0000-0000-000000000004","f1000000-0000-0000-0000-000000000005"]'::jsonb,
    'bio', 'Senior crew placement agent with 10 years in the superyacht industry. Managing a portfolio of 12 vessels across the Med and Caribbean. Specialising in deck and engineering placements.',
    'agency_name', 'Meridian Yacht Crew',
    'location_port_id', 'c0000000-0000-0000-0000-000000000020',
    'avatar_url', '/images/dw-system-avatar.png',
    'nationality_id', (select id from public.nationalities where country_code = 'GB'),
    'entry_right_ids', (select jsonb_agg(id) from public.entry_rights where name in ('Schengen visa', 'US B1/B2'))
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- Agent vessel: M/Y Meridian — 55m charter vessel
select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333339',
  'vessel',
  'agent',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333339',
    'imo_number', '9876549',
    'name', 'Meridian',
    'vessel_type', 'motor',
    'vessel_operation', 'charter',
    'size_band_id', 'f1000000-0000-0000-0000-000000000004',
    'loa_meters', 55,
    'nda_flag', false
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- Agent maritime background: past Captain experience
insert into public.crew_experiences (
  id, person_id, vessel_id, role_id,
  start_date, end_date, is_current, vessel_operation,
  flag_state, contract_type, description
) values (
  'aa000000-0000-0000-0000-000000000004',
  '99999999-9999-9999-9999-999999999999',
  '33333333-3333-3333-3333-333333333339',
  'd0000000-0000-0000-0000-000000000001',
  (current_date - interval '8 years')::date,
  (current_date - interval '3 years')::date,
  false, 'charter', 'CYM', 'permanent',
  'Captain on M/Y Meridian for 5 years before transitioning to crew agency work. Western Med and Caribbean circuits.'
);

select public.derive_experience_profile('99999999-9999-9999-9999-999999999999');

-- ========================= AGENT DAYWORK POSTINGS =========================
-- Agent posts daywork on behalf of vessel owners — diversifies discover feed

-- Agent DW: Deckhand on M/Y Meridian, day +18, Port Vauban
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-44444444a001',
  'daywork',
  'agent',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444a001',
    'vessel_id', '33333333-3333-3333-3333-333333333339',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '18 days')::date,
    'end_date', (current_date + interval '19 days')::date,
    'working_days', 2,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 280,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Deck prep for guest turnaround. Cleaning, polishing, tender check. 0800 start.'
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- Agent DW: Stewardess on M/Y Meridian, day +25, Port Hercules Monaco
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-44444444a002',
  'daywork',
  'agent',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444a002',
    'vessel_id', '33333333-3333-3333-3333-333333333339',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date + interval '25 days')::date,
    'end_date', (current_date + interval '27 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000001',
    'day_rate', 220,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Charter guest turnaround — deep clean, linen change, provisioning stow. Service experience preferred.'
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- ========================= AGENT PERMANENT POSTINGS =========================

-- Agent PM: First Officer on M/Y Meridian, Port Vauban
select public.append_event(
  'PERMANENT.POSTED',
  '44444444-4444-4444-4444-44444444a003',
  'permanent',
  'agent',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444a003',
    'vessel_id', '33333333-3333-3333-3333-333333333339',
    'role_id', 'd0000000-0000-0000-0000-000000000002',
    'port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '30 days')::date,
    'salary_min', 5500,
    'salary_max', 7000,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005","e0000000-0000-0000-0000-000000000011"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'live_aboard', true,
    'shortlist_cap', 5,
    'notes', 'Seeking experienced First Officer for permanent position on 55m charter yacht. Full Med season commitment required.'
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- Agent PM: Chief Stewardess on M/Y Meridian, Port Hercules
select public.append_event(
  'PERMANENT.POSTED',
  '44444444-4444-4444-4444-44444444a004',
  'permanent',
  'agent',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444a004',
    'vessel_id', '33333333-3333-3333-3333-333333333339',
    'role_id', 'd0000000-0000-0000-0000-000000000013',
    'port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date + interval '45 days')::date,
    'salary_min', 4500,
    'salary_max', 5500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'live_aboard', true,
    'shortlist_cap', 5,
    'notes', 'Chief Stew for busy charter programme. Silver service essential. Team of 4 interior staff.'
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- Agent PM: Second Engineer on M/Y Meridian, Fort Lauderdale
select public.append_event(
  'PERMANENT.POSTED',
  '44444444-4444-4444-4444-44444444a005',
  'permanent',
  'agent',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444a005',
    'vessel_id', '33333333-3333-3333-3333-333333333339',
    'role_id', 'd0000000-0000-0000-0000-000000000008',
    'port_id', 'c0000000-0000-0000-0000-000000000020',
    'start_date', (current_date - interval '3 days')::date,
    'salary_min', 4000,
    'salary_max', 5000,
    'salary_currency', 'USD',
    'salary_period', 'monthly',
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000009","e0000000-0000-0000-0000-000000000010"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'live_aboard', true,
    'shortlist_cap', 3,
    'notes', 'Second Engineer for 55m MTU-powered charter yacht. Caribbean winter, Med summer rotation.'
  ),
  '99999999-9999-9999-9999-999999999999'
);

-- ========================= USER 4 (d@1) — NO ONBOARDING =========================
-- Auth user exists but NO events, NO person row, NO profile.
-- App middleware should redirect to onboarding.
