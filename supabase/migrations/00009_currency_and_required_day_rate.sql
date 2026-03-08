-- =============================================================================
-- Add currency field to dayworks and templates, make day_rate required
-- =============================================================================

-- Add currency column to dayworks
alter table public.dayworks
  add column currency text not null default 'EUR'
  check (currency in ('EUR', 'USD', 'GBP', 'AED'));

-- Make day_rate NOT NULL (set any existing NULLs to 0 first for safety)
update public.dayworks set day_rate = 0 where day_rate is null;
alter table public.dayworks
  alter column day_rate set not null,
  alter column day_rate set default 0;

-- Add currency column to templates (nullable since templates are partial)
alter table public.daywork_templates
  add column currency text default 'EUR'
  check (currency in ('EUR', 'USD', 'GBP', 'AED'));

-- Update apply_projection to handle currency in DAYWORK.POSTED
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

    -- =========================================================================
    -- Person aggregate
    -- =========================================================================
    when 'PERSON.CREATED' then
      insert into public.persons (id, identity_type, current_hat)
      values (
        p_person_id,
        p_payload->>'identity_type',
        p_payload->>'current_hat'
      );

    when 'PERSON.HAT_CHANGED' then
      update public.persons
      set current_hat = p_payload->>'current_hat'
      where id = p_person_id;

    when 'PERSON.DEACTIVATED' then
      update public.persons
      set deactivated_at = now()
      where id = p_person_id;

    when 'PERSON.DATA_SCRUBBED' then
      update public.profiles
      set display_name = 'Deleted User',
          bio = null,
          agency_name = null,
          updated_at = now()
      where person_id = p_person_id;

    -- =========================================================================
    -- Profile
    -- =========================================================================
    when 'PROFILE.CREATED' then
      insert into public.profiles (
        person_id, display_name, identity_type,
        primary_role_id, certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio,
        agency_name, role_specialization_ids,
        location_port_id
      )
      values (
        p_person_id,
        p_payload->>'display_name',
        p_payload->>'identity_type',
        (p_payload->>'primary_role_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x), '{}'),
        (p_payload->>'experience_bracket_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x), '{}'),
        p_payload->>'bio',
        p_payload->>'agency_name',
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'role_specialization_ids') x), '{}'),
        (p_payload->>'location_port_id')::uuid
      );

    when 'PROFILE.UPDATED' then
      update public.profiles
      set display_name = coalesce(p_payload->>'display_name', display_name),
          primary_role_id = coalesce((p_payload->>'primary_role_id')::uuid, primary_role_id),
          certification_ids = coalesce(
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'certification_ids') x),
            certification_ids
          ),
          experience_bracket_id = coalesce((p_payload->>'experience_bracket_id')::uuid, experience_bracket_id),
          vessel_size_exposure_ids = coalesce(
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'vessel_size_exposure_ids') x),
            vessel_size_exposure_ids
          ),
          bio = coalesce(p_payload->>'bio', bio),
          agency_name = coalesce(p_payload->>'agency_name', agency_name),
          role_specialization_ids = coalesce(
            (select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'role_specialization_ids') x),
            role_specialization_ids
          ),
          location_port_id = coalesce((p_payload->>'location_port_id')::uuid, location_port_id),
          updated_at = now()
      where person_id = p_person_id;

    -- =========================================================================
    -- Vessel aggregate
    -- =========================================================================
    when 'VESSEL.CREATED' then
      insert into public.vessels (id, imo_number, name, vessel_type, size_band_id, nda_flag, owner_person_id)
      values (
        (p_payload->>'id')::uuid,
        p_payload->>'imo_number',
        p_payload->>'name',
        p_payload->>'vessel_type',
        (p_payload->>'size_band_id')::uuid,
        coalesce((p_payload->>'nda_flag')::boolean, false),
        p_person_id
      );

    when 'VESSEL.UPDATED' then
      update public.vessels
      set name = coalesce(p_payload->>'name', name),
          vessel_type = coalesce(p_payload->>'vessel_type', vessel_type),
          size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id),
          nda_flag = coalesce((p_payload->>'nda_flag')::boolean, nda_flag),
          updated_at = now()
      where id = p_aggregate_id::uuid
      and owner_person_id = p_person_id;

    -- =========================================================================
    -- Daywork aggregate
    -- =========================================================================
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

    -- =========================================================================
    -- Application aggregate
    -- =========================================================================
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

      update public.applications
      set status = 'superseded', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and status in ('applied', 'viewed')
      and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid
      and daywork_id in (
        select d2.id from public.dayworks d2
        join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid
        where d2.start_date <= d1.end_date
        and d2.end_date >= d1.start_date
      );

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
      and status in ('applied', 'viewed');

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

    -- =========================================================================
    -- Availability
    -- =========================================================================
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

    -- =========================================================================
    -- Messages
    -- =========================================================================
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
end;
$$;
