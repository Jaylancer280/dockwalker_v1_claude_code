-- =============================================================================
-- Comprehensive seed data — NOT for production
-- =============================================================================
--
-- Builds on 002_test_profiles.sql. Uses e@1 (employer) and c@1 (crew).
-- Creates daywork postings across all lifecycle states.
--
-- DATE MAP (all non-overlapping for crew c@1):
--   Job 1 (DW-00001): days +1 to +2   — Active, no applicants (discoverable)
--   Job 2 (DW-00002): days +4 to +6   — Applied (crew applied, pending)
--   Job 3 (DW-00003): days +8 to +9   — Viewed + Shortlisted
--   Job 4 (DW-00004): days -5 to -2   — In Progress (accepted, messages, work started)
--   Job 5 (DW-00005): days -35 to -32 — Completed + rated by both
--   Job 6 (DW-00006): days -25 to -23 — Cancelled by crew (post-acceptance)
--   Job 7 (DW-00007): days -20 to -18 — Cancelled by employer (vessel leaving)
--   Job 8 (DW-00008): days +11 to +13 — Active, NDA vessel (discoverable)
--   Job 9 (DW-00009): days -15 to -13 — Completed + crew disputed
--   Job 10 (DW-00010): days +15 to +17 — Invitation sent to crew (pending)
--
-- =============================================================================

-- ========================= JOB 1: ACTIVE — NO APPLICANTS =========================
-- Deckhand, Port Vauban, days +1 to +2
-- Discoverable by crew in the discover feed

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
    'start_date', (current_date + interval '1 day')::date,
    'end_date', (current_date + interval '2 days')::date,
    'working_days', 2,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 250,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Charter prep — sanding, polishing, provisioning. Early start at 07:00.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= JOB 2: APPLIED (pending) =========================
-- Stewardess, Port Vauban, days +4 to +6
-- Crew applied, employer hasn't viewed yet

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
    'start_date', (current_date + interval '4 days')::date,
    'end_date', (current_date + interval '6 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 200,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Interior deep clean before owner trip. Silver service experience preferred.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Crew applies
select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444002',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555002',
    'daywork_id', '44444444-4444-4444-4444-444444444002',
    'message', 'Hi, I have experience with Christofle silver service and interior deep cleans. Available all 3 days.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= JOB 3: VIEWED + SHORTLISTED =========================
-- Deckhand, Port Hercules (Monaco), days +8 to +9
-- Crew applied, employer viewed and shortlisted

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444003',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444003',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date + interval '8 days')::date,
    'end_date', (current_date + interval '9 days')::date,
    'working_days', 2,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
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
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444003',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555003',
    'daywork_id', '44444444-4444-4444-4444-444444444003',
    'message', 'I have experience with Grand Prix prep from last season on M/Y Eclipse. Available both days.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- Employer views
