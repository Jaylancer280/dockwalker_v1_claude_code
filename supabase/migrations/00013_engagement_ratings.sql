-- =============================================================================
-- Migration 00013: Engagement ratings
-- =============================================================================
-- After both parties confirm completion, each can rate the job/interaction.
-- Ratings capture accuracy of listing, working conditions, and match quality.
-- These are internal DockWalker intelligence — never shown to the other party.
-- =============================================================================

-- Create engagement_ratings table
create table public.engagement_ratings (
  id uuid primary key default uuid_generate_v4(),
  engagement_id uuid not null references public.active_engagements(id),
  rater_person_id uuid not null references public.persons(id),
  rater_role text not null check (rater_role in ('crew', 'employer')),

  -- Crew-specific (NULL for employer ratings)
  pay_accuracy text check (pay_accuracy in ('yes', 'no', 'partial')),
  meals_accuracy text check (meals_accuracy in ('yes', 'no', 'partial')),
  role_accuracy text check (role_accuracy in ('yes', 'no', 'partial')),
  working_days_accuracy text check (working_days_accuracy in ('fewer', 'as_listed', 'more')),
  vessel_condition int check (vessel_condition between 1 and 5),
  would_work_on_vessel_again boolean,

  -- Employer-specific (NULL for crew ratings)
  skills_as_advertised text check (skills_as_advertised in ('yes', 'no', 'partial')),
  certifications_verified text check (certifications_verified in ('yes', 'no', 'not_checked')),
  punctuality text check (punctuality in ('yes', 'no', 'partial')),
  would_rehire boolean,

  -- Symmetric (both roles)
  communication_accuracy boolean not null,
  overall_match int not null check (overall_match between 1 and 5),

  created_at timestamptz not null default now(),

  -- One rating per person per engagement
  unique (engagement_id, rater_person_id)
);

-- RLS
alter table public.engagement_ratings enable row level security;

-- Users can only read their own ratings
create policy "Users can read own ratings"
  on public.engagement_ratings for select
  using (rater_person_id = auth.uid());

-- Insert via service role only (through append_event)
create policy "Service role can insert ratings"
  on public.engagement_ratings for insert
  with check (true);

-- Update apply_projection to handle rating events
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

    -- =========================================================================
    -- Person aggregate
    -- =========================================================================
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

    -- =========================================================================
    -- Profile aggregate
    -- =========================================================================
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

    -- =========================================================================
    -- Vessel aggregate
    -- =========================================================================
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

    when 'DAYWORK.SHORTLISTED' then
      update public.applications
      set status = 'shortlisted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      -- Update application status
      update public.applications
      set status = 'accepted', updated_at = now()
      where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      -- Create active engagement
      insert into public.active_engagements (
        application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date
      )
      select
        a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date
      from public.applications a
      join public.dayworks d on d.id = a.daywork_id
      where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid
      and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

      -- Move daywork to in_progress (no longer discoverable)
      update public.dayworks
      set status = 'in_progress'
      where id = (split_part(p_aggregate_id, ':', 2))::uuid
      and status = 'active';

      -- Auto-supersede overlapping pending/shortlisted applications
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

      -- Reject remaining pending/shortlisted applications for this daywork
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

    -- =========================================================================
    -- Engagement aggregate
    -- =========================================================================
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

    when 'ENGAGEMENT.RATED_BY_CREW' then
      insert into public.engagement_ratings (
        engagement_id, rater_person_id, rater_role,
        pay_accuracy, meals_accuracy, role_accuracy,
        working_days_accuracy, vessel_condition, would_work_on_vessel_again,
        communication_accuracy, overall_match
      )
      values (
        p_aggregate_id::uuid,
        p_person_id,
        'crew',
        p_payload->>'pay_accuracy',
        p_payload->>'meals_accuracy',
        p_payload->>'role_accuracy',
        p_payload->>'working_days_accuracy',
        (p_payload->>'vessel_condition')::int,
        (p_payload->>'would_work_on_vessel_again')::boolean,
        (p_payload->>'communication_accuracy')::boolean,
        (p_payload->>'overall_match')::int
      );

    when 'ENGAGEMENT.RATED_BY_EMPLOYER' then
      insert into public.engagement_ratings (
        engagement_id, rater_person_id, rater_role,
        skills_as_advertised, certifications_verified, punctuality,
        would_rehire,
        communication_accuracy, overall_match
      )
      values (
        p_aggregate_id::uuid,
        p_person_id,
        'employer',
        p_payload->>'skills_as_advertised',
        p_payload->>'certifications_verified',
        p_payload->>'punctuality',
        (p_payload->>'would_rehire')::boolean,
        (p_payload->>'communication_accuracy')::boolean,
        (p_payload->>'overall_match')::int
      );

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

  return new;
end;
$$;
