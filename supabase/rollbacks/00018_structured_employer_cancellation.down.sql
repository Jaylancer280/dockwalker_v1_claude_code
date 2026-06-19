-- =============================================================================
-- Rollback 00018: Structured employer cancellation mechanic
-- =============================================================================

-- 1. Drop new RPC
drop function if exists public.check_no_overlap_excluding(uuid, date, date, uuid);

-- 2. Remove added columns from active_engagements
alter table public.active_engagements
  drop column if exists cancellation_reason_category,
  drop column if exists cancellation_reason_text,
  drop column if exists relist_requested,
  drop column if exists relist_reason_category,
  drop column if exists relist_reason_text,
  drop column if exists postponement_status,
  drop column if exists proposed_start_date,
  drop column if exists proposed_end_date,
  drop column if exists proposed_working_days;

-- 3. Remove is_system from messages
alter table public.messages
  drop column if exists is_system;

-- 4. Remove rating_context and notice_given from engagement_ratings
alter table public.engagement_ratings
  drop column if exists rating_context,
  drop column if exists notice_given;

-- 5. Restore apply_projection to 00016 state (without new event handlers)
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
        person_id, display_name, identity_type, primary_role_id, certification_ids,
        experience_bracket_id, vessel_size_exposure_ids, bio, agency_name,
        role_specialization_ids, location_port_id
      ) values (
        p_person_id, p_payload->>'display_name', p_payload->>'identity_type',
        (p_payload->>'primary_role_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x), '{}'),
        p_payload->>'bio', p_payload->>'agency_name',
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'role_specialization_ids') x), '{}'),
        (p_payload->>'location_port_id')::uuid
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
        updated_at = now()
      where person_id = p_person_id;

    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, nda_flag)
      values ((p_payload->>'id')::uuid, p_person_id, p_payload->>'imo_number', p_payload->>'name',
        p_payload->>'vessel_type', (p_payload->>'size_band_id')::uuid, coalesce((p_payload->>'nda_flag')::boolean, false));

    when 'VESSEL.UPDATED' then
      update public.vessels set
        name = coalesce(p_payload->>'name', name),
        vessel_type = coalesce(p_payload->>'vessel_type', vessel_type),
        size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id),
        nda_flag = coalesce((p_payload->>'nda_flag')::boolean, nda_flag),
        updated_at = now()
      where id = p_aggregate_id::uuid and owner_person_id = p_person_id;

    when 'DAYWORK.POSTED' then
      insert into public.dayworks (id, poster_person_id, role_context, vessel_id, role_id,
        location_port_id, start_date, end_date, working_days, required_certification_ids,
        experience_bracket_id, day_rate, currency, meals, notes)
      values ((p_payload->>'id')::uuid, p_person_id, p_role_context, (p_payload->>'vessel_id')::uuid,
        (p_payload->>'role_id')::uuid, (p_payload->>'location_port_id')::uuid,
        (p_payload->>'start_date')::date, (p_payload->>'end_date')::date,
        (p_payload->>'working_days')::int,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid, (p_payload->>'day_rate')::numeric,
        coalesce(p_payload->>'currency', 'EUR'),
        coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'),
        p_payload->>'notes');

    when 'DAYWORK.CANCELLED_BY_EMPLOYER' then
      update public.dayworks set status = 'cancelled' where id = p_aggregate_id::uuid and poster_person_id = p_person_id;

    when 'DAYWORK.COMPLETED' then
      update public.dayworks set status = 'completed' where id = p_aggregate_id::uuid;
      update public.active_engagements set status = 'completed' where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'completed', updated_at = now() where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.APPLIED' then
      insert into public.applications (id, crew_person_id, daywork_id, status, message)
      values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'daywork_id')::uuid, 'applied', p_payload->>'message');

    when 'DAYWORK.VIEWED' then
      update public.applications set status = 'viewed', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'applied';

    when 'DAYWORK.SHORTLISTED' then
      update public.applications set status = 'shortlisted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      update public.applications set status = 'accepted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      insert into public.active_engagements (application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date)
      select a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date
      from public.applications a join public.dayworks d on d.id = a.daywork_id
      where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.dayworks set status = 'in_progress' where id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'active';
      update public.applications set status = 'superseded', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and status in ('applied', 'viewed', 'shortlisted')
      and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid
      and daywork_id in (select d2.id from public.dayworks d2 join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid where d2.start_date <= d1.end_date and d2.end_date >= d1.start_date);
      update public.applications set status = 'rejected', updated_at = now()
      where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted') and crew_person_id != (split_part(p_aggregate_id, ':', 1))::uuid;

    when 'DAYWORK.REJECTED' then
      update public.applications set status = 'rejected', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'APPLICATION.WITHDRAWN' then
      update public.applications set status = 'withdrawn', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.SUPERSEDED' then
      update public.applications set status = 'superseded', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_CREW' then
      update public.applications set status = 'cancelled_by_crew', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled'
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' then
      update public.applications set status = 'cancelled_by_employer', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled'
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.COMPLETION_CONFIRMED' then
      update public.active_engagements set crew_completion_status = 'confirmed' where id = p_aggregate_id::uuid and crew_person_id = p_person_id and status = 'completed';

    when 'ENGAGEMENT.COMPLETION_DISPUTED' then
      update public.active_engagements set crew_completion_status = 'disputed' where id = p_aggregate_id::uuid and crew_person_id = p_person_id and status = 'completed';

    when 'ENGAGEMENT.RATED_BY_CREW' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, communication_accuracy, overall_match)
      values (p_aggregate_id::uuid, p_person_id, 'crew', p_payload->>'pay_accuracy', p_payload->>'meals_accuracy', p_payload->>'role_accuracy', p_payload->>'working_days_accuracy', (p_payload->>'vessel_condition')::int, (p_payload->>'would_work_on_vessel_again')::boolean, (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

    when 'ENGAGEMENT.RATED_BY_EMPLOYER' then
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, skills_as_advertised, certifications_verified, punctuality, would_rehire, communication_accuracy, overall_match)
      values (p_aggregate_id::uuid, p_person_id, 'employer', p_payload->>'skills_as_advertised', p_payload->>'certifications_verified', p_payload->>'punctuality', (p_payload->>'would_rehire')::boolean, (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

    when 'AVAILABILITY.SET' then
      insert into public.availability_windows (person_id, date, expires_at)
      select p_person_id, d::date, (p_payload->>'expires_at')::timestamptz
      from generate_series((p_payload->>'start_date')::date, (p_payload->>'end_date')::date, '1 day'::interval) d
      on conflict (person_id, date) do update set expires_at = excluded.expires_at, created_at = now();

    when 'MESSAGE.SENT' then
      insert into public.messages (id, engagement_id, sender_person_id, content)
      values ((p_payload->>'id')::uuid, p_aggregate_id::uuid, p_person_id, p_payload->>'content');

    else
      raise notice 'Unknown event type: %', p_event_type;
  end case;
end;
$$;
