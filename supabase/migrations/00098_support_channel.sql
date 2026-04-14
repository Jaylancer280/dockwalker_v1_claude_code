-- =============================================================================
-- Migration 00098: Support channel — threads + messages tables
--
-- New tables:
--   - support_threads (person_id, subject, status, is_admin_initiated)
--   - support_messages (thread_id, sender_person_id, is_platform, content)
--
-- Extends:
--   - events.aggregate_type CHECK with 'support'
--   - apply_projection with SUPPORT.THREAD_OPENED and SUPPORT.MESSAGE_SENT (audit no-ops)
--   - Supabase Realtime publication for support_messages
-- =============================================================================

-- 1. Support threads
create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  subject text,
  status text not null default 'open' check (status in ('open', 'closed')),
  is_admin_initiated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_support_threads_person on public.support_threads(person_id);
create index idx_support_threads_status on public.support_threads(status);

-- RLS: users can read/create own threads, admin via service client
alter table public.support_threads enable row level security;

create policy "Users can read own support threads"
  on public.support_threads for select
  to authenticated
  using (person_id = auth.uid());

create policy "Users can create own support threads"
  on public.support_threads for insert
  to authenticated
  with check (person_id = auth.uid());

-- 2. Support messages
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_person_id uuid references public.persons(id) on delete set null,
  is_platform boolean not null default false,
  content text not null check (char_length(content) <= 4000),
  created_at timestamptz not null default now()
);

create index idx_support_messages_thread on public.support_messages(thread_id);

-- RLS: thread participants can read, no insert for authenticated (API uses service client)
alter table public.support_messages enable row level security;

create policy "Thread participants can read support messages"
  on public.support_messages for select
  to authenticated
  using (
    thread_id in (
      select id from public.support_threads where person_id = auth.uid()
    )
  );

-- 3. Realtime
alter publication supabase_realtime add table public.support_messages;

-- 4. Extend aggregate_type CHECK
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message',
    'engagement', 'checklist', 'invitation', 'experience', 'admin', 'permanent', 'support'));

-- 5. Update apply_projection with support audit handlers (65 total: 63 from 00097 + 2 new)
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
  v_daywork_id uuid;
  v_posting_id uuid;
  v_shortlist_count int;
  v_app_status text;
