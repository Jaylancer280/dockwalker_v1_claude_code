-- =============================================================================
-- Advanced scenario seed data — NOT for production
-- =============================================================================
--
-- Builds on 002_test_profiles.sql. Uses same e@1 (employer) and c@1 (crew).
-- Creates 3 additional jobs in various lifecycle states:
--
--   Job 4 (DW-00004): Shortlisted — crew applied, employer viewed + shortlisted
--   Job 5 (DW-00005): In Progress — accepted, engagement active, messages exchanged
--   Job 6 (DW-00006): Completed — full lifecycle, confirmed, both parties rated
--
-- All dates non-overlapping with each other and with jobs 1-3.
-- =============================================================================

-- Fixed UUIDs for deterministic seeding
-- Daywork 4:      44444444-4444-4444-4444-444444444004
-- Daywork 5:      44444444-4444-4444-4444-444444444005
-- Daywork 6:      44444444-4444-4444-4444-444444444006
-- Application 4:  55555555-5555-5555-5555-555555555004
-- Application 5:  55555555-5555-5555-5555-555555555005
-- Application 6:  55555555-5555-5555-5555-555555555006
-- Message 1-4:    66666666-6666-6666-6666-666666666001 through 004
-- Message 5-8:    66666666-6666-6666-6666-666666666005 through 008

-- ========================= JOB 4: SHORTLISTED =========================
-- Deckhand, Port Hercules (Monaco), +10 to +13 days
-- State: crew applied → employer viewed → employer shortlisted

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444004',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444004',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date + interval '10 days')::date,
    'end_date', (current_date + interval '13 days')::date,
    'working_days', 4,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 280,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Monaco Grand Prix prep week — hull cleaning, flag dressing, and VIP gangway setup. Long days but great atmosphere.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555004',
    'daywork_id', '44444444-4444-4444-4444-444444444004',
    'message', 'Hi, I have experience with Grand Prix prep from last season on M/Y Eclipse. Available all 4 days.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer shortlists
select public.append_event(
  'DAYWORK.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= JOB 5: IN PROGRESS + MESSAGES =========================
-- Engineer, Vieux Port de Cannes, -3 to +2 days (straddles today)
-- State: applied → viewed → accepted → engagement active → messages exchanged

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444005',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444005',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000008',
    'location_port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date - interval '3 days')::date,
    'end_date', (current_date + interval '2 days')::date,
    'working_days', 5,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000007"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 350,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Watermaker service and generator maintenance during owner absence. Must have own PPE and basic tool kit.'
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
    'message', 'Experienced with Caterpillar gensets and Village Marine watermakers. Can bring my own tools.'
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

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Now send messages on the engagement
-- Need the engagement ID — it was auto-created by the projection.
-- We'll look it up and use it for messages.
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444005';

  -- Employer sends first message
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666001',
      'content', 'Welcome aboard! The boat is on berth 47, Vieux Port. Gate code is 4521. See you at 08:00 tomorrow.'
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
      'content', 'Thanks! I will be there. Should I bring any specific filters or parts for the watermaker service?'
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer replies
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666003',
      'content', 'Good thinking. We have the membrane kit on board already but if you have a pressure gauge that would help. The onboard one is reading funny.'
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew confirms
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666004',
      'content', 'No problem, I have a calibrated one in my kit. See you in the morning.'
    ),
    '22222222-2222-2222-2222-222222222222'
  );
end $$;

-- ========================= JOB 6: COMPLETED + RATED =========================
-- Stewardess, Port de Nice, -30 to -27 days (well in the past)
-- State: full lifecycle — applied → accepted → completed → crew confirmed → both rated

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444006',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444006',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000005',
    'start_date', (current_date - interval '30 days')::date,
    'end_date', (current_date - interval '27 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 220,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Turnover clean between charters. Laundry, cabin flip, and galley deep clean. Team of 3 — you will be working with existing crew.'
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
    'message', 'I did a turnover on a 60m last month in Antibes — happy to help with another. Familiar with Christofle silver service.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views + accepts
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Messages during engagement
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444006';

  -- Employer welcome
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666005',
      'content', 'Hi! Boat is in Port de Nice, quai des milliardaires berth 12. Start at 07:30 sharp — guests depart at 08:00 and new ones board at 16:00.'
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew reply
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666006',
      'content', 'Understood. What laundry setup do you have on board? Industrial or domestic?'
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer reply
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666007',
      'content', 'We have 2x Miele industrial washers and a commercial dryer. Plenty of capacity. Ironing station is set up in the crew mess.'
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew wrapping up
  perform public.append_event(
    'MESSAGE.SENT',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object(
      'id', '66666666-6666-6666-6666-666666666008',
      'content', 'All done. Cabins are flipped, galley is spotless, laundry folded and put away. Thanks for having me — great team to work with.'
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer marks complete
  perform public.append_event(
    'DAYWORK.COMPLETED',
    '44444444-4444-4444-4444-444444444006',
    'daywork',
    'employer',
    '{}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew confirms completion
  perform public.append_event(
    'ENGAGEMENT.COMPLETION_CONFIRMED',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object('confirmed', true),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Crew rates the engagement
  perform public.append_event(
    'ENGAGEMENT.RATED_BY_CREW',
    v_engagement_id::text,
    'engagement',
    'crew',
    jsonb_build_object(
      'pay_accuracy', 'yes',
      'meals_accuracy', 'yes',
      'role_accuracy', 'yes',
      'working_days_accuracy', 'as_listed',
      'vessel_condition', 4,
      'would_work_on_vessel_again', true,
      'communication_accuracy', true,
      'overall_match', 5
    ),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer rates the engagement
  perform public.append_event(
    'ENGAGEMENT.RATED_BY_EMPLOYER',
    v_engagement_id::text,
    'engagement',
    'employer',
    jsonb_build_object(
      'skills_as_advertised', 'yes',
      'certifications_verified', 'yes',
      'punctuality', 'yes',
      'would_rehire', true,
      'communication_accuracy', true,
      'overall_match', 5
    ),
    '11111111-1111-1111-1111-111111111111'
  );
end $$;
