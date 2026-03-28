-- =============================================================================
-- Comprehensive seed data — NOT for production
-- =============================================================================
--
-- Builds on 002_test_profiles.sql. Uses e@1 (Hein, employer) and c@1 (James, crew).
-- Creates crew experiences, availability, daywork postings across all lifecycle
-- states, permanent postings, templates, and user preferences.
--
-- PERSON IDS:
--   Employer (Hein):    11111111-1111-1111-1111-111111111111
--   Crew (James):       22222222-2222-2222-2222-222222222222
--
-- VESSEL IDS (employer-owned �� used in postings):
--   Serenity (65m motor):       33333333-3333-3333-3333-333333333333
--   Phantom  (45m motor, NDA):  33333333-3333-3333-3333-333333333334
-- VESSEL IDS (crew-owned — used in experiences):
--   Wanderer (35m sail):        33333333-3333-3333-3333-333333333335
-- VESSEL IDS (crew-owned, used in experiences):
--   Wanderer copy (35m):        33333333-3333-3333-3333-33333333333a
--   Serenity copy (65m):        33333333-3333-3333-3333-33333333333b
--   Phantom copy (45m):         33333333-3333-3333-3333-33333333333c
--
-- DAYWORK POSTINGS (DW-01 through DW-10):
--   DW-01: day +20,  Deckhand,          Port Vauban     — Active, no applicants + invitation
--   DW-02: day +22,  Head Chef,         Port Vauban     — Active, NDA vessel
--   DW-03: day +24,  Stewardess,        Port Vauban     — Active, no applicants
--   DW-04: day +26,  Stewardess,        Port Vauban     — Applied (pending)
--   DW-05: day +28,  Deckhand,          Port Hercules   — Applied → Viewed → Shortlisted
--   DW-06: day -30,  Deckhand,          Vieux Port      — In Progress (work started)
--   DW-07: day -40,  Deckhand,          Port de Nice    — Completed + rated by both
--   DW-08: day -50,  Day Worker,        Port de la Darse — Completed + disputed
--   DW-09: day -60,  Bosun,             Port Gallice    — Cancelled by crew
--   DW-10: day -70,  Lead Deckhand,     Port Pierre Canto — Cancelled by employer
--
-- PERMANENT POSTINGS (PM-01 through PM-07):
--   PM-01: Chief Engineer,       Port Vauban     — Active, no applicants
--   PM-02: Deckhand,             Port Gallice    — Applied (pending)
--   PM-03: Bosun,                Port Hercules   — Shortlisted
--   PM-04: First Officer,        Port Vauban     — Selected (in negotiation) + messages
--   PM-05: Second Stewardess,    Vieux Port      — Placement confirmed + engagement closed
--   PM-06: Second Engineer,      Port de Nice    — Cancelled by employer
--   PM-07: Sous Chef,            Port Vauban     — Active, cert-gated (crew missing e006)
--
-- =============================================================================


-- =============================================================================
-- SECTION 1: CREW EXPERIENCES
-- =============================================================================
-- 4 experience entries for crew (Profile Two), using EXPERIENCE.ADDED events

