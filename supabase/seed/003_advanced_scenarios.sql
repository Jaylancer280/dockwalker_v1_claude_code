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

-- ========================= USER PREFERENCES =========================

insert into public.user_preferences (person_id, profile_visible)
values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true);

-- =============================================================================
-- PERMANENT JOB SCENARIOS
-- =============================================================================
--
-- Uses same employer e@1 (11111111) and crew c@1 (22222222).
-- PM-00001: Active, no applicants (discoverable by crew)
-- PM-00002: Applied — crew applied, pending review
-- PM-00003: Shortlisted — crew applied and was shortlisted
-- PM-00004: In Negotiation — crew selected, engagement created, messages exchanged
-- PM-00005: Filled — placement confirmed, crew placed
-- PM-00006: Cancelled — employer cancelled before any selection
-- PM-00007: Active, cert-gated (crew missing required cert — blocked on apply)
--
-- =============================================================================

-- Set crew's permanent availability
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

-- ========================= PM-00001: ACTIVE — NO APPLICANTS =========================
-- Chief Engineer, Port Vauban, start in 30 days
-- Discoverable by crew in the permanent feed

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000001',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000001',
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

-- ========================= PM-00002: APPLIED — PENDING REVIEW =========================
-- Deckhand, Port Gallice, start in 45 days
-- Crew has applied

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000002',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000002',
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

select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000002',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000002',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000002',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Keen to join for the charter season. I have 3 years deckhand experience on 40-65m vessels.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

-- ========================= PM-00003: SHORTLISTED =========================
-- Bosun, Port Hercules, start in 60 days
-- Crew applied and was shortlisted

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000003',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000003',
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

select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000003',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000003',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000003',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Interested in the Bosun position. Currently available and based in the area.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000003',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000003'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-00004: IN NEGOTIATION =========================
-- First Officer, Port Vauban, start in 14 days
-- Crew applied → shortlisted → selected → engagement created → messages exchanged

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000004',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000004',
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

select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000004',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000004',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000004',
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'message', 'Very interested in this First Officer role. Available immediately.'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000004',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000004'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'PERMANENT.SELECTED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000004',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000004',
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
    and permanent_posting_id = 'aa000000-0000-0000-0001-000000000004';

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

-- ========================= PM-00005: FILLED — PLACEMENT CONFIRMED =========================
-- Stewardess, Vieux Port de Cannes, start 3 months ago
-- Full lifecycle: applied → shortlisted → selected → placement confirmed

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000005',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000005',
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
    'notes', 'Full-time Stewardess for busy charter vessel. Silver service experience essential.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'PERMANENT.APPLIED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000005',
  'permanent',
  'crew',
  jsonb_build_object(
    'id', 'ab000000-0000-0000-0001-000000000005',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000005',
    'crew_person_id', '22222222-2222-2222-2222-222222222222'
  ),
  '22222222-2222-2222-2222-222222222222'
);

