-- =============================================================================
-- Migration 00041: Permanent Opportunity Signal
--
-- 1. Add permanent_opportunity column to dayworks
-- 2. Add permanent_opportunity column to daywork_templates
-- 3. Add permanent_opportunity_accuracy column to engagement_ratings
-- 4. Update apply_projection DAYWORK.POSTED and ENGAGEMENT.RATED_BY_CREW handlers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add permanent_opportunity to dayworks
-- ---------------------------------------------------------------------------
alter table public.dayworks
  add column if not exists permanent_opportunity boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Add permanent_opportunity to daywork_templates
-- ---------------------------------------------------------------------------
alter table public.daywork_templates
  add column if not exists permanent_opportunity boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Add permanent_opportunity_accuracy to engagement_ratings
-- ---------------------------------------------------------------------------
alter table public.engagement_ratings
  add column if not exists permanent_opportunity_accuracy text default null
  check (permanent_opportunity_accuracy in ('yes', 'no', 'not_applicable'));

-- ---------------------------------------------------------------------------
-- 4. Update apply_projection — DAYWORK.POSTED + ENGAGEMENT.RATED_BY_CREW
-- ---------------------------------------------------------------------------
create or replace function public.apply_projection(
  p_event_type text,
  p_aggregate_id text,
  p_aggregate_type text,
  p_role_context text,
  p_payload jsonb,
  p_person_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_filled int;
  v_available int;
begin
  case p_event_type

    when 'PERSON.CREATED' then
      insert into public.persons (id, identity_type, current_hat)
      values (p_person_id, p_payload->>'identity_type', p_payload->>'current_hat')
      on conflict (id) do nothing;

    when 'PERSON.HAT_CHANGED' then
      update public.persons set current_hat = p_payload->>'current_hat' where id = p_person_id;

    when 'PERSON.DEACTIVATED' then
      update public.persons set current_hat = 'deactivated' where id = p_person_id;

    when 'PROFILE.CREATED' then
      insert into public.profiles (
        person_id, display_name, identity_type,
        primary_role_id, certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio, agency_name, role_specialization_ids, location_port_id,
        shore_experience, motivation, languages, available_to_start, onboarding_version,
        avatar_url
      ) values (
        p_person_id, p_payload->>'display_name', p_payload->>'identity_type',
        (p_payload->>'primary_role_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x), '{}'),
        p_payload->>'bio', p_payload->>'agency_name',
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'role_specialization_ids') x), '{}'),
        (p_payload->>'location_port_id')::uuid,
        p_payload->>'shore_experience',
        p_payload->>'motivation',
        coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'languages') x), '{}'),
        p_payload->>'available_to_start',
        coalesce((p_payload->>'onboarding_version')::int, 1),
        p_payload->>'avatar_url'
      );

    when 'PROFILE.UPDATED' then
      update public.profiles set
        display_name = coalesce(p_payload->>'display_name', display_name),
        primary_role_id = coalesce((p_payload->>'primary_role_id')::uuid, primary_role_id),
        certification_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x), certification_ids),
        experience_bracket_id = coalesce((p_payload->>'experience_bracket_id')::uuid, experience_bracket_id),
        vessel_size_exposure_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x), vessel_size_exposure_ids),
        bio = coalesce(p_payload->>'bio', bio),
        agency_name = coalesce(p_payload->>'agency_name', agency_name),
        role_specialization_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'role_specialization_ids') x), role_specialization_ids),
        location_port_id = coalesce((p_payload->>'location_port_id')::uuid, location_port_id),
        shore_experience = coalesce(p_payload->>'shore_experience', shore_experience),
        motivation = coalesce(p_payload->>'motivation', motivation),
        languages = coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'languages') x), languages),
        available_to_start = coalesce(p_payload->>'available_to_start', available_to_start),
        avatar_url = case when p_payload ? 'avatar_url' then p_payload->>'avatar_url' else avatar_url end,
        updated_at = now()
      where person_id = p_person_id;

    -- =========================================================================
    -- Vessel aggregate (vessel_operation removed — soft data lives on experiences)
    -- =========================================================================
    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag)
      values (
        (p_payload->>'id')::uuid,
        p_person_id,
        p_payload->>'imo_number',
        p_payload->>'name',
        coalesce(p_payload->>'vessel_type', 'motor'),
        (p_payload->>'size_band_id')::uuid,
        (p_payload->>'loa_meters')::numeric,
        coalesce((p_payload->>'nda_flag')::boolean, false)
      );

    when 'VESSEL.UPDATED' then
      update public.vessels set
        name             = coalesce(p_payload->>'name', name),
        vessel_type      = coalesce(p_payload->>'vessel_type', vessel_type),
        size_band_id     = coalesce((p_payload->>'size_band_id')::uuid, size_band_id),
        loa_meters       = coalesce((p_payload->>'loa_meters')::numeric, loa_meters),
        nda_flag         = coalesce((p_payload->>'nda_flag')::boolean, nda_flag),
        updated_at       = now()
      where id = p_aggregate_id::uuid
      and owner_person_id = p_person_id;

    -- =========================================================================
    -- Experience aggregate (with auto-derivation)
    -- =========================================================================
    when 'EXPERIENCE.ADDED' then
      insert into public.crew_experiences (
        id, person_id, vessel_id, role_id,
        start_date, end_date, is_current, vessel_operation,
        flag_state, salary_amount, salary_currency, salary_period,
        contract_type, contract_details, description
      ) values (
        (p_payload->>'id')::uuid,
        p_person_id,
        (p_payload->>'vessel_id')::uuid,
        (p_payload->>'role_id')::uuid,
        (p_payload->>'start_date')::date,
        (p_payload->>'end_date')::date,
        coalesce((p_payload->>'is_current')::boolean, false),
        p_payload->>'vessel_operation',
        p_payload->>'flag_state',
        (p_payload->>'salary_amount')::numeric,
        p_payload->>'salary_currency',
        p_payload->>'salary_period',
        p_payload->>'contract_type',
        p_payload->>'contract_details',
        p_payload->>'description'
      );
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.UPDATED' then
      update public.crew_experiences set
        role_id = coalesce((p_payload->>'role_id')::uuid, role_id),
        start_date = coalesce((p_payload->>'start_date')::date, start_date),
        end_date = case when p_payload ? 'end_date' then (p_payload->>'end_date')::date else end_date end,
        is_current = coalesce((p_payload->>'is_current')::boolean, is_current),
        vessel_operation = coalesce(p_payload->>'vessel_operation', vessel_operation),
        flag_state = coalesce(p_payload->>'flag_state', flag_state),
        salary_amount = coalesce((p_payload->>'salary_amount')::numeric, salary_amount),
        salary_currency = coalesce(p_payload->>'salary_currency', salary_currency),
        salary_period = coalesce(p_payload->>'salary_period', salary_period),
        contract_type = coalesce(p_payload->>'contract_type', contract_type),
        contract_details = coalesce(p_payload->>'contract_details', contract_details),
        description = coalesce(p_payload->>'description', description),
        updated_at = now()
      where id = p_aggregate_id::uuid
      and person_id = p_person_id;
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.REMOVED' then
      delete from public.crew_experiences
      where id = p_aggregate_id::uuid
      and person_id = p_person_id;
      perform public.derive_experience_profile(p_person_id);

    -- =========================================================================
    -- Daywork aggregate
    -- =========================================================================
    when 'DAYWORK.POSTED' then
      insert into public.dayworks (id, poster_person_id, role_context, vessel_id, role_id, location_port_id, start_date, end_date, working_days, required_certification_ids, experience_bracket_id, day_rate, currency, meals, notes, positions_available, permanent_opportunity)
      values ((p_payload->>'id')::uuid, p_person_id, p_role_context, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'location_port_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, (p_payload->>'working_days')::int, coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'), (p_payload->>'experience_bracket_id')::uuid, (p_payload->>'day_rate')::numeric, coalesce(p_payload->>'currency', 'EUR'), coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'), p_payload->>'notes', coalesce((p_payload->>'positions_available')::int, 1), coalesce((p_payload->>'permanent_opportunity')::boolean, false));

    when 'DAYWORK.CANCELLED_BY_EMPLOYER' then
      update public.dayworks set status = 'cancelled' where id = p_aggregate_id::uuid and poster_person_id = p_person_id;
      update public.daywork_invitations set status = 'revoked' where daywork_id = p_aggregate_id::uuid and status = 'pending';
      -- Cascade cancel all active engagements for this daywork
      update public.active_engagements set status = 'cancelled', cancelled_by = 'employer'
        where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'cancelled_by_employer', updated_at = now()
        where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.COMPLETED' then
      update public.dayworks set status = 'completed' where id = p_aggregate_id::uuid;
      update public.active_engagements set status = 'completed' where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'completed', updated_at = now() where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.RELISTED' then
      update public.dayworks set status = 'active', start_date = coalesce((p_payload->>'start_date')::date, start_date), end_date = coalesce((p_payload->>'end_date')::date, end_date), working_days = coalesce((p_payload->>'working_days')::int, working_days) where id = (p_payload->>'daywork_id')::uuid;
      update public.daywork_invitations set status = 'revoked' where daywork_id = (p_payload->>'daywork_id')::uuid and status = 'pending';

    when 'DAYWORK.POSITIONS_UPDATED' then
      -- Atomically update positions_available and check if fully filled
      update public.dayworks
        set positions_available = (p_payload->>'positions_available')::int
        where id = (p_payload->>'daywork_id')::uuid
        returning positions_filled, positions_available into v_filled, v_available;

      if v_filled >= v_available then
        -- Fully filled — transition to in_progress, reject remaining, revoke invitations
        update public.dayworks set status = 'in_progress' where id = (p_payload->>'daywork_id')::uuid and status = 'active';
        update public.applications set status = 'rejected', updated_at = now()
          where daywork_id = (p_payload->>'daywork_id')::uuid and status in ('applied', 'viewed', 'shortlisted');
        update public.daywork_invitations set status = 'revoked'
          where daywork_id = (p_payload->>'daywork_id')::uuid and status = 'pending';
      end if;

    when 'DAYWORK.APPLIED' then
      insert into public.applications (id, crew_person_id, daywork_id, status, message) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'daywork_id')::uuid, 'applied', p_payload->>'message');
      update public.daywork_invitations set status = 'accepted' where daywork_id = (p_payload->>'daywork_id')::uuid and crew_person_id = p_person_id and status = 'pending';

    when 'DAYWORK.VIEWED' then
      update public.applications set status = 'viewed', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'applied';

    when 'DAYWORK.SHORTLISTED' then
      update public.applications set status = 'shortlisted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      -- 1. Accept the application
      update public.applications set status = 'accepted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      -- 2. Create engagement
      insert into public.active_engagements (application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date) select a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date from public.applications a join public.dayworks d on d.id = a.daywork_id where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      -- 3. Atomically increment positions_filled and read new state
      update public.dayworks
        set positions_filled = positions_filled + 1
        where id = (split_part(p_aggregate_id, ':', 2))::uuid
        returning positions_filled, positions_available into v_filled, v_available;
      -- 4. Supersede THIS CREW's overlapping pending applications
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and status in ('applied', 'viewed', 'shortlisted') and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid and daywork_id in (select d2.id from public.dayworks d2 join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid where d2.start_date <= d1.end_date and d2.end_date >= d1.start_date);
      -- 5. Conditional fill logic: if fully filled, transition to in_progress + reject remaining + revoke invitations
      if v_filled >= v_available then
        update public.dayworks set status = 'in_progress' where id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'active';
        update public.applications set status = 'rejected', updated_at = now() where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted') and crew_person_id != (split_part(p_aggregate_id, ':', 1))::uuid;
        update public.daywork_invitations set status = 'revoked' where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'pending';
      end if;

    when 'DAYWORK.REJECTED' then
      update public.applications set status = 'rejected', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'APPLICATION.WITHDRAWN' then
      update public.applications set status = 'withdrawn', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.SUPERSEDED' then
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    -- =========================================================================
    -- Invitation events
    -- =========================================================================
    when 'DAYWORK.INVITED' then
      insert into public.daywork_invitations (daywork_id, crew_person_id, employer_person_id, status)
      values ((p_payload->>'daywork_id')::uuid, (p_payload->>'crew_person_id')::uuid, p_person_id, 'pending');

    when 'DAYWORK.INVITATION_ACCEPTED' then
      update public.daywork_invitations set status = 'accepted' where id = (p_payload->>'invitation_id')::uuid and status = 'pending';

    when 'DAYWORK.INVITATION_DECLINED' then
      update public.daywork_invitations set status = 'declined' where id = (p_payload->>'invitation_id')::uuid and status = 'pending';

    -- =========================================================================
    -- Engagement aggregate
    -- =========================================================================
    when 'ENGAGEMENT.CANCELLED_BY_CREW' then
      update public.applications set status = 'cancelled_by_crew', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'crew', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      -- Decrement positions_filled (no status revert — employer uses "Find replacement" CTA)
      update public.dayworks
        set positions_filled = greatest(positions_filled - 1, 0)
        where id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' then
      update public.applications set status = 'cancelled_by_employer', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'employer', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text', relist_requested = coalesce((p_payload->>'relist_requested')::boolean, false), relist_reason_category = p_payload->>'relist_reason_category', relist_reason_text = p_payload->>'relist_reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      -- Decrement positions_filled (no status revert — employer uses "Find replacement" CTA)
      update public.dayworks
        set positions_filled = greatest(positions_filled - 1, 0)
        where id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.POSTPONEMENT_PROPOSED' then
      update public.active_engagements set postponement_status = 'proposed', proposed_start_date = (p_payload->>'proposed_start_date')::date, proposed_end_date = (p_payload->>'proposed_end_date')::date, proposed_working_days = (p_payload->>'proposed_working_days')::int where id = (p_payload->>'engagement_id')::uuid and status = 'active';

    when 'ENGAGEMENT.POSTPONEMENT_ACCEPTED' then
      update public.active_engagements set start_date = (p_payload->>'new_start_date')::date, end_date = (p_payload->>'new_end_date')::date, postponement_status = 'accepted', proposed_start_date = null, proposed_end_date = null, proposed_working_days = null where id = (p_payload->>'engagement_id')::uuid;
      update public.dayworks set start_date = (p_payload->>'new_start_date')::date, end_date = (p_payload->>'new_end_date')::date, working_days = (p_payload->>'new_working_days')::int where id = (p_payload->>'daywork_id')::uuid;

    when 'ENGAGEMENT.POSTPONEMENT_REJECTED' then
      update public.active_engagements set status = 'cancelled', cancelled_by = 'postponement', postponement_status = 'rejected', cancellation_reason_category = 'postponement' where id = (p_payload->>'engagement_id')::uuid;
      update public.applications set status = 'cancelled_by_employer', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and daywork_id = (p_payload->>'daywork_id')::uuid;

    when 'ENGAGEMENT.WORK_STARTED' then
      update public.active_engagements set work_started_status = 'initiated_by_' || (p_payload->>'initiated_by') where id = (p_payload->>'engagement_id')::uuid and status = 'active' and work_started_status is null;

    when 'ENGAGEMENT.WORK_STARTED_CONFIRMED' then
      update public.active_engagements set work_started_status = 'confirmed', work_started_at = now() where id = (p_payload->>'engagement_id')::uuid and status = 'active' and work_started_status in ('initiated_by_crew', 'initiated_by_employer');

    when 'ENGAGEMENT.COMPLETION_CONFIRMED' then
      update public.active_engagements set crew_completion_status = 'confirmed' where id = p_aggregate_id::uuid and crew_person_id = p_person_id and status = 'completed';

    when 'ENGAGEMENT.COMPLETION_DISPUTED' then
      update public.active_engagements set crew_completion_status = 'disputed' where id = p_aggregate_id::uuid and crew_person_id = p_person_id and status = 'completed';

    when 'ENGAGEMENT.RATED_BY_CREW' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, communication_accuracy, overall_match, permanent_opportunity_accuracy) values (p_aggregate_id::uuid, p_person_id, 'crew', p_payload->>'pay_accuracy', p_payload->>'meals_accuracy', p_payload->>'role_accuracy', p_payload->>'working_days_accuracy', (p_payload->>'vessel_condition')::int, (p_payload->>'would_work_on_vessel_again')::boolean, (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int, p_payload->>'permanent_opportunity_accuracy');

    when 'ENGAGEMENT.RATED_BY_EMPLOYER' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, skills_as_advertised, certifications_verified, punctuality, would_rehire, communication_accuracy, overall_match) values (p_aggregate_id::uuid, p_person_id, 'employer', p_payload->>'skills_as_advertised', p_payload->>'certifications_verified', p_payload->>'punctuality', (p_payload->>'would_rehire')::boolean, (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

    when 'ENGAGEMENT.CANCELLATION_RATED_BY_CREW' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, rating_context, notice_given, communication_accuracy, overall_match) values (p_aggregate_id::uuid, p_person_id, 'crew', 'cancelled', p_payload->>'notice_given', (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

    when 'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, rating_context, communication_accuracy, overall_match) values (p_aggregate_id::uuid, p_person_id, 'employer', 'cancelled', (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

    when 'CHECKLIST.SET' then
      insert into public.engagement_checklists (engagement_id, items, acknowledged_item_ids, updated_at) values ((p_payload->>'engagement_id')::uuid, p_payload->'items', '{}', now()) on conflict (engagement_id) do update set items = excluded.items, acknowledged_item_ids = '{}', updated_at = now();

    when 'CHECKLIST.ITEM_TOGGLED' then
      if (p_payload->>'checked')::boolean then
        update public.engagement_checklists set acknowledged_item_ids = array_append(array_remove(acknowledged_item_ids, p_payload->>'item_id'), p_payload->>'item_id'), updated_at = now() where engagement_id = (p_payload->>'engagement_id')::uuid;
      else
        update public.engagement_checklists set acknowledged_item_ids = array_remove(acknowledged_item_ids, p_payload->>'item_id'), updated_at = now() where engagement_id = (p_payload->>'engagement_id')::uuid;
      end if;

    when 'AVAILABILITY.SET' then
      if coalesce((p_payload->>'not_available')::boolean, false) then
        update public.availability_windows set expires_at = now() where person_id = p_person_id and expires_at > now();
        insert into public.availability_windows (person_id, date, expires_at, city_id, port_id, not_available)
        values (p_person_id, current_date, (p_payload->>'expires_at')::timestamptz, (p_payload->>'city_id')::uuid, (p_payload->>'port_id')::uuid, true)
        on conflict (person_id, date) do update set expires_at = excluded.expires_at, city_id = excluded.city_id, port_id = excluded.port_id, not_available = true, created_at = now();
      else
        update public.availability_windows set expires_at = now() where person_id = p_person_id and not_available = true and expires_at > now();
        insert into public.availability_windows (person_id, date, expires_at, city_id, port_id, not_available)
        select p_person_id, d::date, (p_payload->>'expires_at')::timestamptz, (p_payload->>'city_id')::uuid, (p_payload->>'port_id')::uuid, false
        from generate_series((p_payload->>'start_date')::date, (p_payload->>'end_date')::date, '1 day'::interval) d
        on conflict (person_id, date) do update set expires_at = excluded.expires_at, city_id = excluded.city_id, port_id = excluded.port_id, not_available = false, created_at = now();
      end if;

    when 'MESSAGE.SENT' then
      insert into public.messages (id, engagement_id, sender_person_id, content, is_system) values ((p_payload->>'id')::uuid, p_aggregate_id::uuid, p_person_id, p_payload->>'content', coalesce((p_payload->>'is_system')::boolean, false));

    else
      raise notice 'Unknown event type: %', p_event_type;
  end case;
end;
$$;
