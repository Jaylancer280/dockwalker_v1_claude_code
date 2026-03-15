-- =============================================================================
-- Test profiles for local development — NOT for production
-- =============================================================================
--
-- Employer "Profile One"  → e@1 / 87654321  (hat: employer)
-- Crew     "Profile Two"  → c@1 / 87654321  (hat: crew)
--
-- Includes: 2 vessels (1 NDA), crew availability, crew experience
-- =============================================================================

-- Fixed UUIDs for deterministic seeding
-- Employer user:  11111111-1111-1111-1111-111111111111
-- Crew user:      22222222-2222-2222-2222-222222222222
-- Vessel 1:       33333333-3333-3333-3333-333333333333  (M/Y Serenity, 65m, charter)
-- Vessel 2:       33333333-3333-3333-3333-333333333334  (M/Y Phantom, 45m, private, NDA)
-- Crew exp vessel: 33333333-3333-3333-3333-333333333335 (S/Y Wanderer, 35m)

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
);

-- ========================= ONBOARD EMPLOYER =========================
-- identity_type: crew (can switch hats), current_hat: employer
-- Profile One: experienced Captain based in Port Vauban, Antibes

select public.onboard_person(
  'crew',
  'employer',
  jsonb_build_object(
    'display_name', 'Profile One',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000001',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005","e0000000-0000-0000-0000-000000000011","e0000000-0000-0000-0000-000000000012","e0000000-0000-0000-0000-000000000010"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000005',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000004","f1000000-0000-0000-0000-000000000005","f1000000-0000-0000-0000-000000000006"]'::jsonb,
    'bio', 'Experienced Captain with 15 years in the superyacht industry. Currently managing a 65m M/Y based in the Med. Looking for reliable dayworkers for upcoming charter season.',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= ONBOARD CREW =========================
-- identity_type: crew, current_hat: crew
-- Profile Two: mid-level Deckhand based in Port Vauban, Antibes

select public.onboard_person(
  'crew',
  'crew',
  jsonb_build_object(
    'display_name', 'Profile Two',
    'primary_role_id', 'd0000000-0000-0000-0000-000000000006',
    'certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005","e0000000-0000-0000-0000-000000000007","e0000000-0000-0000-0000-000000000008","e0000000-0000-0000-0000-000000000019","e0000000-0000-0000-0000-000000000020"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'vessel_size_exposure_ids', '["f1000000-0000-0000-0000-000000000002","f1000000-0000-0000-0000-000000000003","f1000000-0000-0000-0000-000000000004"]'::jsonb,
    'bio', 'Qualified deckhand with 3 years on yachts ranging from 30-60m. PADI Divemaster, Powerboat Level 2. Available for daywork in the Antibes/Cannes area.',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= VESSELS (owned by employer) =========================

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

-- Vessel 3: S/Y Wanderer — 35m sail vessel for crew experience history
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

-- ========================= CREW EXPERIENCE (Profile Two) =========================
-- Direct inserts (experience aggregate_type not in events check constraint)

-- Past experience 1: Deckhand on S/Y Wanderer, 6 months ago for 4 months
insert into public.crew_experiences (
  id, person_id, vessel_id, role_id,
  start_date, end_date, is_current, vessel_operation,
  flag_state, contract_type, description
) values (
  'aa000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333335',
  'd0000000-0000-0000-0000-000000000006',
  (current_date - interval '10 months')::date,
  (current_date - interval '6 months')::date,
  false, 'charter', 'GBR', 'seasonal',
  'Med charter season — washing, varnishing, tender ops, water sports setup for guests.'
);

-- Past experience 2: Deckhand on M/Y Serenity, 2 months ago for 3 months
insert into public.crew_experiences (
  id, person_id, vessel_id, role_id,
  start_date, end_date, is_current, vessel_operation,
  flag_state, contract_type, description
) values (
  'aa000000-0000-0000-0000-000000000002',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'd0000000-0000-0000-0000-000000000006',
  (current_date - interval '5 months')::date,
  (current_date - interval '2 months')::date,
  false, 'charter', 'CYM', 'rotational',
  'Busy charter rotation in the Western Med — Antibes, Cannes, Monaco circuit.'
);

-- Auto-derive experience bracket and vessel size exposure from crew_experiences
select public.derive_experience_profile('22222222-2222-2222-2222-222222222222');

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