select public.append_event(
  'PERMANENT.SHORTLISTED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000005',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'PERMANENT.SELECTED',
  '22222222-2222-2222-2222-222222222222:aa000000-0000-0000-0001-000000000005',
  'permanent',
  'employer',
  jsonb_build_object(
    'crew_person_id', '22222222-2222-2222-2222-222222222222',
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000005',
    'engagement_id', 'ac000000-0000-0000-0001-000000000005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

select public.append_event(
  'PERMANENT.PLACEMENT_CONFIRMED',
  'aa000000-0000-0000-0001-000000000005',
  'permanent',
  'employer',
  jsonb_build_object(
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000005'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-00006: CANCELLED BY EMPLOYER =========================
-- Second Engineer, Port de Nice, start in 20 days
-- Employer posted then cancelled (vessel sale fell through)

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000006',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000006',
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

select public.append_event(
  'PERMANENT.CANCELLED_BY_EMPLOYER',
  'aa000000-0000-0000-0001-000000000006',
  'permanent',
  'employer',
  jsonb_build_object(
    'permanent_posting_id', 'aa000000-0000-0000-0001-000000000006',
    'reason', 'Vessel sale did not proceed — position no longer available'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= PM-00007: ACTIVE — CERT GATED =========================
-- Head Chef, Port Vauban, start ASAP (past date = ASAP on cards)
-- Requires Food Safety Level 2 cert (e006) which crew does NOT have
-- Crew will see this in feed but cannot apply (cert-gated)

select public.append_event(
  'PERMANENT.POSTED',
  'aa000000-0000-0000-0001-000000000007',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', 'aa000000-0000-0000-0001-000000000007',
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
    'notes', 'Head Chef for private owner. Mediterranean and Asian fusion. Max 12 covers. Immediate start — ASAP.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= EXTRA DISCOVERABLE DAYWORK POSTINGS =========================
-- Jobs 11-13: active, future-dated, varied roles/ports, crew user has NOT interacted
-- These ensure the discover feed is never empty for testing.

-- Job 11: Chief Stewardess, Club de Mar Mallorca, days +20 to +25
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444011',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444011',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000011',
    'location_port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date + interval '20 days')::date,
    'end_date', (current_date + interval '25 days')::date,
    'working_days', 5,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'day_rate', 250,
    'currency', 'EUR',
    'meals', '["breakfast","lunch","dinner"]'::jsonb,
    'notes', 'Charter prep and guest service. Previous charter experience preferred.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Job 12: Sous Chef, Marina Ibiza, days +22 to +28
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444012',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444012',
    'vessel_id', '33333333-3333-3333-3333-333333333335',
    'role_id', 'd0000000-0000-0000-0000-000000000016',
    'location_port_id', 'c0000000-0000-0000-0000-000000000003',
    'start_date', (current_date + interval '22 days')::date,
    'end_date', (current_date + interval '28 days')::date,
    'working_days', 6,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000006"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 300,
    'currency', 'EUR',
    'meals', '["breakfast","lunch"]'::jsonb,
    'notes', 'Cover for head chef shore leave. Mediterranean menu. Crew of 14.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Job 13: ETO, Port Hercule Monaco, days +25 to +30
select public.append_event(
  'DAYWORK.POSTED',
  '44444444-4444-4444-4444-444444444013',
  'daywork',
  'employer',
  jsonb_build_object(
    'id', '44444444-4444-4444-4444-444444444013',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000010',
    'location_port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date + interval '25 days')::date,
    'end_date', (current_date + interval '30 days')::date,
    'working_days', 5,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000004',
    'day_rate', 350,
    'currency', 'EUR',
    'meals', '["lunch"]'::jsonb,
    'notes', 'AV and IT systems maintenance during refit. Must have NMEA 2000 experience.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- ========================= EXTRA DISCOVERABLE PERMANENT POSTINGS =========================
-- Permanent postings so the permanent discover feed also has content.

-- Perm 3: Second Stewardess, Club de Mar, future start
select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555003',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555003',
    'vessel_id', '33333333-3333-3333-3333-333333333333',
    'role_id', 'd0000000-0000-0000-0000-000000000012',
    'port_id', 'c0000000-0000-0000-0000-000000000002',
    'start_date', (current_date + interval '14 days')::date,
    'salary_min', 3000,
    'salary_max', 3500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000003',
    'shortlist_cap', 5,
    'notes', 'Season starting Palma, moving to Greece in July. Great owners, relaxed charter programme.'
  ),
  '11111111-1111-1111-1111-111111111111'
);

-- Perm 4: Mate, Port Hercule Monaco, immediate start
select public.append_event(
  'PERMANENT.POSTED',
  '55555555-5555-5555-5555-555555555004',
  'permanent',
  'employer',
  jsonb_build_object(
    'id', '55555555-5555-5555-5555-555555555004',
    'vessel_id', '33333333-3333-3333-3333-333333333334',
    'role_id', 'd0000000-0000-0000-0000-000000000019',
    'port_id', 'c0000000-0000-0000-0000-000000000007',
    'start_date', (current_date - interval '3 days')::date,
    'salary_min', 5000,
    'salary_max', 6500,
    'salary_currency', 'EUR',
    'salary_period', 'monthly',
    'live_aboard', true,
    'required_certification_ids', '["e0000000-0000-0000-0000-000000000001","e0000000-0000-0000-0000-000000000011"]'::jsonb,
    'experience_bracket_id', 'f0000000-0000-0000-0000-000000000005',
    'shortlist_cap', 3,
    'notes', 'Experienced Mate for 60m motor yacht. Year-round Mediterranean programme. Must hold OOW 3000gt.'
  ),
  '11111111-1111-1111-1111-111111111111'
);