select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444003',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer shortlists
select public.append_event(
  'DAYWORK.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444003',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= JOB 4: IN PROGRESS + MESSAGES + WORK STARTED =========================
-- Second Engineer, Vieux Port de Cannes, days -5 to -2 (straddles recent past)
-- Full acceptance flow with messages, checklist, and work-started confirmation

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444004',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444004',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000008',
    'location_port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date - interval '5 days')::date,
    'end_date', (current_date - interval '2 days')::date,
    'working_days', 4,
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
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555004',
    'daywork_id', '44444444-4444-4444-4444-444444444004',
    'message', 'Experienced with Caterpillar gensets and Village Marine watermakers. Can bring my own tools.'
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

-- Employer accepts
select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444004',
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
    and daywork_id = '44444444-4444-4444-4444-444444444004';

  -- Employer sends welcome message
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

  -- Employer sets checklist
  perform public.append_event(
    'CHECKLIST.SET',
    v_engagement_id::text,
    'checklist',
    'employer',
    jsonb_build_object(
      'engagement_id', v_engagement_id,
      'items', '[{"id":"chk-1","label":"Bring own PPE (safety boots, gloves, ear protection)","value":"required"},{"id":"chk-2","label":"Arrive at berth 47 by 07:45","value":"required"},{"id":"chk-3","label":"Sign NDA at reception before boarding","value":"required"},{"id":"chk-4","label":"Bring pressure gauge if available","value":"optional"}]'::jsonb
    ),
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew acknowledges checklist items
  perform public.append_event(
    'CHECKLIST.ITEM_TOGGLED',
    v_engagement_id::text,
    'checklist',
    'crew',
    jsonb_build_object('engagement_id', v_engagement_id, 'item_id', 'chk-1', 'checked', true),
    '22222222-2222-2222-2222-222222222222'
  );
  perform public.append_event(
    'CHECKLIST.ITEM_TOGGLED',
    v_engagement_id::text,
    'checklist',
    'crew',
    jsonb_build_object('engagement_id', v_engagement_id, 'item_id', 'chk-2', 'checked', true),
    '22222222-2222-2222-2222-222222222222'
  );
  perform public.append_event(
    'CHECKLIST.ITEM_TOGGLED',
    v_engagement_id::text,
    'checklist',
    'crew',
    jsonb_build_object('engagement_id', v_engagement_id, 'item_id', 'chk-3', 'checked', true),
    '22222222-2222-2222-2222-222222222222'
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

-- ========================= JOB 5: COMPLETED + RATED BY BOTH =========================
-- Stewardess, Port de Nice, days -35 to -32
-- Full lifecycle: applied → accepted → completed → confirmed → both rated

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444005',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444005',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000014',
    'location_port_id', 'c0000000-0000-0000-0000-000000000005',
    'start_date', (current_date - interval '35 days')::date,
    'end_date', (current_date - interval '32 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000002',
    'day_rate', 220,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Turnover clean between charters. Laundry, cabin flip, and galley deep clean. Team of 3.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555005',
    'daywork_id', '44444444-4444-4444-4444-444444444005',
    'message', 'I did a turnover on a 60m last month in Antibes. Familiar with Christofle silver service.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444005',
  'application',
  'employer',
  '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444005';

  -- Messages
  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666005',
      'content', 'Boat is in Port de Nice, quai des milliardaires berth 12. Start at 07:30 — guests depart at 08:00, new ones board at 16:00.'),
    '11111111-1111-1111-1111-111111111111'
  );

  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666006',
      'content', 'Understood. What laundry setup do you have on board? Industrial or domestic?'),
    '22222222-2222-2222-2222-222222222222'
  );

  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666007',
      'content', '2x Miele industrial washers and a commercial dryer. Ironing station in the crew mess.'),
    '11111111-1111-1111-1111-111111111111'
  );

  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666008',
      'content', 'All done. Cabins flipped, galley spotless, laundry folded. Great team to work with.'),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer marks daywork complete
  perform public.append_event(
    'DAYWORK.COMPLETED',
    '44444444-4444-4444-4444-444444444005',
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
      'vessel_condition', 4, 'would_work_on_vessel_again', true,
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

-- ========================= JOB 6: CANCELLED BY CREW =========================
-- Bosun, Port Gallice, days -25 to -23
-- Accepted then crew cancelled (found other work)

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444006',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444006',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000004',
    'location_port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date - interval '25 days')::date,
    'end_date', (current_date - interval '23 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000005"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 300,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Bosun needed for line handling and dock setup during refit.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application', 'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555006',
    'daywork_id', '44444444-4444-4444-4444-444444444006',
    'message', 'Happy to help with the dock setup. Have bosun experience from my time on 50m+ vessels.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Crew cancels (found other work)
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444006';

  -- Cancellation message
  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('id', '66666666-6666-6666-6666-666666666009',
      'content', 'Really sorry but I have been offered a rotational contract starting immediately. I need to pull out.'),
    '22222222-2222-2222-2222-222222222222'
  );

  perform public.append_events_batch(
    jsonb_build_array(
      jsonb_build_object(
        'event_type', 'ENGAGEMENT.CANCELLED_BY_CREW',
        'aggregate_id', '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444006',
        'aggregate_type', 'application',
        'role_context', 'crew',
        'payload', jsonb_build_object(
          'engagement_id', v_engagement_id,
          'daywork_id', '44444444-4444-4444-4444-444444444006',
          'crew_person_id', '22222222-2222-2222-2222-222222222222',
          'reason_category', 'found_other_work',
          'reason_text', 'Offered a rotational contract'
        ),
        'person_id', '22222222-2222-2222-2222-222222222222'
      ),
      jsonb_build_object(
        'event_type', 'MESSAGE.SENT',
        'aggregate_id', v_engagement_id::text,
        'aggregate_type', 'message',
        'role_context', 'crew',
        'payload', jsonb_build_object(
          'id', '66666666-6666-6666-6666-66666666600a',
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

-- ========================= JOB 7: CANCELLED BY EMPLOYER =========================
-- Lead Deckhand, Port Pierre Canto, days -20 to -18
-- Accepted then employer cancelled (vessel leaving), daywork also cancelled

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444007',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444007',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000005',
    'location_port_id', 'c0000000-0000-0000-0000-000000000004',
    'start_date', (current_date - interval '20 days')::date,
    'end_date', (current_date - interval '18 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 270,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Lead deckhand for dock-to-dock transit assistance.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application', 'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555007',
    'daywork_id', '44444444-4444-4444-4444-444444444007',
    'message', 'Available for the transit. Have done many dock-to-dock moves in the Med.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

-- Employer cancels with relist
do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444007';

  perform public.append_events_batch(
    jsonb_build_array(
      jsonb_build_object(
        'event_type', 'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
        'aggregate_id', '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444007',
        'aggregate_type', 'application',
        'role_context', 'employer',
        'payload', jsonb_build_object(
          'engagement_id', v_engagement_id,
          'daywork_id', '44444444-4444-4444-4444-444444444007',
          'crew_person_id', '22222222-2222-2222-2222-222222222222',
          'reason_category', 'vessel_leaving',
          'reason_text', 'Owner decided to leave port early',
          'relist_requested', false
        ),
        'person_id', '11111111-1111-1111-1111-111111111111'
      ),
      jsonb_build_object(
        'event_type', 'DAYWORK.CANCELLED_BY_EMPLOYER',
        'aggregate_id', '44444444-4444-4444-4444-444444444007',
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
          'id', '66666666-6666-6666-6666-66666666600b',
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

-- ========================= JOB 8: ACTIVE — NDA VESSEL =========================
-- Chef, Port Vauban, days +11 to +13
-- On the NDA vessel (Phantom) — crew sees masked vessel data

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444008',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444008',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000015',
    'location_port_id', 'c0000000-0000-0000-0000-000000000001',
    'start_date', (current_date + interval '11 days')::date,
    'end_date', (current_date + interval '13 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 400,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Head Chef needed for private dinner series. Mediterranean and Japanese fusion. Max 12 covers per sitting.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= JOB 9: COMPLETED + CREW DISPUTED =========================
-- Day Worker, Port de la Darse (Villefranche), days -15 to -13
-- Crew disputed the completion

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444009',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444009',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000020',
    'location_port_id', 'c0000000-0000-0000-0000-000000000006',
    'start_date', (current_date - interval '15 days')::date,
    'end_date', (current_date - interval '13 days')::date,
    'working_days', 3,
    'required_certification_ids', '[]'::jsonb,
    'experience_bracket_id', null,
    'day_rate', 200,
    'currency', 'EUR',
    'meals', '["lunch"]'::jsonb,
    'notes', 'General daywork — painting, cleaning, stores loading.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.APPLIED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application', 'crew',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555009',
    'daywork_id', '44444444-4444-4444-4444-444444444009',
    'message', 'Available for general daywork. Happy to help with anything.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'DAYWORK.VIEWED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'DAYWORK.ACCEPTED',
  '22222222-2222-2222-2222-222222222222:44444444-4444-4444-4444-444444444009',
  'application', 'employer', '{}'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

do $$
declare
  v_engagement_id uuid;
begin
  select id into v_engagement_id
  from public.active_engagements
  where crew_person_id = '22222222-2222-2222-2222-222222222222'
    and daywork_id = '44444444-4444-4444-4444-444444444009';

  -- Messages
  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'employer',
    jsonb_build_object('id', '66666666-6666-6666-6666-66666666600c',
      'content', 'Hi, meet at the stern gangway at 08:00. We need to load 20 pallets of stores.'),
    '11111111-1111-1111-1111-111111111111'
  );

  perform public.append_event(
    'MESSAGE.SENT', v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('id', '66666666-6666-6666-6666-66666666600d',
      'content', 'Will be there. Should I bring steel-toe boots?'),
    '22222222-2222-2222-2222-222222222222'
  );

  -- Employer marks complete
  perform public.append_event(
    'DAYWORK.COMPLETED',
    '44444444-4444-4444-4444-444444444009',
    'daywork', 'employer', '{}'::jsonb,
    '11111111-1111-1111-1111-111111111111'
  );

  -- Crew disputes — only worked 2 of 3 days (employer sent them home early)
  perform public.append_event(
    'ENGAGEMENT.COMPLETION_DISPUTED',
    v_engagement_id::text, 'engagement', 'crew',
    jsonb_build_object('confirmed', false),
    '22222222-2222-2222-2222-222222222222'
  );
end $$;

-- ========================= JOB 10: INVITATION PENDING =========================
-- Deckhand, Club de Mar Mallorca, days +15 to +17
-- Employer invited crew directly (no application yet)

select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444010',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444010',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000006',
    'location_port_id', 'c0000000-0000-0000-0000-000000000010',
    'start_date', (current_date + interval '15 days')::date,
    'end_date', (current_date + interval '17 days')::date,
    'working_days', 3,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 260,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Deckhand needed for Mallorca stopover. Wash-down, provisioning, and guest prep.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Employer invites crew directly (direct insert — invitation aggregate_type not in events check)
insert into public.daywork_invitations (daywork_id, crew_person_id, employer_person_id, status)
values (
  '44444444-4444-4444-4444-444444444010',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'pending'
);

-- ========================= DAYWORK TEMPLATE (employer convenience) =========================
-- Saved template for quick repeat posting

insert into public.daywork_templates (
  id, person_id, name, vessel_id, role_id, location_port_id,
  working_days, required_certification_ids, experience_bracket_id,
  day_rate, currency, meals, notes
) values (
  'bb000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Standard Deckhand - Antibes',
  '33333333-3333-3333-3333-333333333333',
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

-- ========================= USER PREFERENCES =========================

insert into public.user_preferences (person_id, profile_visible)
values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true);