-- Experience 1: Deckhand on S/Y Wanderer, seasonal charter, GBR flag
select public.append_event(
  'EXPERIENCE.ADDED',
  '44444444-4444-4444-4444-44444444e001',
  'experience',
  'crew',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444e001',
    'vessel_id', '33333333-3333-3333-3333-33333333333a',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'start_date', (current_date - interval '8 months')::date,
    'end_date', (current_date - interval '5 months')::date,
    'is_current', false,
    'vessel_operation', 'charter',
    'flag_state', 'GBR',
    'contract_type', 'seasonal',
    'description', 'Med summer season on 35m sailing yacht. Tender ops, varnishing, guest water sports setup.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Experience 2: Deckhand on M/Y Serenity, rotational charter, CYM flag (with salary + sea time)
select public.append_event(
  'EXPERIENCE.ADDED',
  '44444444-4444-4444-4444-44444444e002',
  'experience',
  'crew',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444e002',
    'vessel_id', '33333333-3333-3333-3333-33333333333b',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'start_date', (current_date - interval '4 months')::date,
    'end_date', (current_date - interval '2 months')::date,
    'is_current', false,
    'vessel_operation', 'charter',
    'flag_state', 'CYM',
    'contract_type', 'rotational',
    'salary_amount', 250,
    'salary_currency', 'EUR',
    'salary_period', 'daily',
    'sea_time_days', 45,
    'description', 'Busy charter rotation in the Western Med — Antibes, Cannes, Monaco circuit. 45 sea days.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Experience 3: Lead Deckhand on M/Y Serenity, rotational charter, CYM flag (with salary)
select public.append_event(
  'EXPERIENCE.ADDED',
  '44444444-4444-4444-4444-44444444e003',
  'experience',
  'crew',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444e003',
    'vessel_id', '33333333-3333-3333-3333-33333333333b',
    'role_id', 'd0000000-0000-0000-0000-000000000005',
    'start_date', (current_date - interval '2 months')::date,
    'end_date', (current_date - interval '1 month')::date,
    'is_current', false,
    'vessel_operation', 'charter',
    'flag_state', 'CYM',
    'contract_type', 'rotational',
    'salary_amount', 300,
    'salary_currency', 'EUR',
    'salary_period', 'daily',
    'description', 'Promoted to Lead Deckhand mid-season. Managed 3 junior deckhands during busy charter schedule.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Experience 4: Bosun on M/Y Phantom, temporary private, MHL flag
select public.append_event(
  'EXPERIENCE.ADDED',
  '44444444-4444-4444-4444-44444444e004',
  'experience',
  'crew',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-44444444e004',
    'vessel_id', '33333333-3333-3333-3333-33333333333c',
    'role_id', 'd0000000-0000-0000-0000-000000000004',
    'start_date', (current_date - interval '3 weeks')::date,
    'end_date', (current_date - interval '1 week')::date,
    'is_current', false,
    'vessel_operation', 'private',
    'flag_state', 'MHL',
    'contract_type', 'temporary',
    'description', 'Short-term bosun cover during crew changeover. Anchoring drills, safety equipment audit.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Re-derive experience profile after adding new entries
select public.derive_experience_profile('22222222-2222-2222-2222-222222222222');


-- =============================================================================
-- SECTION 2: CREW AVAILABILITY
-- =============================================================================

-- Daywork availability: next 14 days in Antibes (Port Vauban)
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

-- Permanent availability: immediate, not currently employed
select public.append_event(
  'PROFILE.UPDATED',
  '22222222-2222-2222-2222-222222222222',
  'person',
  'crew',
  jsonb_build_object(
    'permanent_availability', 'immediate',
    'currently_employed', false
  ),
  '22222222-2222-2222-2222-222222222222'
);


-- =============================================================================
-- SECTION 3: DAYWORK POSTINGS
-- =============================================================================

-- ========================= DW-01: ACTIVE — NO APPLICANTS + INVITATION =========================
-- Deckhand, Port Vauban, day +20 (1-day)

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
    'start_date', (current_date + interval '20 days')::date,
    'end_date', (current_date + interval '20 days')::date,
    'working_days', 1,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 250,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Charter prep — wash-down, polish, and provisioning stow. Early start at 07:00.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Employer invites crew directly to DW-01
insert into public.daywork_invitations (daywork_id, crew_person_id, employer_person_id, status)
values (
  '44444444-4444-4444-4444-444444444001',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'pending'
);

-- ========================= DW-02: ACTIVE — NDA VESSEL =========================
-- Head Chef, Port Vauban, day +22 (1-day), Phantom NDA vessel

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444002',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444002',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000015',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '22 days')::date,
    'end_date', (current_date + interval '22 days')::date,
    'working_days', 1,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 400,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Private dinner for 10 guests. Mediterranean and Japanese fusion. All produce sourced locally.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= DW-03: ACTIVE — NO APPLICANTS =========================
-- Stewardess, Port Vauban, day +24 (1-day), Wanderer

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444003',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444003',
    'vessel_id', '33333333-3333-3333-3333-333333333335',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '24 days')::date,
    'end_date', (current_date + interval '24 days')::date,
    'working_days', 1,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 200,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Interior deep clean before charter season. Cabin flip and galley detailing.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= DW-04: APPLIED (pending) =========================
-- Stewardess, Port Vauban, day +26 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444004',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444004',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '26 days')::date,
    'end_date', (current_date + interval '26 days')::date,
    'working_days', 1,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 220,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Interior turnover between charters. Silver service experience preferred but not required.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies to DW-04
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555004',
    'daywork_id', '44444444-4444-4444-4444-444444444004',
    'message', 'Hi, I have experience with interior turnovers on 60m+ vessels. Happy to help with silver service.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= DW-05: APPLIED → VIEWED → SHORTLISTED =========================
-- Deckhand, Port Hercules (Monaco), day +28 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444005',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444005',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date + interval '28 days')::date,
    'end_date', (current_date + interval '28 days')::date,
    'working_days', 1,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 280,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Monaco Grand Prix prep — hull cleaning, flag dressing, and VIP gangway setup.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555005',
    'daywork_id', '44444444-4444-4444-4444-444444444005',
    'message', 'I have experience with Grand Prix prep from last season on M/Y Eclipse. Available for the day.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer shortlists
select public.append_event(
  'DAYWORK.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= DW-06: IN PROGRESS (WORK STARTED + CONFIRMED) =========================
-- Deckhand, Vieux Port Cannes, day -30 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444006',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444006',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date - interval '30 days')::date,
    'end_date', (current_date - interval '30 days')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 260,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Deck maintenance — sanding teak, polishing stainless, cleaning scuppers. 07:30 start.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555006',
    'daywork_id', '44444444-4444-4444-4444-444444444006',
    'message', 'Happy to help with the teak work. I have my own sanding gear if needed.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Messages, checklist, and work-started on the engagement
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444006';

  -- Employer sends welcome message
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666001',
      'content', 'Great, see you at Vieux Port berth 22 at 07:30. Gate code is 3456. Bring sunscreen — no shade on the foredeck.'
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew replies
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666002',
      'content', 'Copy that. Should I bring my own sanding pads or will you have supplies on board?'
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer sets checklist (3 items)
  perform public.append_event(
    'CHECKLIST.SET',
    v_engagement_id::text,
    'checklist',
    'employer',
    jsonb_build_object(
      'engagement_id', v_engagement_id,
      'items', '[{"id":"chk-1","label":"Bring own PPE (gloves, knee pads, safety boots)","value":"required"},{"id":"chk-2","label":"Arrive at berth 22 by 07:15","value":"required"},{"id":"chk-3","label":"Bring sanding pads (80 and 120 grit) if available","value":"optional"}]'::jsonb
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Work started: employer initiates
  perform public.append_event(
    'ENGAGEMENT.WORK_STARTED',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object('engagement_id', v_engagement_id, 'initiated_by', 'employer'),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Work started: crew confirms
  perform public.append_event(
    'ENGAGEMENT.WORK_STARTED_CONFIRMED',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object('engagement_id', v_engagement_id, 'confirmed_by', 'crew'),
    '22222222-2222-2222-2222-222222222222'
  );
end $$;

-- ========================= DW-07: COMPLETED + RATED BY BOTH =========================
-- Deckhand, Port de Nice, day -40 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444007',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444007',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000005',
    'start_date', (current_date - interval '40 days')::date,
    'end_date', (current_date - interval '40 days')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 250,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Dock-to-dock transit assistance. Line handling and fender placement. 06:00 departure.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555007',
    'daywork_id', '44444444-4444-4444-4444-444444444007',
    'message', 'Available for the transit. Done many dock-to-dock moves in the Med — Antibes to Nice is a familiar route.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Full lifecycle: messages → completed → confirmed → rated by both
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444007';

  -- Messages
  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666003',
      'content', 'Morning — we are at quai des milliardaires berth 8. Lines off at 06:00 sharp.'),
    '11111111-1111-1111-1111-111111111111'
  );

  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666004',
      'content', 'On my way. Transit went smoothly — all lines secure at the new berth. Thanks for a good day.'),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer marks daywork complete
  perform public.append_event(
    'DAYWORK.COMPLETED',
    '44444444-4444-4444-4444-444444444007',
    'daywork', 'employer', '{}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew confirms completion
  perform public.append_event(
    'ENGAGEMENT.COMPLETION_CONFIRMED',
    v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('confirmed', true),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Crew rates
  perform public.append_event(
    'ENGAGEMENT.RATED_BY_CREW',
    v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object(
      'pay_accuracy', 'yes', 'meals_accuracy', 'yes',
      'role_accuracy', 'yes', 'working_days_accuracy', 'as_listed',
      'vessel_condition', 5, 'would_work_on_vessel_again', true,
      'communication_accuracy', true, 'overall_match', 5
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer rates
  perform public.append_event(
    'ENGAGEMENT.RATED_BY_EMPLOYER',
    v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object(
      'skills_as_advertised', 'yes', 'certifications_verified', 'yes',
      'punctuality', 'yes', 'would_rehire', true,
      'communication_accuracy', true, 'overall_match', 5
    ),
    '11111111-1111-1111-1111-111111111111'
  );
end $$;

-- ========================= DW-08: COMPLETED + DISPUTED =========================
-- Day Worker, Port de la Darse (Villefranche), day -50 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444008',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444008',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000020',
    'location_port_id', 'c0000000-0000-0000-0000-000000000006',
    'start_date', (current_date - interval '50 days')::date,
    'end_date', (current_date - interval '50 days')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 200,
    'currency', 'EUR',
    'meals', '["lunch"]'::jsonb,
    'notes', 'General daywork — stores loading, deck painting, and equipment stow.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444008',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555008',
    'daywork_id', '44444444-4444-4444-4444-444444444008',
    'message', 'Available for general daywork. Happy to help with anything that needs doing.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444008',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444008',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Completed then disputed
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444008';

  -- Message
  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666005',
      'content', 'Meet at the stern gangway at 08:00. We have 15 pallets of stores to load today.'),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Employer marks complete
  perform public.append_event(
    'DAYWORK.COMPLETED',
    '44444444-4444-4444-4444-444444444008',
    'daywork', 'employer', '{}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew disputes — sent home early, only worked half the day
  perform public.append_event(
    'ENGAGEMENT.COMPLETION_DISPUTED',
    v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('confirmed', false),
    '22222222-2222-2222-2222-222222222222'
  );
end $$;

-- ========================= DW-09: CANCELLED BY CREW =========================
-- Bosun, Port Gallice, day -60 (1-day), Serenity

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444009',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444009',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000004',
    'location_port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date - interval '60 days')::date,
    'end_date', (current_date - interval '60 days')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 300,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Bosun needed for line handling and dock setup during refit move.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555009',
    'daywork_id', '44444444-4444-4444-4444-444444444009',
    'message', 'Happy to help with the dock setup. Have bosun experience from my time on 50m+ vessels.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Crew cancels (found other work) + employer rates
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444009';

  perform public.append_events_batch(
    jsonb_build_array(
      jsonb_build_object(
        'event_type', 'ENGAGEMENT.CANCELLED_BY_CREW',
        'aggregate_id', '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
        'aggregate_type', 'application',
        'role_context', 'crew',
        'payload', jsonb_build_object(
          'engagement_id', v_engagement_id,
          'daywork_id', '44444444-4444-4444-4444-444444444009',
          'crew_person_id', '22222222-2222-2222-2222-222222222222',
          'reason_category', 'found_other_work',
          'reason_text', 'Offered a rotational contract starting immediately'
        ),
        'person_id', '22222222-2222-2222-2222-222222222222'
      ),
      jsonb_build_object(
        'event_type', 'MESSAGE.SENT',
        'aggregate_id', v_engagement_id::text,
        'aggregate_type', 'message',
        'role_context', 'crew',
        'payload', jsonb_build_object(
          'id', '66666666-6666-6666-6666-666666666006',
          'engagement_id', v_engagement_id,
          'sender_person_id', '22222222-2222-2222-2222-222222222222',
          'content', 'Engagement cancelled by crew. Reason: Accepted another job',
          'is_system', true
        ),
        'person_id', '22222222-2222-2222-2222-222222222222'
      )
    )
  );

  -- Employer rates cancelled engagement
  perform public.append_event(
    'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER',
    v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object(
      'engagement_id', v_engagement_id,
      'communication_accuracy', false,
      'overall_match', 2
    ),
    '11111111-1111-1111-1111-111111111111'
  );
end $$;

-- ========================= DW-10: CANCELLED BY EMPLOYER =========================
-- Lead Deckhand, Port Pierre Canto, day -70 (1-day), Serenity
-- Accepted then employer cancelled (vessel leaving, relist false) + daywork cancelled

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444010',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444010',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000005',
    'location_port_id', 'c0000000-0000-0000-0000-000000000004',
    'start_date', (current_date - interval '70 days')::date,
    'end_date', (current_date - interval '70 days')::date,
    'working_days', 1,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 270,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Lead deckhand for provisioning and dock-to-dock transit assistance.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444010',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555010',
    'daywork_id', '44444444-4444-4444-4444-444444444010',
    'message', 'Available for the transit. Have done many dock-to-dock moves in the Med.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444010',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444010',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer cancels + daywork cancelled
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444010';

  perform public.append_events_batch(
    jsonb_build_array(
      jsonb_build_object(
        'event_type', 'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
        'aggregate_id', '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444010',
        'aggregate_type', 'application',
        'role_context', 'employer',
        'payload', jsonb_build_object(
          'engagement_id', v_engagement_id,
          'daywork_id', '44444444-4444-4444-4444-444444444010',
          'crew_person_id', '22222222-2222-2222-2222-222222222222',
          'reason_category', 'vessel_leaving',
          'reason_text', 'Owner decided to leave port early',
          'relist_requested', false
        ),
        'person_id', '11111111-1111-1111-1111-111111111111'
      ),
      jsonb_build_object(
        'event_type', 'DAYWORK.CANCELLED_BY_EMPLOYER',
        'aggregate_id', '44444444-4444-4444-4444-444444444010',
        'aggregate_type', 'daywork',
        'role_context', 'employer',
        'payload', '{}'::jsonb,
        'person_id', '11111111-1111-1111-1111-111111111111'
      ),
      jsonb_build_object(
        'event_type', 'MESSAGE.SENT',
        'aggregate_id', v_engagement_id::text,
        'aggregate_type', 'message',
        'role_context', 'employer',
        'payload', jsonb_build_object(
          'id', '66666666-6666-6666-6666-666666666007',
          'engagement_id', v_engagement_id,
          'sender_person_id', '11111111-1111-1111-1111-111111111111',
          'content', 'Engagement cancelled by employer. Reason: Vessel leaving port earlier than expected',
          'is_system', true
        ),
        'person_id', '11111111-1111-1111-1111-111111111111'
      )
    )
  );
end $$;


-- =============================================================================
-- SECTION 4: PERMANENT POSTINGS
-- =============================================================================

-- ========================= PM-01: ACTIVE — NO APPLICANTS =========================
-- Chief Engineer, Port Vauban, start in 30 days, Serenity

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555001',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555001',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000007',
    'port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '30 days')::date,
    'salary_min', 5000,
    'salary_max', 7000,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'shortlist_cap', 5,
    'notes', 'Permanent Chief Engineer for 65m motor yacht. Mediterranean season April-October, winter refit in Antibes. MCA compliant.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-02: APPLIED — PENDING REVIEW =========================
-- Deckhand, Port Gallice, start in 45 days, Serenity

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555002',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555002',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date + interval '45 days')::date,
    'salary_min', 2800,
    'salary_max', 3200,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'shortlist_cap', 3,
    'notes', 'Full-time Deckhand for busy charter season. Strong tender driving and water sports experience preferred.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555002',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000002',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555002',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Keen to join for the charter season. I have 3 years deckhand experience on 40-65m vessels.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= PM-03: SHORTLISTED =========================
-- Bosun, Port Hercules, start in 60 days, Phantom NDA

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555003',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555003',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000004',
    'port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date + interval '60 days')::date,
    'salary_min', 4000,
    'salary_max', 5000,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000007"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'shortlist_cap', 4,
    'notes', 'Bosun for a well-maintained private vessel. Team of 4 deck crew. Monaco-based year-round.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555003',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000003',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555003',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Interested in the Bosun position. Currently available and based in the area.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer shortlists
select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555003',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555003'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-04: IN NEGOTIATION (SELECTED) =========================
-- First Officer, Port Vauban, start in 14 days, Serenity

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555004',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555004',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000002',
    'port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '14 days')::date,
    'salary_min', 5500,
    'salary_max', 6500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'shortlist_cap', 3,
    'notes', 'First Officer position on 65m charter yacht. GMDSS, OOW 3000gt required. Start 2 weeks.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555004',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000004',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555004',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Very interested in this First Officer role. Available immediately.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer shortlists
select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555004',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555004'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Employer selects
select public.append_event(
  'PERMANENT.SELECTED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555004',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555004',
    'engagement_id', 'ac000000-0000-0000-0001-000000000004'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Messages in the negotiation thread
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and permanent_posting_id = '55555555-5555-5555-5555-555555555004';

  if v_engagement_id is not null then
    perform public.append_event(
      'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
      jsonb_build_object('id', 'ad000000-0000-0000-0001-000000000001',
        'content', 'Welcome aboard! Let''s discuss the rotation schedule. We do 6 weeks on / 3 weeks off during charter season.'),
      '11111111-1111-1111-1111-111111111111'
    );

    perform public.append_event(
      'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
      jsonb_build_object('id', 'ad000000-0000-0000-0001-000000000002',
        'content', 'That works well for me. What are the leave arrangements during the winter refit period?'),
      '22222222-2222-2222-2222-222222222222'
    );

    perform public.append_event(
      'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
      jsonb_build_object('id', 'ad000000-0000-0000-0001-000000000003',
        'content', 'During refit (Nov-Feb) it''s 5 days on / 2 off, standard hours. We can discuss salary adjustment for that period if needed.'),
      '11111111-1111-1111-1111-111111111111'
    );
  end if;
end $$;

-- ========================= PM-05: PLACEMENT CONFIRMED + ENGAGEMENT CLOSED =========================
-- Second Stewardess, Vieux Port Cannes, start 90 days ago, Serenity

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555005',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555005',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000012',
    'port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date - interval '90 days')::date,
    'salary_min', 3000,
    'salary_max', 3500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'shortlist_cap', 5,
    'notes', 'Full-time Second Stewardess for busy charter vessel. Silver service experience essential.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555005',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000005',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555005',
    'crew_person_id', '22222222-2222-2222-2222-222222222222'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer shortlists
select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555005',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Employer selects
select public.append_event(
  'PERMANENT.SELECTED',
  '22222222-2222-2222-2222-222222222222:55555555-5555-5555-5555-555555555005',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', '55555555-5555-5555-5555-555555555005',
    'engagement_id', 'ac000000-0000-0000-0001-000000000005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Placement confirmed
select public.append_event(
  'PERMANENT.PLACEMENT_CONFIRMED',
  '55555555-5555-5555-5555-555555555005',
  'permanent',
  'employer',
  jsonb_build_object(
    'permanent_posting_id', '55555555-5555-5555-5555-555555555005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Engagement closed
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and permanent_posting_id = '55555555-5555-5555-5555-555555555005';

  if v_engagement_id is not null then
    perform public.append_event(
      'PERMANENT.ENGAGEMENT_CLOSED',
      '55555555-5555-5555-5555-555555555005',
      'permanent',
      'employer',
      jsonb_build_object(
        'engagement_id', v_engagement_id,
        'permanent_posting_id', '55555555-5555-5555-5555-555555555005',
        'outcome', 'successful_placement',
        'closed_by', 'employer'
      ),
      '11111111-1111-1111-1111-111111111111'
    );
  end if;
end $$;

-- ========================= PM-06: CANCELLED BY EMPLOYER =========================
-- Second Engineer, Port de Nice, start in 20 days, Phantom NDA

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555006',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555006',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000008',
    'port_id', 'c0000000-0000-0000-0000-000000000005',
    'start_date', (current_date + interval '20 days')::date,
    'salary_min', 4500,
    'salary_max', 5500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', false,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'shortlist_cap', 3,
    'notes', 'Second Engineer for 45m motor yacht. AEC required. Nice-based refit project.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Employer cancels
select public.append_event(
  'PERMANENT.CANCELLED_BY_EMPLOYER',
  '55555555-5555-5555-5555-555555555006',
  'permanent',
  'employer',
  jsonb_build_object(
    'permanent_posting_id', '55555555-5555-5555-5555-555555555006',
    'reason', 'Vessel sale did not proceed — position no longer available'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-07: ACTIVE — CERT GATED =========================
-- Sous Chef, Port Vauban, start ASAP (-5 days), Serenity
-- Requires Food Safety cert (e006) which crew does NOT have — crew cannot apply

select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555007',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555007',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000016',
    'port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date - interval '5 days')::date,
    'salary_min', 4500,
    'salary_max', 6000,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'shortlist_cap', 3,
    'notes', 'Sous Chef for private owner. Mediterranean and Asian fusion. Max 12 covers. Immediate start — ASAP.'
  ),
  '11111111-1111-1111-1111-111111111111'
);


-- =============================================================================
-- SECTION 4B: SOPHIE (g@1) APPLIES TO DW-03
-- =============================================================================
-- Sophie applies to the Stewardess daywork posting (DW-03)

select public.append_event(
  'DAYWORK.APPLIED',
  '44444444-4444-4444-4444-444444440a01',
  'application',
  'crew',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444440a01',
    'daywork_id', '44444444-4444-4444-4444-444444444003',
    'message', 'Hi, I have 8 months interior experience and am available. Happy to travel from Palma for this.'
  ),
  '77777777-7777-7777-7777-777777777777'
);


-- =============================================================================
-- SECTION 5: TEMPLATES
-- =============================================================================

-- Daywork template: Standard Deckhand - Antibes
insert into public.daywork_templates (
  id, person_id, name, role_id, location_port_id,
  working_days, required_certification_ids, experience_bracket_id,
  day_rate, currency, meals, notes
) values (
  'bb000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Standard Deckhand - Antibes',
  'd0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000001',
  3,
  ARRAY['e0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid],
  'f0000000-0000-0000-0000-000000000003',
  250,
  'EUR',
  ARRAY['breakfast','lunch'],
  'Standard charter prep — sanding, polishing, provisioning.'
);

-- Permanent template: Chief Engineer - Med Season
insert into public.permanent_templates (
  id, employer_person_id, template_name, vessel_id, role_id, port_id,
  start_date, salary_min, salary_max, salary_currency, salary_period,
  required_certification_ids, experience_bracket_id, live_aboard, shortlist_cap, notes
) values (
  'bb000000-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Chief Engineer - Med Season',
  '33333333-3333-3333-3333-333333333333',
  'd0000000-0000-0000-0000-000000000007',
  'c0000000-0000-0000-0000-000000000001',
  (current_date + interval '60 days')::date,
  5000,
  7000,
  'EUR',
  'monthly',
  ARRAY['e0000000-0000-0000-0000-000000000001'::uuid],
  'f0000000-0000-0000-0000-000000000004',
  true,
  5,
  'Permanent Chief Engineer for Mediterranean charter season. MCA compliant vessel.'
);


-- =============================================================================
-- SECTION 6: USER PREFERENCES
-- =============================================================================

insert into public.user_preferences (person_id, profile_visible)
values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true);
