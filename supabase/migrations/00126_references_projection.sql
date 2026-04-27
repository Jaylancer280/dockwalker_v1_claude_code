-- =============================================================================
-- Migration 00126: Consent-based references — apply_projection extensions
--
-- Replaces apply_projection with the latest 00123 body PLUS:
--   • PROFILE.CREATED  — extended INSERT to include referee_only column
--   • EXPERIENCE.UPDATED — edit-lock on snapshot fields when active references
--     exist (raises if vessel_id/role_id/start_date/end_date changed while
--     references on this experience are pending or accepted) [P0-A]
--   • EXPERIENCE.REMOVED — Fix A 3-step sequence: stamp references first
--     (revoke_reason='experience_removed'), close pending contacts, then
--     DELETE the experience. The FK on references.experience_id auto-nulls
--     AFTER the audit row is stamped, preserving snapshots.
--   • PERSON.DATA_SCRUBBED — soft-revoke references on requester/referee
--     deletion (with revoke_reason via CASE), close pending contacts on
--     employer deletion.
--   • 11 new REFERENCE.* handlers appended below SHORE_EXPERIENCE.REMOVED.
--
-- Handler count goes 71 → 82 (11 new). Body is otherwise an exact
-- line-for-line copy of 00123 to preserve every prior fix.
-- Lessons-mandated apply_projection replacement protocol: $$ count = 2,
-- ends with `end case; end; $$;`.
-- =============================================================================

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
  -- References module local variables (00126)
  v_subscription_plan text;
  v_active_ref_count int;
  v_pending_count int;
  v_accepted_count int;
  v_existing_vessel uuid;
  v_existing_role uuid;
  v_existing_start date;
  v_existing_end date;
  v_existing_is_current boolean;
  v_referee_id uuid;
  v_employer_id uuid;
  v_reference_id uuid;
  v_reference_status text;
  v_vessel_nda boolean;
  v_vessel_source text;
  v_vessel_hidden timestamptz;
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
      delete from public.shore_experiences where person_id = p_person_id;
      delete from public.crew_experiences where person_id = p_person_id;
      update public.user_notes
      set content = '[content scrubbed]', updated_at = now()
      where person_id = p_person_id;
      update public.profiles
      set display_name = 'Deleted User',
          primary_role_id = null,
          certification_ids = '{}',
          experience_bracket_id = null,
          vessel_size_exposure_ids = '{}',
          bio = null,
          agency_name = null,
          role_specialization_ids = '{}',
          location_port_id = null,
          location_city_id = null,
          shore_experience = null,
          motivation = null,
          languages = '{}',
          available_to_start = null,
          avatar_url = null,
          nationality_id = null,
          entry_right_ids = '{}',
          desired_role_id = null,
          deck_name = null,
          permanent_availability = null,
          notice_period_days = null,
          currently_employed = false,
          smoker = null,
          visible_tattoos = null,
          updated_at = now()
      where person_id = p_person_id;
      update public.persons set current_hat = null where id = p_person_id;
      delete from public.advisor_conversations where person_id = p_person_id;
      update public.docky_interactions
      set person_id = null,
          query = '[scrubbed]',
          response_summary = '[scrubbed]'
      where person_id = p_person_id;
      -- 00126 extension: soft-revoke references where the deleted person
      -- was requester or referee; close pending contacts on employer deletion.
      update public.references
        set status = 'revoked',
            revoked_at = now(),
            revoke_reason = case
              when requester_person_id = p_person_id then 'requester_deactivated'
              when referee_person_id  = p_person_id then 'referee_deactivated'
            end
        where (requester_person_id = p_person_id or referee_person_id = p_person_id)
          and status in ('pending', 'accepted');
      update public.reference_contacts
        set status = 'declined', responded_at = now()
        where employer_person_id = p_person_id and status = 'pending';

    when 'PROFILE.CREATED' then
      insert into public.profiles (
        person_id, display_name, identity_type,
        primary_role_id, certification_ids, experience_bracket_id,
        vessel_size_exposure_ids, bio, agency_name, role_specialization_ids, location_port_id,
        shore_experience, motivation, languages, available_to_start, onboarding_version,
        avatar_url, nationality_id, nationality_ids, entry_right_ids,
        desired_role_id, deck_name, location_city_id,
        permanent_availability, notice_period_days, currently_employed,
        smoker, visible_tattoos, referee_only
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
        coalesce(
          ((p_payload->'nationality_ids'->>0))::uuid,
          (p_payload->>'nationality_id')::uuid
        ),
        coalesce(
          (select array_agg(v::uuid) from jsonb_array_elements_text(p_payload->'nationality_ids') v),
          case
            when (p_payload->>'nationality_id') is not null
              then array[(p_payload->>'nationality_id')::uuid]
            else '{}'::uuid[]
          end
        ),
        coalesce(
          (
            select array_agg(v::uuid)
            from jsonb_array_elements_text(
              coalesce(p_payload->'entry_right_ids', p_payload->'visa_ids')
            ) v
            where v::uuid in (select id from public.entry_rights)
          ),
          '{}'
        ),
        (p_payload->>'desired_role_id')::uuid,
        p_payload->>'deck_name',
        (p_payload->>'location_city_id')::uuid,
        p_payload->>'permanent_availability',
        (p_payload->>'notice_period_days')::int,
        coalesce((p_payload->>'currently_employed')::boolean, false),
        (p_payload->>'smoker')::boolean,
        (p_payload->>'visible_tattoos')::boolean,
        coalesce((p_payload->>'referee_only')::boolean, false)
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
        nationality_ids = case
          when p_payload ? 'nationality_ids' then (
            select coalesce(array_agg(v::uuid), '{}'::uuid[])
            from jsonb_array_elements_text(p_payload->'nationality_ids') v
          )
          when (p_payload->>'nationality_id') is not null
            then array[(p_payload->>'nationality_id')::uuid]
          else nationality_ids
        end,
        nationality_id = coalesce(
          ((p_payload->'nationality_ids'->>0))::uuid,
          (p_payload->>'nationality_id')::uuid,
          nationality_id
        ),
        entry_right_ids = case
          when p_payload ? 'entry_right_ids' or p_payload ? 'visa_ids' then (
            select coalesce(array_agg(v::uuid), '{}')
            from jsonb_array_elements_text(
              coalesce(p_payload->'entry_right_ids', p_payload->'visa_ids')
            ) v
            where v::uuid in (select id from public.entry_rights)
          )
          else entry_right_ids
        end,
        desired_role_id = coalesce((p_payload->>'desired_role_id')::uuid, desired_role_id),
        deck_name = coalesce(p_payload->>'deck_name', deck_name),
        location_city_id = coalesce((p_payload->>'location_city_id')::uuid, location_city_id),
        permanent_availability = coalesce(p_payload->>'permanent_availability', permanent_availability),
        notice_period_days = coalesce((p_payload->>'notice_period_days')::int, notice_period_days),
        currently_employed = coalesce((p_payload->>'currently_employed')::boolean, currently_employed),
        smoker = case when p_payload ? 'smoker' then (p_payload->>'smoker')::boolean else smoker end,
        visible_tattoos = case when p_payload ? 'visible_tattoos' then (p_payload->>'visible_tattoos')::boolean else visible_tattoos end,
        referee_only = case when p_payload ? 'referee_only' then (p_payload->>'referee_only')::boolean else referee_only end,
        updated_at = now()
      where person_id = p_person_id;

    when 'VESSEL.CREATED' then
      insert into public.vessels (id, owner_person_id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag, source, submitted_by)
      values ((p_payload->>'id')::uuid, p_person_id, p_payload->>'imo_number', p_payload->>'name', coalesce(p_payload->>'vessel_type', 'motor'), (p_payload->>'size_band_id')::uuid, (p_payload->>'loa_meters')::numeric, coalesce((p_payload->>'nda_flag')::boolean, false), coalesce(p_payload->>'source', 'curated'), p_person_id);
      insert into public.vessel_names (vessel_id, name, effective_from, source, submitted_by)
      values ((p_payload->>'id')::uuid, p_payload->>'name', current_date, coalesce(p_payload->>'source', 'curated'), p_person_id);

    when 'VESSEL.UPDATED' then
      update public.vessels set name = coalesce(p_payload->>'name', name), vessel_type = coalesce(p_payload->>'vessel_type', vessel_type), size_band_id = coalesce((p_payload->>'size_band_id')::uuid, size_band_id), loa_meters = coalesce((p_payload->>'loa_meters')::numeric, loa_meters), nda_flag = coalesce((p_payload->>'nda_flag')::boolean, nda_flag), updated_at = now() where id = p_aggregate_id::uuid and owner_person_id = p_person_id;

    when 'VESSEL.RENAMED' then
      update public.vessel_names
      set effective_to = greatest(
        effective_from,
        (coalesce((p_payload->>'effective_from')::date, current_date) - interval '1 day')::date
      )
      where vessel_id = p_aggregate_id::uuid and effective_to is null;
      insert into public.vessel_names (vessel_id, name, effective_from, effective_to, source, submitted_by)
      values (
        p_aggregate_id::uuid,
        p_payload->>'name',
        coalesce((p_payload->>'effective_from')::date, current_date),
        case when p_payload ? 'effective_to' then (p_payload->>'effective_to')::date else null end,
        coalesce(p_payload->>'source', 'curated'),
        p_person_id
      );
      if not (p_payload ? 'effective_to') or (p_payload->>'effective_to') is null then
        update public.vessels set name = p_payload->>'name', updated_at = now() where id = p_aggregate_id::uuid;
      end if;

    when 'VESSEL.REFLAGGED' then
      update public.vessel_flag_states
      set effective_to = greatest(
        effective_from,
        (coalesce((p_payload->>'effective_from')::date, current_date) - interval '1 day')::date
      )
      where vessel_id = p_aggregate_id::uuid and effective_to is null;
      insert into public.vessel_flag_states (vessel_id, flag_state_id, effective_from, effective_to, source, submitted_by)
      values (
        p_aggregate_id::uuid,
        p_payload->>'flag_state_id',
        coalesce((p_payload->>'effective_from')::date, current_date),
        case when p_payload ? 'effective_to' then (p_payload->>'effective_to')::date else null end,
        coalesce(p_payload->>'source', 'curated'),
        p_person_id
      );
      if not (p_payload ? 'effective_to') or (p_payload->>'effective_to') is null then
        update public.vessels set flag_state_id = p_payload->>'flag_state_id', updated_at = now() where id = p_aggregate_id::uuid;
      end if;

    when 'VESSEL.METADATA_UPDATED' then
      update public.vessels set
        gross_tonnage = case when p_payload ? 'gross_tonnage' then (p_payload->>'gross_tonnage')::int else gross_tonnage end,
        beam_meters = case when p_payload ? 'beam_meters' then (p_payload->>'beam_meters')::numeric else beam_meters end,
        year_built = case when p_payload ? 'year_built' then (p_payload->>'year_built')::int else year_built end,
        builder = case when p_payload ? 'builder' then p_payload->>'builder' else builder end,
        updated_at = now()
      where id = p_aggregate_id::uuid;

    when 'EXPERIENCE.ADDED' then
      insert into public.crew_experiences (id, person_id, vessel_id, role_id, start_date, end_date, is_current, vessel_operation, flag_state, salary_amount, salary_currency, salary_period, contract_type, contract_details, description, sea_time_days, sea_time_nautical_miles) values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'vessel_id')::uuid, (p_payload->>'role_id')::uuid, (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, coalesce((p_payload->>'is_current')::boolean, false), p_payload->>'vessel_operation', p_payload->>'flag_state', (p_payload->>'salary_amount')::numeric, p_payload->>'salary_currency', p_payload->>'salary_period', p_payload->>'contract_type', p_payload->>'contract_details', p_payload->>'description', (p_payload->>'sea_time_days')::int, (p_payload->>'sea_time_nautical_miles')::int);
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.UPDATED' then
      -- 00126 extension: edit-lock on snapshot fields when active references
      -- exist on this experience (P0-A). Read existing row + count of live
      -- references first; raise if a snapshot field would change.
      select count(*) into v_active_ref_count
        from public.references
        where experience_id = p_aggregate_id::uuid
          and status in ('pending', 'accepted');
      if v_active_ref_count > 0 then
        select vessel_id, role_id, start_date, end_date
          into v_existing_vessel, v_existing_role, v_existing_start, v_existing_end
          from public.crew_experiences
          where id = p_aggregate_id::uuid and person_id = p_person_id;
        if (p_payload ? 'vessel_id' and (p_payload->>'vessel_id')::uuid is distinct from v_existing_vessel)
           or (p_payload ? 'role_id' and (p_payload->>'role_id')::uuid is distinct from v_existing_role)
           or (p_payload ? 'start_date' and (p_payload->>'start_date')::date is distinct from v_existing_start)
           or (p_payload ? 'end_date' and (p_payload->>'end_date')::date is distinct from v_existing_end)
        then
          raise exception 'EXPERIENCE.UPDATED: cannot change vessel/dates/role while % active reference(s) exist on this experience — revoke references first', v_active_ref_count;
        end if;
      end if;
      update public.crew_experiences set role_id = coalesce((p_payload->>'role_id')::uuid, role_id), start_date = coalesce((p_payload->>'start_date')::date, start_date), end_date = case when p_payload ? 'end_date' then (p_payload->>'end_date')::date else end_date end, is_current = coalesce((p_payload->>'is_current')::boolean, is_current), vessel_operation = coalesce(p_payload->>'vessel_operation', vessel_operation), flag_state = coalesce(p_payload->>'flag_state', flag_state), salary_amount = coalesce((p_payload->>'salary_amount')::numeric, salary_amount), salary_currency = coalesce(p_payload->>'salary_currency', salary_currency), salary_period = coalesce(p_payload->>'salary_period', salary_period), contract_type = coalesce(p_payload->>'contract_type', contract_type), contract_details = coalesce(p_payload->>'contract_details', contract_details), description = coalesce(p_payload->>'description', description), sea_time_days = coalesce((p_payload->>'sea_time_days')::int, sea_time_days), sea_time_nautical_miles = coalesce((p_payload->>'sea_time_nautical_miles')::int, sea_time_nautical_miles), updated_at = now() where id = p_aggregate_id::uuid and person_id = p_person_id;
      perform public.derive_experience_profile(p_person_id);

    when 'EXPERIENCE.REMOVED' then
      -- 00126 extension (Fix A): 3-step sequence inside this transaction.
      -- 1. Stamp references first so the audit row carries the correct
      --    revoke_reason BEFORE the FK auto-nulls experience_id.
      update public.references
        set status = 'revoked',
            revoked_at = now(),
            revoke_reason = 'experience_removed'
        where experience_id = p_aggregate_id::uuid
          and status in ('pending', 'accepted');
      -- 2. Close pending contact prompts so the referee doesn't see a
      --    dangling consent request after the underlying reference is gone.
      --    Accepted contacts (live chats) stay intact — they hold history.
      update public.reference_contacts
        set status = 'declined', responded_at = now()
        where reference_id in (
          select id from public.references where experience_id = p_aggregate_id::uuid
        )
        and status = 'pending';
      -- 3. Delete the experience (existing logic). The FK on
      --    references.experience_id (ON DELETE SET NULL) auto-nulls the
      --    column AFTER step 1 has stamped the rows; snapshot fields
      --    preserve the audit history.
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
      if v_available is null then
        raise exception 'DAYWORK.POSITIONS_UPDATED: daywork % no longer exists', p_payload->>'daywork_id';
      end if;
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
      if v_available is null then
        raise exception 'DAYWORK.ACCEPTED: daywork % no longer exists', split_part(p_aggregate_id, ':', 2);
      end if;
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
      if v_available is null then
        raise exception 'DAYWORK.INVITATION_ACCEPTED: daywork % no longer exists', p_payload->>'daywork_id';
      end if;
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

    -- ── SHORE EXPERIENCE EVENTS ───────────────────────────────────────────

    when 'SHORE_EXPERIENCE.ADDED' then
      insert into public.shore_experiences (id, person_id, category_id, employer_name, job_title, start_date, end_date, is_current, description)
      values ((p_payload->>'id')::uuid, p_person_id, (p_payload->>'category_id')::uuid, p_payload->>'employer_name', p_payload->>'job_title', (p_payload->>'start_date')::date, (p_payload->>'end_date')::date, coalesce((p_payload->>'is_current')::boolean, false), p_payload->>'description');

    when 'SHORE_EXPERIENCE.UPDATED' then
      update public.shore_experiences set
        category_id = coalesce((p_payload->>'category_id')::uuid, category_id),
        employer_name = coalesce(p_payload->>'employer_name', employer_name),
        job_title = coalesce(p_payload->>'job_title', job_title),
        start_date = coalesce((p_payload->>'start_date')::date, start_date),
        end_date = case when p_payload ? 'end_date' then (p_payload->>'end_date')::date else end_date end,
        is_current = coalesce((p_payload->>'is_current')::boolean, is_current),
        description = coalesce(p_payload->>'description', description),
        updated_at = now()
      where id = p_aggregate_id::uuid and person_id = p_person_id;

    when 'SHORE_EXPERIENCE.REMOVED' then
      delete from public.shore_experiences where id = p_aggregate_id::uuid and person_id = p_person_id;

    -- ── REFERENCE EVENTS (00126) ──────────────────────────────────────────

    when 'REFERENCE.REQUESTED' then
      -- Vessel-state gate (defence in depth alongside route layer)
      select v.nda_flag, v.source, v.hidden_at
        into v_vessel_nda, v_vessel_source, v_vessel_hidden
        from public.vessels v
        where v.id = (p_payload->>'vessel_id')::uuid;
      if v_vessel_nda is null then
        raise exception 'REFERENCE.REQUESTED: vessel % not found', p_payload->>'vessel_id';
      end if;
      if v_vessel_nda then
        raise exception 'REFERENCE.REQUESTED: references on NDA vessels are not supported';
      end if;
      if v_vessel_source is distinct from 'curated' then
        raise exception 'REFERENCE.REQUESTED: references require a curated vessel (source = %)', v_vessel_source;
      end if;
      if v_vessel_hidden is not null then
        raise exception 'REFERENCE.REQUESTED: vessel is hidden';
      end if;
      -- B-2: forbid references on currently-active experiences
      select is_current into v_existing_is_current
        from public.crew_experiences
        where id = (p_payload->>'experience_id')::uuid;
      if v_existing_is_current is null then
        raise exception 'REFERENCE.REQUESTED: experience % not found', p_payload->>'experience_id';
      end if;
      if v_existing_is_current then
        raise exception 'REFERENCE.REQUESTED: cannot add a reference to a currently-active experience — mark it complete first';
      end if;
      -- Per-experience cap: 1 (Free) / 3 (Crew Pro). Counts pending+accepted live rows.
      select coalesce(plan, 'free') into v_subscription_plan
        from public.subscriptions
        where person_id = p_person_id;
      v_subscription_plan := coalesce(v_subscription_plan, 'free');
      select count(*) into v_active_ref_count
        from public.references
        where experience_id = (p_payload->>'experience_id')::uuid
          and status in ('pending', 'accepted');
      if v_subscription_plan = 'crew_pro' then
        if v_active_ref_count >= 3 then
          raise exception 'REFERENCE.REQUESTED: per-experience cap of 3 reached for Crew Pro';
        end if;
      else
        if v_active_ref_count >= 1 then
          raise exception 'REFERENCE.REQUESTED: per-experience cap of 1 reached on Free plan — upgrade to Crew Pro for up to 3';
        end if;
      end if;
      insert into public.references (
        id, requester_person_id, experience_id, vessel_id,
        requester_role_at_time, claimed_referee_role,
        claimed_referee_name, claimed_referee_email,
        token, status,
        snapshot_vessel_imo, snapshot_vessel_name,
        snapshot_start_date, snapshot_end_date,
        expires_at, pending_expires_at
      ) values (
        (p_payload->>'id')::uuid,
        p_person_id,
        (p_payload->>'experience_id')::uuid,
        (p_payload->>'vessel_id')::uuid,
        p_payload->>'requester_role_at_time',
        p_payload->>'claimed_referee_role',
        p_payload->>'claimed_referee_name',
        p_payload->>'claimed_referee_email',
        p_payload->>'token',
        'pending',
        p_payload->>'snapshot_vessel_imo',
        p_payload->>'snapshot_vessel_name',
        (p_payload->>'snapshot_start_date')::date,
        case when p_payload ? 'snapshot_end_date' then (p_payload->>'snapshot_end_date')::date else null end,
        coalesce((p_payload->>'expires_at')::timestamptz, now() + interval '24 months'),
        coalesce((p_payload->>'pending_expires_at')::timestamptz, now() + interval '30 days')
      );

    when 'REFERENCE.ACCEPTED' then
      update public.references
        set status = 'accepted',
            referee_person_id = p_person_id,
            consented_at = now(),
            responded_at = now()
        where id = p_aggregate_id::uuid
          and status = 'pending'
          and pending_expires_at > now();

    when 'REFERENCE.COMMENT_UPDATED' then
      update public.references
        set comment = nullif(p_payload->>'comment', ''),
            comment_updated_at = now()
        where id = (p_payload->>'reference_id')::uuid
          and referee_person_id = p_person_id
          and status = 'accepted';

    when 'REFERENCE.DECLINED' then
      update public.references
        set status = 'declined', responded_at = now()
        where id = p_aggregate_id::uuid and status = 'pending';

    when 'REFERENCE.REVOKED_BY_REQUESTER' then
      update public.references
        set status = 'revoked',
            revoked_at = now(),
            revoke_reason = 'requester_revoked'
        where id = p_aggregate_id::uuid
          and requester_person_id = p_person_id
          and status in ('pending', 'accepted');

    when 'REFERENCE.REVOKED_BY_REFEREE' then
      update public.references
        set status = 'revoked',
            revoked_at = now(),
            revoke_reason = 'referee_revoked'
        where id = p_aggregate_id::uuid
          and referee_person_id = p_person_id
          and status = 'accepted';

    when 'REFERENCE.EXPIRED' then
      update public.references
        set status = 'expired',
            revoked_at = now(),
            revoke_reason = 'expired_accepted'
        where status = 'accepted' and expires_at < now();
      update public.references
        set status = 'expired',
            revoked_at = now(),
            revoke_reason = 'expired_pending'
        where status = 'pending' and pending_expires_at < now();

    when 'REFERENCE.CONTACT_REQUESTED' then
      -- Validate underlying reference is accepted
      select status into v_reference_status
        from public.references where id = (p_payload->>'reference_id')::uuid;
      if v_reference_status is distinct from 'accepted' then
        raise exception 'REFERENCE.CONTACT_REQUESTED: underlying reference is not accepted (status = %)', coalesce(v_reference_status, 'NOT_FOUND');
      end if;
      -- Two-tier employer cap (Free): pending<10 + accepted-30d<5
      select coalesce(plan, 'free') into v_subscription_plan
        from public.subscriptions where person_id = p_person_id;
      v_subscription_plan := coalesce(v_subscription_plan, 'free');
      if v_subscription_plan is distinct from 'employer_pro' then
        select count(*) into v_pending_count
          from public.reference_contacts
          where employer_person_id = p_person_id and status = 'pending';
        if v_pending_count >= 10 then
          raise exception 'REFERENCE.CONTACT_REQUESTED: pending contact budget exhausted (10) — upgrade to Employer Pro';
        end if;
        select count(*) into v_accepted_count
          from public.reference_contacts
          where employer_person_id = p_person_id
            and status = 'accepted'
            and created_at >= now() - interval '30 days';
        if v_accepted_count >= 5 then
          raise exception 'REFERENCE.CONTACT_REQUESTED: monthly accepted-contact budget exhausted (5/30 days) — upgrade to Employer Pro';
        end if;
      end if;
      insert into public.reference_contacts (id, reference_id, employer_person_id, question, status)
      values (
        (p_payload->>'id')::uuid,
        (p_payload->>'reference_id')::uuid,
        p_person_id,
        p_payload->>'question',
        'pending'
      );

    when 'REFERENCE.CONTACT_ACCEPTED' then
      -- Re-validate underlying reference is still accepted (referee may have revoked between request and accept)
      select rc.reference_id, rc.employer_person_id
        into v_reference_id, v_employer_id
        from public.reference_contacts rc
        where rc.id = p_aggregate_id::uuid and rc.status = 'pending';
      if v_reference_id is null then
        raise exception 'REFERENCE.CONTACT_ACCEPTED: contact % not pending', p_aggregate_id;
      end if;
      select status, referee_person_id into v_reference_status, v_referee_id
        from public.references where id = v_reference_id;
      if v_reference_status is distinct from 'accepted' then
        raise exception 'REFERENCE.CONTACT_ACCEPTED: underlying reference is not accepted (status = %)', coalesce(v_reference_status, 'NOT_FOUND');
      end if;
      update public.reference_contacts
        set status = 'accepted', responded_at = now()
        where id = p_aggregate_id::uuid;
      -- INSERT active_engagements for the new chat thread
      insert into public.active_engagements (id, crew_person_id, employer_person_id, reference_contact_id, status)
      values (
        (p_payload->>'engagement_id')::uuid,
        v_referee_id,
        v_employer_id,
        p_aggregate_id::uuid,
        'active'
      );
      -- Wire engagement_id back onto the reference_contact row
      update public.reference_contacts
        set engagement_id = (p_payload->>'engagement_id')::uuid
        where id = p_aggregate_id::uuid;

    when 'REFERENCE.CONTACT_DECLINED' then
      update public.reference_contacts
        set status = 'declined', responded_at = now()
        where id = p_aggregate_id::uuid and status = 'pending';

    when 'REFERENCE.CONTACT_THREAD_CLOSED' then
      -- B-8: hardcoded outcome (the W-K close modal doesn't capture one)
      update public.active_engagements
        set status = 'closed', outcome = 'reference_complete'
        where id = (p_payload->>'engagement_id')::uuid
          and reference_contact_id is not null
          and status = 'active';

    else
      raise notice 'Unknown event type: %', p_event_type;
  end case;

  if p_person_id is not null then
    update public.persons set last_event_at = now() where id = p_person_id;
  end if;
end;
$$;
