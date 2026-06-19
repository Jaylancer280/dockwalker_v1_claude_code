-- =============================================================================
-- Migration 00028: Crew experiences + green crew profile fields
--
-- Adds crew_experiences table for vessel work history, extends profiles with
-- green crew fields (shore_experience, motivation, languages, available_to_start,
-- onboarding_version), adds canonical flag_states lookup, and changes vessel
-- IMO uniqueness from global to per-registrant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Canonical flag states lookup
-- -----------------------------------------------------------------------------
create table public.flag_states (
  id text primary key,
  name text not null,
  sort_order int not null default 0
);

alter table public.flag_states enable row level security;

create policy "Authenticated users can read flag states"
  on public.flag_states for select
  using (auth.role() = 'authenticated');

-- Populate with common maritime flag states
insert into public.flag_states (id, name, sort_order) values
  ('GBR', 'United Kingdom (Red Ensign)', 1),
  ('CYM', 'Cayman Islands', 2),
  ('MHL', 'Marshall Islands', 3),
  ('MLT', 'Malta', 4),
  ('BHS', 'Bahamas', 5),
  ('BMU', 'Bermuda', 6),
  ('GIB', 'Gibraltar', 7),
  ('IMO', 'Isle of Man', 8),
  ('JEY', 'Jersey', 9),
  ('GGY', 'Guernsey', 10),
  ('PAN', 'Panama', 11),
  ('LBR', 'Liberia', 12),
  ('VCT', 'St Vincent & The Grenadines', 13),
  ('ATG', 'Antigua & Barbuda', 14),
  ('VUT', 'Vanuatu', 15),
  ('ITA', 'Italy', 16),
  ('FRA', 'France', 17),
  ('ESP', 'Spain', 18),
  ('GRC', 'Greece', 19),
  ('NLD', 'Netherlands', 20),
  ('DEU', 'Germany', 21),
  ('USA', 'United States', 22),
  ('AUS', 'Australia', 23),
  ('NZL', 'New Zealand', 24),
  ('CAN', 'Canada', 25),
  ('ARE', 'United Arab Emirates', 26),
  ('TUR', 'Turkey', 27),
  ('HRV', 'Croatia', 28),
  ('MNE', 'Montenegro', 29),
  ('JAM', 'Jamaica', 30),
  ('CUW', 'Curaçao', 31),
  ('BEL', 'Belgium', 32),
  ('NOR', 'Norway', 33),
  ('DNK', 'Denmark', 34),
  ('SWE', 'Sweden', 35),
  ('FIN', 'Finland', 36),
  ('PRT', 'Portugal', 37),
  ('BRB', 'Barbados', 38),
  ('OTHER', 'Other', 99);

-- -----------------------------------------------------------------------------
-- 2. Extend profiles table with green crew fields
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column shore_experience text check (char_length(shore_experience) <= 250),
  add column motivation text check (char_length(motivation) <= 250),
  add column languages text[] not null default '{}',
  add column available_to_start text check (available_to_start in ('immediate', 'within_1_week', 'within_2_weeks', 'within_1_month')),
  add column onboarding_version int not null default 1;

-- -----------------------------------------------------------------------------
-- 3. Change vessel IMO uniqueness from global to per-registrant
-- -----------------------------------------------------------------------------
alter table public.vessels drop constraint vessels_imo_number_key;
alter table public.vessels add constraint vessels_imo_per_owner unique (imo_number, owner_person_id);

