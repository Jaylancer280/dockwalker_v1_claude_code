-- =============================================================================
-- Rollback for 00125: Consent-based references — schema foundation
--
-- Drops everything 00125 added in reverse order. Idempotent (uses IF EXISTS)
-- so re-applying after partial failure is safe. Restores the prior 2-way
-- XOR on active_engagements and the prior outcome CHECK.
-- =============================================================================

-- 1. Drop new event-aggregate values (restore prior allow-list).
alter table public.events drop constraint if exists events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in (
    'person', 'vessel', 'daywork', 'application', 'message',
    'engagement', 'checklist', 'invitation', 'experience',
    'admin', 'permanent', 'support', 'shore_experience'
  ));

-- 2. Drop profiles.referee_only (this also drops idx_profiles_referee_only via cascade).
drop index if exists public.idx_profiles_referee_only;
alter table public.profiles drop column if exists referee_only;

-- 3. Restore the prior active_engagements outcome CHECK (drop our extension, recreate).
alter table public.active_engagements
  drop constraint if exists active_engagements_outcome_check;
alter table public.active_engagements add constraint active_engagements_outcome_check
  check (outcome is null or outcome in (
    'successful_placement', 'not_successful', 'withdrew'
  ));

-- 4. Drop the broadened XOR + the reference_contact_id index. Then DELETE
--    any orphan reference-contact engagements (rows with no daywork_id and
--    no permanent_posting_id) BEFORE we re-add the strict 2-way XOR or
--    re-impose NOT NULL on application_id / start_date / end_date — those
--    rows would fail every constraint going forward.
drop index if exists public.idx_engagements_reference_contact;
alter table public.active_engagements drop constraint if exists engagements_posting_xor;

delete from public.active_engagements
  where daywork_id is null and permanent_posting_id is null;

-- Now safe to drop the reference_contact_id column.
alter table public.active_engagements drop column if exists reference_contact_id;

-- 5. Restore the original 2-way XOR on active_engagements.
alter table public.active_engagements add constraint engagements_posting_xor
  check ((daywork_id is not null) != (permanent_posting_id is not null));

-- 6. Restore NOT NULL on application_id / start_date / end_date. The DELETE
--    in step 4 removed every row that could violate these.
alter table public.active_engagements alter column application_id set not null;
alter table public.active_engagements alter column start_date set not null;
alter table public.active_engagements alter column end_date set not null;

-- 7. Drop the new tables (CASCADE drops indexes, FKs, RLS policies).
--    Order matters: reference_contacts has an FK to active_engagements
--    (engagement_id) added in 00125, but its DROP TABLE CASCADE handles it.
drop table if exists public.reference_contacts cascade;
drop table if exists public.references cascade;