begin
  case p_event_type

    when 'PERSON.CREATED' then
      insert into public.persons (id, identity_type, current_hat)
      values (p_person_id, p_payload->>'identity_type', p_payload->>'current_hat')
      on conflict (id) do nothing;

    when 'PERSON.HAT_CHANGED' then
      update public.persons set current_hat = p_payload->>'current_hat' where id = p_person_id;

    when 'PERSON.DEACTIVATED' then
      update public.persons set deactivated_at = now() where id = p_person_id;

    when 'PERSON.REACTIVATED' then
      update public.persons set deactivated_at = null where id = p_person_id;

    when 'PERSON.DATA_SCRUBBED' then
      update public.engagement_documents
      set deleted_at = now(), expires_at = now()
      where uploader_person_id = p_person_id and deleted_at is null;
      delete from public.notification_channels where person_id = p_person_id;
      delete from public.agent_placement_cities where person_id = p_person_id;
      update public.profiles
      set display_name = 'Deleted User',
          bio = null,
          agency_name = null,
          deck_name = null,
          updated_at = now()
      where person_id = p_person_id;
      delete from public.advisor_conversations where person_id = p_person_id;
      update public.docky_interactions
      set person_id = null,
          query = '[scrubbed]',
          response_summary = '[scrubbed]'
      where person_id = p_person_id;

    when 'PROFILE.CREATED' then
      insert into public.profiles (
        person_id, display_name, identity_type,
        primary_role_id, certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio, agency_name, role_specialization_ids, location_port_id,
        shore_experience, motivation, languages, available_to_start, onboarding_version,
        avatar_url, nationality_id, visa_ids,
        desired_role_id, deck_name, location_city_id,
        permanent_availability, notice_period_days, currently_employed,
        smoker, visible_tattoos
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
        p_payload->>'avatar_url',
        (p_payload->>'nationality_id')::uuid,
        coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'visa_ids') x), '{}'),
        (p_payload->>'desired_role_id')::uuid,
        p_payload->>'deck_name',
        (p_payload->>'location_city_id')::uuid,
        p_payload->>'permanent_availability',
        (p_payload->>'notice_period_days')::int,
        coalesce((p_payload->>'currently_employed')::boolean, false),
        (p_payload->>'smoker')::boolean,
        (p_payload->>'visible_tattoos')::boolean
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
        nationality_id = coalesce((p_payload->>'nationality_id')::uuid, nationality_id),
        visa_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'visa_ids') x), visa_ids),
        desired_role_id = coalesce((p_payload->>'desired_role_id')::uuid, desired_role_id),
        deck_name = coalesce(p_payload->>'deck_name', deck_name),
        location_city_id = coalesce((p_payload->>'location_city_id')::uuid, location_city_id),
        permanent_availability = coalesce(p_payload->>'permanent_availability', permanent_availability),
        notice_period_days = coalesce((p_payload->>'notice_period_days')::int, notice_period_days),
        currently_employed = coalesce((p_payload->>'currently_employed')::boolean, currently_employed),
        smoker = case when p_payload ? 'smoker' then (p_payload->>'smoker')::boolean else smoker end,
        visible_tattoos = case when p_payload ? 'visible_tattoos' then (p_payload->>'visible_tattoos')::boolean else visible_tattoos end,
        updated_at = now()
      where person_id = p_person_id;

    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag)
      values ((p_payload->>'id')::uuid, p_person_id, p_payload->>'imo_number', p_payload->>'name', coalesce(p_payload->>'vessel_type', 'motor'), (p_payload->>'size_band_id')::uuid, (p_payload->>'loa_meters')::numeric, coalesce((p_payload->>'nda_flag')::boolean, false));

    when 'VESSEL.UPDATED' then
      update public.vessels set name = coalesce(p_payload->>'name', name), vessel_type = coalesce(p_payload->>'vessel_type', vessel_type), size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id), loa_meters = coalesce((p_payload->>'loa_meters')::numeric, loa_meters), nda_flag = coalesce((p_payload->>'nda_flag')::boolean, nda_flag), updated_at = now() where id = p_aggregate_id::uuid and owner_person_id = p_person_id;

    when 'EXPERIENCE.ADDED' then
      insert into public.crew_experiences (id, person_id, vessel_id, role_id, start_date, end_date, is_current, vessel_operation, flag_state, salary_amount, salary_currency, salary_period, contract_type, contract_details, description, sea_time_days, sea_time_nautical_miles) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, coalesce((p_payload->>'is_current')::boolean, false), p_payload->>'vessel_operation', p_payload->>'flag_state', (p_payload->>'salary_amount')::numeric, p_payload->>'salary_currency', p_payload->>'salary_period', p_payload->>'contract_type', p_payload->>'contract_details', p_payload->>'description', (p_payload->>'sea_time_days')::int, (p_payload->>'sea_time_nautical_miles')::int);
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.UPDATED' then
      update public.crew_experiences set role_id = coalesce((p_payload->>'role_id')::uuid, role_id), start_date = coalesce((p_payload->>'start_date')::date, start_date), end_date = case when p_payload ? 'end_date' then (p_payload->>'end_date')::date else end_date end, is_current = coalesce((p_payload->>'is_current')::boolean, is_current), vessel_operation = coalesce(p_payload->>'vessel_operation', vessel_operation), flag_state = coalesce(p_payload->>'flag_state', flag_state), salary_amount = coalesce((p_payload->>'salary_amount')::numeric, salary_amount), salary_currency = coalesce(p_payload->>'salary_currency', salary_currency), salary_period = coalesce(p_payload->>'salary_period', salary_period), contract_type = coalesce(p_payload->>'contract_type', contract_type), contract_details = coalesce(p_payload->>'contract_details', contract_details), description = coalesce(p_payload->>'description', description), sea_time_days = coalesce((p_payload->>'sea_time_days')::int, sea_time_days), sea_time_nautical_miles = coalesce((p_payload->>'sea_time_nautical_miles')::int, sea_time_nautical_miles), updated_at = now() where id = p_aggregate_id::uuid and person_id = p_person_id;
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.REMOVED' then
      delete from public.crew_experiences where id = p_aggregate_id::uuid and person_id = p_person_id;
      perform public.derive_experience_profile(p_person_id);

    when 'DAYWORK.POSTED' then
      insert into public.dayworks (id, poster_person_id, role_context, vessel_id, role_id, location_port_id, start_date, end_date, working_days, required_certification_ids, experience_bracket_id, day_rate, currency, meals, notes, positions_available, permanent_opportunity, required_languages) values ((p_payload->>'id')::uuid, p_person_id, p_role_context, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'location_port_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, (p_payload->>'working_days')::int, coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'), (p_payload->>'experience_bracket_id')::uuid, (p_payload->>'day_rate')::numeric, coalesce(p_payload->>'currency', 'EUR'), coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'), p_payload->>'notes', coalesce((p_payload->>'positions_available')::int, 1), coalesce((p_payload->>'permanent_opportunity')::boolean, false), coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'required_languages') x), '{}'));

    when 'DAYWORK.CANCELLED_BY_EMPLOYER' then
      update public.dayworks set status = 'cancelled' where id = p_aggregate_id::uuid and poster_person_id = p_person_id;
      update public.daywork_invitations set status = 'revoked' where daywork_id = p_aggregate_id::uuid and status = 'pending';
      update public.active_engagements set status = 'cancelled', cancelled_by = 'employer' where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'cancelled_by_employer', updated_at = now() where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.COMPLETED' then
      update public.dayworks set status = 'completed' where id = p_aggregate_id::uuid;
      update public.active_engagements set status = 'completed' where daywork_id = p_aggregate_id::uuid and status = 'active';
      update public.applications set status = 'completed', updated_at = now() where daywork_id = p_aggregate_id::uuid and status = 'accepted';

    when 'DAYWORK.RELISTED' then
      update public.dayworks set status = 'active', start_date = coalesce((p_payload->>'start_date')::date, start_date), end_date = coalesce((p_payload->>'end_date')::date, end_date), working_days = coalesce((p_payload->>'working_days')::int, working_days) where id = (p_payload->>'daywork_id')::uuid;
      update public.daywork_invitations set status = 'revoked' where daywork_id = (p_payload->>'daywork_id')::uuid and status = 'pending';

    when 'DAYWORK.EXTENDED' then
      update public.dayworks set end_date = coalesce((p_payload->>'end_date')::date, end_date), working_days = coalesce((p_payload->>'working_days')::int, working_days), working_day_dates = case when p_payload ? 'working_day_dates' then (select array_agg(d::date) from jsonb_array_elements_text(p_payload->'working_day_dates') d) else working_day_dates end where id = (p_payload->>'daywork_id')::uuid;

    when 'DAYWORK.POSITIONS_UPDATED' then
      update public.dayworks set positions_available = (p_payload->>'positions_available')::int where id = (p_payload->>'daywork_id')::uuid returning positions_filled, positions_available into v_filled, v_available;
      if v_filled >= v_available then
        update public.dayworks set status = 'in_progress' where id = (p_payload->>'daywork_id')::uuid and status = 'active';
        update public.applications set status = 'rejected', updated_at = now() where daywork_id = (p_payload->>'daywork_id')::uuid and status in ('applied', 'viewed', 'shortlisted');
        update public.daywork_invitations set status = 'revoked' where daywork_id = (p_payload->>'daywork_id')::uuid and status = 'pending';
      end if;

    when 'DAYWORK.APPLIED' then
      insert into public.applications (id, crew_person_id, daywork_id, status, message, source) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'daywork_id')::uuid, case when (p_payload->>'source') = 'invitation' then 'shortlisted' else 'applied' end, p_payload->>'message', p_payload->>'source');
      update public.daywork_invitations set status = 'accepted' where daywork_id = (p_payload->>'daywork_id')::uuid and crew_person_id = p_person_id and status = 'pending';

    when 'DAYWORK.VIEWED' then
      update public.applications set status = 'viewed', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'applied';

    when 'DAYWORK.SHORTLISTED' then
      update public.applications set status = 'shortlisted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed');

    when 'DAYWORK.ACCEPTED' then
      select positions_filled, positions_available into v_filled, v_available from public.dayworks where id = (split_part(p_aggregate_id, ':', 2))::uuid;
      if v_filled >= v_available then raise notice 'positions already full for daywork %, skipping accept', split_part(p_aggregate_id, ':', 2); return; end if;
      update public.applications set status = 'accepted', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');
      insert into public.active_engagements (application_id, crew_person_id, employer_person_id, daywork_id, start_date, end_date) select a.id, a.crew_person_id, d.poster_person_id, d.id, d.start_date, d.end_date from public.applications a join public.dayworks d on d.id = a.daywork_id where a.crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and a.daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.dayworks set positions_filled = positions_filled + 1 where id = (split_part(p_aggregate_id, ':', 2))::uuid returning positions_filled, positions_available into v_filled, v_available;
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and status in ('applied', 'viewed', 'shortlisted') and daywork_id != (split_part(p_aggregate_id, ':', 2))::uuid and daywork_id in (select d2.id from public.dayworks d2 join public.dayworks d1 on d1.id = (split_part(p_aggregate_id, ':', 2))::uuid where d2.start_date <= d1.end_date and d2.end_date >= d1.start_date);
      if v_filled >= v_available then
        update public.dayworks set status = 'in_progress' where id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'active';
        update public.applications set status = 'rejected', updated_at = now() where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted') and crew_person_id != (split_part(p_aggregate_id, ':', 1))::uuid;
        update public.daywork_invitations set status = 'revoked' where daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status = 'pending';
      end if;

    when 'DAYWORK.REJECTED' then
      update public.applications set status = 'rejected', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.WITHDRAWN' then
      update public.applications set status = 'withdrawn', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid and status in ('applied', 'viewed', 'shortlisted');

    when 'APPLICATION.SUPERSEDED' then
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'DAYWORK.INVITED' then
      insert into public.daywork_invitations (daywork_id, crew_person_id, employer_person_id, status) values ((p_payload->>'daywork_id')::uuid, (p_payload->>'crew_person_id')::uuid, p_person_id, 'pending');

    when 'DAYWORK.INVITATION_ACCEPTED' then
      update public.daywork_invitations set status = 'accepted' where id = (p_payload->>'invitation_id')::uuid and status = 'pending';
      select positions_filled, positions_available into v_filled, v_available from public.dayworks where id = (p_payload->>'daywork_id')::uuid;
      if v_filled >= v_available then raise notice 'positions already full for daywork %, skipping invitation accept', p_payload->>'daywork_id'; return; end if;
      insert into public.active_engagements (crew_person_id, employer_person_id, daywork_id, start_date, end_date) values ((p_payload->>'crew_person_id')::uuid, (p_payload->>'employer_person_id')::uuid, (p_payload->>'daywork_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date);
      update public.dayworks set positions_filled = positions_filled + 1 where id = (p_payload->>'daywork_id')::uuid returning positions_filled, positions_available into v_filled, v_available;
      update public.applications set status = 'superseded', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and status in ('applied', 'viewed', 'shortlisted') and daywork_id != (p_payload->>'daywork_id')::uuid and daywork_id in (select d2.id from public.dayworks d2 join public.dayworks d1 on d1.id = (p_payload->>'daywork_id')::uuid where d2.start_date <= d1.end_date and d2.end_date >= d1.start_date);
      if v_filled >= v_available then
        update public.dayworks set status = 'in_progress' where id = (p_payload->>'daywork_id')::uuid and status = 'active';
        update public.applications set status = 'rejected', updated_at = now() where daywork_id = (p_payload->>'daywork_id')::uuid and status in ('applied', 'viewed', 'shortlisted');
        update public.daywork_invitations set status = 'revoked' where daywork_id = (p_payload->>'daywork_id')::uuid and status = 'pending';
      end if;

    when 'DAYWORK.INVITATION_DECLINED' then
      update public.daywork_invitations set status = 'declined' where id = (p_payload->>'invitation_id')::uuid and status = 'pending';

    when 'ENGAGEMENT.CANCELLED_BY_CREW' then
      update public.applications set status = 'cancelled_by_crew', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'crew', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.dayworks set positions_filled = greatest(positions_filled - 1, 0) where id = (split_part(p_aggregate_id, ':', 2))::uuid;

    when 'ENGAGEMENT.CANCELLED_BY_EMPLOYER' then
      update public.applications set status = 'cancelled_by_employer', updated_at = now() where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.active_engagements set status = 'cancelled', cancelled_by = 'employer', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text', relist_requested = coalesce((p_payload->>'relist_requested')::boolean, false), relist_reason_category = p_payload->>'relist_reason_category', relist_reason_text = p_payload->>'relist_reason_text' where crew_person_id = (split_part(p_aggregate_id, ':', 1))::uuid and daywork_id = (split_part(p_aggregate_id, ':', 2))::uuid;
      update public.dayworks set positions_filled = greatest(positions_filled - 1, 0) where id = (split_part(p_aggregate_id, ':', 2))::uuid;

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
        insert into public.availability_windows (person_id, date, expires_at, city_id, port_id, not_available) values (p_person_id, current_date, (p_payload->>'expires_at')::timestamptz, (p_payload->>'city_id')::uuid, (p_payload->>'port_id')::uuid, true) on conflict (person_id, date) do update set expires_at = excluded.expires_at, city_id = excluded.city_id, port_id = excluded.port_id, not_available = true, created_at = now();
      else
        update public.availability_windows set expires_at = now() where person_id = p_person_id and expires_at > now();
        insert into public.availability_windows (person_id, date, expires_at, city_id, port_id, not_available) select p_person_id, d::date, d::date + interval '1 day', (p_payload->>'city_id')::uuid, (p_payload->>'port_id')::uuid, false from generate_series((p_payload->>'start_date')::date, (p_payload->>'end_date')::date, '1 day'::interval) d on conflict (person_id, date) do update set expires_at = excluded.expires_at, city_id = excluded.city_id, port_id = excluded.port_id, not_available = false, created_at = now();
      end if;

    when 'MESSAGE.SENT' then
      insert into public.messages (id, engagement_id, sender_person_id, content, is_system) values ((p_payload->>'id')::uuid, p_aggregate_id::uuid, p_person_id, p_payload->>'content', coalesce((p_payload->>'is_system')::boolean, false));

    -- ── PERMANENT EVENTS ──────────────────────────────────────────────────

    when 'PERMANENT.POSTED' then
      insert into public.permanent_postings (id, employer_person_id, vessel_id, role_id, port_id, start_date, salary_min, salary_max, salary_currency, salary_period, live_aboard, required_certification_ids, experience_bracket_id, shortlist_cap, notes, required_languages, contract_type, contract_details, description, meals, positions_available) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'port_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'salary_min')::numeric, (p_payload->>'salary_max')::numeric, p_payload->>'salary_currency', p_payload->>'salary_period', (p_payload->>'live_aboard')::boolean, coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_payload->'required_certification_ids') x), '{}'), (p_payload->>'experience_bracket_id')::uuid, coalesce((p_payload->>'shortlist_cap')::int, 5), p_payload->>'notes', coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'required_languages') x), '{}'), p_payload->>'contract_type', p_payload->>'contract_details', p_payload->>'description', coalesce((select array_agg(x::text) from jsonb_array_elements_text(p_payload->'meals') x), '{}'), coalesce((p_payload->>'positions_available')::int, 1));

    when 'PERMANENT.APPLIED' then
      insert into public.applications (id, crew_person_id, permanent_posting_id, status, message) values ((p_payload->>'id')::uuid, (p_payload->>'crew_person_id')::uuid, (p_payload->>'permanent_posting_id')::uuid, 'applied', p_payload->>'message');

    when 'PERMANENT.APPLICATION_BLOCKED' then
      raise notice 'PERMANENT.APPLICATION_BLOCKED for crew % posting %', p_payload->>'crew_person_id', p_payload->>'permanent_posting_id';

    when 'PERMANENT.SHORTLISTED' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      select count(*) into v_shortlist_count from public.applications where permanent_posting_id = v_posting_id and status in ('shortlisted', 'selected');
      select shortlist_cap into v_available from public.permanent_postings where id = v_posting_id;
      if v_shortlist_count >= v_available then raise notice 'Shortlist cap reached for permanent posting %, skipping', v_posting_id; return; end if;
      update public.applications set status = 'shortlisted', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and permanent_posting_id = v_posting_id and status in ('applied', 'viewed');

    when 'PERMANENT.REJECTED' then
      update public.applications set status = 'rejected', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and permanent_posting_id = (p_payload->>'permanent_posting_id')::uuid and status in ('applied', 'shortlisted');

    when 'PERMANENT.SELECTED' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      perform 1 from public.permanent_postings where id = v_posting_id and status = 'active';
      if not found then raise notice 'Permanent posting % not active, skipping select', v_posting_id; return; end if;
      perform 1 from public.applications where permanent_posting_id = v_posting_id and status = 'selected';
      if found then raise notice 'Permanent posting % already has selected applicant, skipping', v_posting_id; return; end if;
      update public.applications set status = 'selected', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and permanent_posting_id = v_posting_id and status in ('applied', 'shortlisted');
      insert into public.active_engagements (id, application_id, crew_person_id, employer_person_id, permanent_posting_id, start_date, end_date, status) select (p_payload->>'engagement_id')::uuid, a.id, a.crew_person_id, pp.employer_person_id, pp.id, pp.start_date, pp.start_date, 'active' from public.applications a join public.permanent_postings pp on pp.id = a.permanent_posting_id where a.crew_person_id = (p_payload->>'crew_person_id')::uuid and a.permanent_posting_id = v_posting_id;
      update public.permanent_postings set status = 'in_negotiation', updated_at = now() where id = v_posting_id;

    when 'PERMANENT.PLACEMENT_CONFIRMED' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      perform 1 from public.permanent_postings where id = v_posting_id and status = 'in_negotiation';
      if not found then raise notice 'Permanent posting % not in_negotiation, skipping placement confirm', v_posting_id; return; end if;
      update public.permanent_postings set status = 'filled', updated_at = now() where id = v_posting_id;
      update public.applications set status = 'placement_confirmed', updated_at = now() where permanent_posting_id = v_posting_id and status = 'selected';
      update public.applications set status = 'not_selected', rejection_reason = 'Position has been filled', updated_at = now() where permanent_posting_id = v_posting_id and status in ('applied', 'shortlisted');

    when 'PERMANENT.SELECTION_REVERTED' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      perform 1 from public.permanent_postings where id = v_posting_id and status = 'in_negotiation';
      if not found then raise notice 'Permanent posting % not in_negotiation, skipping selection revert', v_posting_id; return; end if;
      update public.active_engagements set status = 'closed', outcome = 'not_successful' where id = (p_payload->>'engagement_id')::uuid;
      update public.applications set status = 'not_selected', updated_at = now() where permanent_posting_id = v_posting_id and status = 'selected';
      update public.permanent_postings set status = 'active', updated_at = now() where id = v_posting_id;

    when 'PERMANENT.WITHDRAWN' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      select status into v_app_status from public.applications where crew_person_id = (p_payload->>'crew_person_id')::uuid and permanent_posting_id = v_posting_id and status in ('applied', 'shortlisted', 'selected');
      if v_app_status is null then raise notice 'No withdrawable application found for crew % posting %', p_payload->>'crew_person_id', v_posting_id; return; end if;
      update public.applications set status = 'withdrawn', updated_at = now() where crew_person_id = (p_payload->>'crew_person_id')::uuid and permanent_posting_id = v_posting_id and status = v_app_status;
      if v_app_status = 'selected' then
        update public.active_engagements set status = 'closed', outcome = 'withdrew' where permanent_posting_id = v_posting_id and status = 'active';
        update public.permanent_postings set status = 'active', updated_at = now() where id = v_posting_id and status = 'in_negotiation';
      end if;

    when 'PERMANENT.CANCELLED_BY_EMPLOYER' then
      v_posting_id := (p_payload->>'permanent_posting_id')::uuid;
      perform 1 from public.permanent_postings where id = v_posting_id and status = 'in_negotiation';
      if found then
        update public.active_engagements set status = 'closed', outcome = 'not_successful' where permanent_posting_id = v_posting_id and status = 'active';
        update public.applications set status = 'not_selected', updated_at = now() where permanent_posting_id = v_posting_id and status = 'selected';
      end if;
      update public.permanent_postings set status = 'cancelled', updated_at = now() where id = v_posting_id;
      update public.applications set status = 'rejected', updated_at = now() where permanent_posting_id = v_posting_id and status in ('applied', 'shortlisted');

    when 'PERMANENT.ENGAGEMENT_CLOSED' then
      update public.active_engagements set status = 'closed', outcome = p_payload->>'outcome' where id = (p_payload->>'engagement_id')::uuid and status = 'active';
      if (p_payload->>'outcome') = 'withdrew' and (p_payload->>'closed_by') = 'crew' then
        select permanent_posting_id into v_posting_id from public.active_engagements where id = (p_payload->>'engagement_id')::uuid;
        if v_posting_id is not null then update public.permanent_postings set status = 'active', updated_at = now() where id = v_posting_id and status = 'in_negotiation'; end if;
      end if;

    -- ── ADMIN EVENTS ──────────────────────────────────────────────────────

    when 'ADMIN.USER_BLOCKED' then
      update public.persons set blocked_at = now() where id = (p_payload->>'person_id')::uuid;

    when 'ADMIN.USER_UNBLOCKED' then
      update public.persons set blocked_at = null where id = (p_payload->>'person_id')::uuid;

    when 'ADMIN.ENGAGEMENT_CANCELLED' then
      update public.active_engagements set status = 'cancelled', cancelled_by = 'admin', cancellation_reason_category = p_payload->>'reason_category', cancellation_reason_text = p_payload->>'reason_text' where id = (p_payload->>'engagement_id')::uuid and status = 'active';
      if (p_payload->>'posting_type') = 'daywork' then
        update public.applications set status = 'cancelled_by_employer', updated_at = now() where daywork_id = (p_payload->>'daywork_id')::uuid and status in ('accepted');
        update public.dayworks set status = 'cancelled' where id = (p_payload->>'daywork_id')::uuid and status in ('active', 'in_progress');
      end if;
      if (p_payload->>'posting_type') = 'permanent' then
        update public.active_engagements set status = 'closed', outcome = 'not_successful' where id = (p_payload->>'engagement_id')::uuid;
        update public.applications set status = 'cancelled_by_employer', updated_at = now() where permanent_posting_id = (p_payload->>'permanent_posting_id')::uuid and status in ('selected');
        update public.permanent_postings set status = 'cancelled' where id = (p_payload->>'permanent_posting_id')::uuid and status in ('active', 'in_negotiation');
      end if;
      insert into public.messages (engagement_id, sender_person_id, content, is_system) values ((p_payload->>'engagement_id')::uuid, (p_payload->>'admin_person_id')::uuid, 'This engagement has been cancelled by DockWalker.', true);

    when 'ADMIN.POSTING_HIDDEN' then
      if (p_payload->>'posting_type') = 'daywork' then
        update public.dayworks set status = 'cancelled' where id = (p_payload->>'posting_id')::uuid and status in ('active', 'in_progress');
      else
        update public.permanent_postings set status = 'cancelled' where id = (p_payload->>'posting_id')::uuid and status in ('active', 'in_negotiation');
      end if;

    when 'ADMIN.ENGAGEMENT_COMPLETED' then
      v_daywork_id := (p_payload->>'daywork_id')::uuid;
      update public.dayworks set status = 'completed' where id = v_daywork_id;
      update public.active_engagements set status = 'completed' where daywork_id = v_daywork_id and status = 'active';
      update public.applications set status = 'completed', updated_at = now() where daywork_id = v_daywork_id and status = 'accepted';

    when 'ADMIN.CANONICAL_ADDED' then
      raise notice 'ADMIN.CANONICAL_ADDED processed for table % record %', p_payload->>'table', p_payload->>'record_id';

    when 'ADMIN.CANONICAL_UPDATED' then
      raise notice 'ADMIN.CANONICAL_UPDATED processed for table % record %', p_payload->>'table', p_payload->>'record_id';

    -- ── SUPPORT EVENTS (audit no-ops) ─────────────────────────────────────

    when 'SUPPORT.THREAD_OPENED' then
      raise notice 'SUPPORT.THREAD_OPENED for person % thread %', p_payload->>'person_id', p_payload->>'thread_id';

    when 'SUPPORT.MESSAGE_SENT' then
      raise notice 'SUPPORT.MESSAGE_SENT for thread % sender %', p_payload->>'thread_id', p_payload->>'sender_person_id';

    else
      raise notice 'Unknown event type: %', p_event_type;
  end case;

  if p_person_id is not null then
    update public.persons set last_event_at = now() where id = p_person_id;
  end if;
end;
$$;
