-- =============================================================================
-- Test profiles for local development — NOT for production
-- =============================================================================
--
-- Employer "Profile One"  → e@1 / 12345678  (hat: employer)
-- Crew     "Profile Two"  → c@1 / 12345678  (hat: crew)
--
-- Includes: vessel, 3 daywork postings, availability for crew
-- =============================================================================

-- Fixed UUIDs for deterministic seeding
-- Employer user:  11111111-1111-1111-1111-111111111111
-- Crew user:      22222222-2222-2222-2222-222222222222
-- Vessel:         33333333-3333-3333-3333-333333333333
-- Daywork 1:      44444444-4444-4444-4444-444444444001
-- Daywork 2:      44444444-4444-4444-4444-444444444002
-- Daywork 3:      44444444-4444-4444-4444-444444444003

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
  crypt('12345678', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), '', '', '', ''
), (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'c@1',
  crypt('12345678', gen_salt('bf')),
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

-- ========================= VESSEL (owned by employer) =========================

select public.append_event(
  'VESSEL.CREATED',
  '33333333-3333-3333-3333-333333333333',
  'vessel',
  'employer',
  jsonb_build_object(
    'id', '33333333-3333-3333-3333-333333333333',
    'imo_number', '9876543',
    'name', 'M/Y Serenity',
    'vessel_type', 'charter',
    'size_band_id', 'f1000000-0000-0000-0000-000000000005',
    'nda_flag', false
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= DAYWORK POSTINGS (by employer) =========================

-- Posting 1: Deckhand needed, starts in 3 days, Port Vauban
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444001',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444001',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '3 days')::date,
    'end_date', (current_date + interval '7 days')::date,
    'working_days', 5,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 250,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Charter prep — sanding, polishing, provisioning. Early start at 07:00.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Posting 2: Stewardess needed, starts in 5 days, Port Vauban
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444002',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444002',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '5 days')::date,
    'end_date', (current_date + interval '8 days')::date,
    'working_days', 4,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 200,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Interior deep clean before owner trip. Silver service experience preferred.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Posting 3: Day Worker (General) needed, starts in 1 day, Port Gallice
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444003',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444003',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000020',
    'location_port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date + interval '1 day')::date,
    'end_date', (current_date + interval '1 day')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 180,
    'currency', 'EUR',
    'meals', '["lunch"]'::jsonb,
    'notes', 'Quick wash-down and line handling for departure. No experience required.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= CREW AVAILABILITY (next 14 days) =========================

select public.append_event(
  'AVAILABILITY.SET',
  '22222222-2222-2222-2222-222222222222',
  'person',
  'crew',
  jsonb_build_object(
    'start_date', current_date,
    'end_date', (current_date + interval '14 days')::date,
    'expires_at', (now() + interval '14 days')::timestamptz
  ),
  '22222222-2222-2222-2222-222222222222'
);