-- -----------------------------------------------------------------------------
-- 4. Crew experiences table
-- -----------------------------------------------------------------------------
create table public.crew_experiences (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.persons(id),
  vessel_id uuid not null references public.vessels(id),
  role_id uuid not null references public.yacht_roles(id),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  charter_or_private text not null check (charter_or_private in ('charter', 'private')),
  flag_state text references public.flag_states(id),
  salary_amount numeric,
  salary_currency text check (salary_currency in ('EUR', 'USD', 'GBP', 'AED')),
  salary_period text check (salary_period in ('daily', 'monthly', 'annually')),
  rotation_type text check (rotation_type in ('2:2', '3:1', '3:3', '5:1', 'permanent', 'seasonal', 'mlc_standard', 'other')),
  rotation_details text check (char_length(rotation_details) <= 100),
  description text check (char_length(description) <= 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crew_experiences_person on public.crew_experiences(person_id);

alter table public.crew_experiences enable row level security;

-- Owner can read their own experiences
create policy "Users can read own experiences"
  on public.crew_experiences for select
  using (person_id = auth.uid());

-- Any authenticated user can read any non-deactivated person's experiences
create policy "Authenticated users can read any active person experiences"
  on public.crew_experiences for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.persons
      where persons.id = crew_experiences.person_id
      and persons.deactivated_at is null
    )
  );

-- Writes go through service client (append_event)

