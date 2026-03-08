-- =============================================================================
-- Rollback 00013: Remove engagement ratings
-- =============================================================================

-- Drop the ratings table
drop table if exists public.engagement_ratings;

-- Restore apply_projection from migration 00012 (without rating events)
create or replace function public.apply_projection()
returns trigger
language plpgsql
security definer
as $$
declare
  p_event_type  text    := new.event_type;
  p_aggregate_id text   := new.aggregate_id;
  p_role_context text   := new.role_context;
  p_payload     jsonb   := new.payload;
  p_person_id   uuid    := new.person_id;
begin
  case p_event_type

    when 'PERSON.CREATED' then
      insert into public.persons (id, identity_type, current_hat)
      values (
        p_person_id,
        p_payload->>'identity_type',
        p_payload->>'current_hat'
      )
      on conflict (id) do nothing;

    when 'PERSON.HAT_CHANGED' then
      update public.persons
      set current_hat = p_payload->>'new_hat'
      where id = p_person_id;

    when 'PERSON.DEACTIVATED' then
      update public.persons
      set current_hat = 'deactivated'
      where id = p_person_id;

    when 'PROFILE.CREATED' then
      insert into public.profiles (
        person_id, display_name, primary_role_id,
        certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio, location_port_id
      )
      values (
        p_person_id,
        p_payload->>'display_name',
        (p_payload->>'primary_role_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x), '{}'),
        p_payload->>'bio',
        (p_payload->>'location_port_id')::uuid
      );

    when 'PROFILE.UPDATED' then
      update public.profiles set
        display_name             = coalesce(p_payload->>'display_name', display_name),
        primary_role_id          = coalesce((p_payload->>'primary_role_id')::uuid, primary_role_id),
        certification_ids        = coalesce(
          (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x),
          certification_ids
        ),
        experience_bracket_id    = coalesce((p_payload->>'experience_bracket_id')::uuid, experience_bracket_id),
        vessel_size_exposure_ids = coalesce(
          (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x),
          vessel_size_exposure_ids
        ),
        bio                      = coalesce(p_payload->>'bio', bio),
        location_port_id         = coalesce((p_payload->>'location_port_id')::uuid, location_port_id),
        updated_at               = now()
      where person_id = p_person_id;

    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, nda_flag)
      values (
        (p_payload->>'id')::uuid,
        p_person_id,
        p_payload->>'imo_number',
        p_payload->>'name',
        p_payload->>'vessel_type',
        (p_payload->>'size_band_id')::uuid,
        coalesce((p_payload->>'nda_flag')::boolean, false)
      );

    when 'VESSEL.UPDATED' then
      update public.vessels set
        name        = coalesce(p_payload->>'name', name),
        vessel_type = coalesce(p_payload->>'vessel_type', vessel_type),
        size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id),
        nda_flag    = coalesce((p_payload->>'nda_flag')::boolean, nda_flag),
        updated_at  = now()
      where id = p_aggregate_id::uuid
      and owner_person_id = p_person_id;

    when 'DAYWORK.POSTED' then
      insert into public.dayworks (
        id, poster_person_id, role_context, vessel_id, role_id,
        location_port_id, start_date, end_date, working_days,
        required_certification_ids, experience_bracket_id,
        day_rate, currency, meals, notes
      )
      values (
        (p_payload->>'id')::uuid,
        p_person_id,
        p_role_context,
        (p_payload->>'vessel_id')::uuid,
        (p_payload->>'role_id')::uuid,
        (p_payload->>'location_port_id')::uuid,
        (p_payload->>'start_date')::date,
        (p_payload->>'end_date')::date,
        (p_payload->>'working_days')::int,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid,
        (p_payload->>'day_rate')::numeric,
        coalesce(p_payload->>'currency', 'EUR'),
        coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'),
        p_payload->>'notes'
      );

    when 'DAYWORK.CANCELLED_BY_EMPLOYER' then
      update public.dayworks
      set status = 'cancelled'
      where id = p_aggregate_id::uuid
      and poster_person_id = p_person_id;

    when 'DAYWORK.COMPLETED' then
      update public.dayworks
      set status = 'completed'
      where id = p_aggregate_id::uuid;

      update public.active_engagements
      set status = 'completed'
      where daywork_id = p_aggregate_id::uuid
      and status = 'active';

      update public.applications
      set status = 'completed',
          updated_at = now()
      where daywork_id = p_aggregate_id::uuid
      and status = 'accepted';

    when 'DAYWORK.APPLIED' then
      insert into public.applications (id, crew_person_id, daywork_id, status, message)
      values (
        (p_payload->>'id')::uuid,
        p_person_id,
        (p_payload->>'daywork_id')::uuid,
        'applied',
        p_payload->>'message'
      );

    when 'DAYWORK.VIEWED' then
      update public.applications
      set status = 'viewed', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status = 'applied';

    when 'DAYWORK.SHORTLISTED' then
      update public.applications
      set status = 'shortlisted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      update public.applications
      set status = 'accepted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      insert into public.active_engagements (
        application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date
      )
      select
        a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date
      from public.applications a
      join public.dayworks d on d.id = a.daywork_id
      where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      update public.dayworks
      set status = 'in_progress'
      where id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status = 'active';

      update public.applications
      set status = 'superseded', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and status in ('applied', 'viewed', 'shortlisted')
      and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid
      and daywork_id in (
        select d2.id from public.dayworks d2
        join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid
        where d2.start_date <= d1.end_date
        and d2.end_date >= d1.start_date
      );

      update public.applications
      set status = 'rejected', updated_at = now()
      where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status in ('applied', 'viewed', 'shortlisted')
      and crew_person_id != (split_part(p_aggregate_id, ':', 1))::uuid;

    when 'DAYWORK.REJECTED' then
      update public.applications
      set status = 'rejected', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'APPLICATION.WITHDRAWN' then
      update public.applications
      set status = 'withdrawn', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.SUPERSEDED' then
      update public.applications
      set status = 'superseded', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_CREW' then
      update public.applications
      set status = 'cancelled_by_crew', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      update public.active_engagements
      set status = 'cancelled'
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' then
      update public.applications
      set status = 'cancelled_by_employer', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      update public.active_engagements
      set status = 'cancelled'
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.COMPLETION_CONFIRMED' then
      update public.active_engagements
      set crew_completion_status = 'confirmed'
      where id = p_aggregate_id::uuid
      and crew_person_id = p_person_id
      and status = 'completed';

    when 'ENGAGEMENT.COMPLETION_DISPUTED' then
      update public.active_engagements
      set crew_completion_status = 'disputed'
      where id = p_aggregate_id::uuid
      and crew_person_id = p_person_id
      and status = 'completed';

    when 'AVAILABILITY.SET' then
      insert into public.availability_windows (person_id, date, expires_at)
      select
        p_person_id,
        d::date,
        (p_payload->>'expires_at')::timestamptz
      from generate_series(
        (p_payload->>'start_date')::date,
        (p_payload->>'end_date')::date,
        '1 day'::interval
      ) d
      on conflict (person_id, date)
      do update set expires_at = excluded.expires_at, created_at = now();

    when 'MESSAGE.SENT' then
      insert into public.messages (id, engagement_id, sender_person_id, content)
      values (
        (p_payload->>'id')::uuid,
        p_aggregate_id::uuid,
        p_person_id,
        p_payload->>'content'
      );

    when 'MESSAGE.HIDDEN' then
      update public.messages
      set hidden_by = array_append(coalesce(hidden_by, '{}'::uuid[]), p_person_id)
      where id = p_aggregate_id::uuid
      and (
        (p_payload->>'engagement_id') is null
        or engagement_id = (p_payload->>'engagement_id')::uuid
      )
      and not (p_person_id = any(coalesce(hidden_by, '{}'::uuid[])));

    else
      raise notice 'Unknown event type: %', p_event_type;
  end case;

  return new;
end;
$$;