-- -----------------------------------------------------------------------------
-- 5. Update apply_projection with EXPERIENCE.* handlers and new profile fields
-- -----------------------------------------------------------------------------
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
        person_id, display_name, identity_type,
        primary_role_id, certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio, agency_name, role_specialization_ids, location_port_id,
        shore_experience, motivation, languages, available_to_start, onboarding_version
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
        coalesce((p_payload->>'onboarding_version')::int, 1)
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
        updated_at = now()
      where person_id = p_person_id;

    -- =========================================================================
    -- Vessel aggregate
    -- =========================================================================
    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag)
      values (
        (p_payload->>'id')::uuid,
        p_person_id,
        p_payload->>'imo_number',
        p_payload->>'name',
        p_payload->>'vessel_type',
        (p_payload->>'size_band_id')::uuid,
        (p_payload->>'loa_meters')::numeric,
        coalesce((p_payload->>'nda_flag')::boolean, false)
      );

    when 'VESSEL.UPDATED' then
      update public.vessels set
        name        = coalesce(p_payload->>'name', name),
        vessel_type = coalesce(p_payload->>'vessel_type', vessel_type),
        size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id),
        loa_meters  = coalesce((p_payload->>'loa_meters')::numeric, loa_meters),
        nda_flag    = coalesce((p_payload->>'nda_flag')::boolean, nda_flag),
        updated_at  = now()
      where id = p_aggregate_id::uuid
      and owner_person_id = p_person_id;

    -- =========================================================================
    -- Experience aggregate
    -- =========================================================================
    when 'EXPERIENCE.ADDED' then
      insert into public.crew_experiences (
        id, person_id, vessel_id, role_id,
        start_date, end_date, is_current, charter_or_private,
        flag_state, salary_amount, salary_currency, salary_period,
        rotation_type, rotation_details, description
      ) values (
        (p_payload->>'id')::uuid,
        p_person_id,
        (p_payload->>'vessel_id')::uuid,
        (p_payload->>'role_id')::uuid,
        (p_payload->>'start_date')::date,
        (p_payload->>'end_date')::date,
        coalesce((p_payload->>'is_current')::boolean, false),
        p_payload->>'charter_or_private',
        p_payload->>'flag_state',
        (p_payload->>'salary_amount')::numeric,
        p_payload->>'salary_currency',
        p_payload->>'salary_period',
        p_payload->>'rotation_type',
        p_payload->>'rotation_details',
        p_payload->>'description'
      );

    when 'EXPERIENCE.UPDATED' then
      update public.crew_experiences set
        role_id = coalesce((p_payload->>'role_id')::uuid, role_id),
        start_date = coalesce((p_payload->>'start_date')::date, start_date),
        end_date = case when p_payload ? 'end_date' then (p_payload->>'end_date')::date else end_date end,
        is_current = coalesce((p_payload->>'is_current')::boolean, is_current),
        charter_or_private = coalesce(p_payload->>'charter_or_private', charter_or_private),
        flag_state = coalesce(p_payload->>'flag_state', flag_state),
        salary_amount = coalesce((p_payload->>'salary_amount')::numeric, salary_amount),
        salary_currency = coalesce(p_payload->>'salary_currency', salary_currency),
        salary_period = coalesce(p_payload->>'salary_period', salary_period),
        rotation_type = coalesce(p_payload->>'rotation_type', rotation_type),
        rotation_details = coalesce(p_payload->>'rotation_details', rotation_details),
        description = coalesce(p_payload->>'description', description),
        updated_at = now()
      where id = p_aggregate_id::uuid
      and person_id = p_person_id;

    when 'EXPERIENCE.REMOVED' then
      delete from public.crew_experiences
      where id = p_aggregate_id::uuid
      and person_id = p_person_id;

    -- =========================================================================
    -- Daywork aggregate
    -- =========================================================================
    when 'DAYWORK.POSTED' then
      insert into public.dayworks (id, poster_person_id, role_context, vessel_id, role_id, location_port_id, start_date, end_date, working_days, required_certification_ids, experience_bracket_id, day_rate, currency, meals, notes)
      values ((p_payload->>'id')::uuid, p_person_id, p_role_context, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'location_port_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, (p_payload->>'working_days')::int, coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'), (p_payload->>'experience_bracket_id')::uuid, (p_payload->>'day_rate')::numeric, coalesce(p_payload->>'currency', 'EUR'), coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'), p_payload->>'notes');

    when 'DAYWORK.CANCELLED_BY_EMPLOYER' then
      update public.dayworks set status = 'cancelled' where id = p_aggregate_id::uuid and poster_person_id = p_person_id;

    when 'DAYWORK.COMPLETED' then
      update public.dayworks set status = 'completed' where id = p_aggregate_id::uuid;
      update public.active_engagements set status = 'completed' where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'completed', updated_at = now() where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.RELISTED' then
      update public.dayworks set status = 'active', start_date = coalesce((p_payload->>'start_date')::date, start_date), end_date = coalesce((p_payload->>'end_date')::date, end_date), working_days = coalesce((p_payload->>'working_days')::int, working_days) where id = (p_payload->>'daywork_id')::uuid;

    when 'DAYWORK.APPLIED' then
      insert into public.applications (id, crew_person_id, daywork_id, status, message) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'daywork_id')::uuid, 'applied', p_payload->>'message');

    when 'DAYWORK.VIEWED' then
      update public.applications set status = 'viewed', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'applied';

    when 'DAYWORK.SHORTLISTED' then
      update public.applications set status = 'shortlisted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      update public.applications set status = 'accepted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      insert into public.active_engagements (application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date) select a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date from public.applications a join public.dayworks d on d.id = a.daywork_id where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.dayworks set status = 'in_progress' where id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'active';
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and status in ('applied', 'viewed', 'shortlisted') and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid and daywork_id in (select d2.id from public.dayworks d2 join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid where d2.start_date <= d1.end_date and d2.end_date >= d1.start_date);
      update public.applications set status = 'rejected', updated_at = now() where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted') and crew_person_id != (split_part(p_aggregate_id, ':', 1))::uuid;

    when 'DAYWORK.REJECTED' then
      update public.applications set status = 'rejected', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'APPLICATION.WITHDRAWN' then
      update public.applications set status = 'withdrawn', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.SUPERSEDED' then
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_CREW' then
      update public.applications set status = 'cancelled_by_crew', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'crew', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' then
      update public.applications set status = 'cancelled_by_employer', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'employer', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text', relist_requested = coalesce((p_payload->>'relist_requested')::boolean, false), relist_reason_category = p_payload->>'relist_reason_category', relist_reason_text = p_payload->>'relist_reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

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
      insert into public.engagement_ratings (engagement_id, rater_person_id, rater_role, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, communication_accuracy, overall_match) values (p_aggregate_id::uuid, p_person_id, 'crew', p_payload->>'pay_accuracy', p_payload->>'meals_accuracy', p_payload->>'role_accuracy', p_payload->>'working_days_accuracy', (p_payload->>'vessel_condition')::int, (p_payload->>'would_work_on_vessel_again')::boolean, (p_payload->>'communication_accuracy')::boolean, (p_payload->>'overall_match')::int);

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
