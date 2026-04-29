-- Rollback for 00131: CV Builder v1 — schema + projection extensions.
--
-- This rollback fully reverses the schema changes from 00131. The
-- apply_projection function body is NOT auto-restored — to fully revert
-- the function (CV.GENERATED, CV.HANDLE_REGENERATED, PERMANENT.INVITED,
-- and the PERMANENT.APPLIED invited_from_id branch), re-apply
-- 00130_references_nda_referee_visibility.sql AFTER this rollback runs.
--
-- Order matters: applications.invited_from_id references
-- permanent_invitations(id), so we drop the FK column first, then drop
-- the table. Schema drops on profiles / crew_experiences / references
-- happen last because they have no inter-dependencies with the new table.

-- 1. applications.invited_from_id — drop the partial index then the column.
drop index if exists public.idx_applications_invited_from;
alter table public.applications drop column if exists invited_from_id;

-- 2. permanent_invitations — drop the entire table (indexes, RLS policy
--    and partial index drop with it).
drop table if exists public.permanent_invitations cascade;

-- 3. references.include_on_cv
alter table public.references drop column if exists include_on_cv;

-- 4. crew_experiences.cv_show_full_vessel
alter table public.crew_experiences drop column if exists cv_show_full_vessel;

-- 5. profiles — CV columns + partial index.
drop index if exists public.idx_profiles_cv_handle;
alter table public.profiles
  drop column if exists cv_handle,
  drop column if exists cv_handle_updated_at,
  drop column if exists cv_include_sea_time,
  drop column if exists cv_generated_at;

-- 6. events_aggregate_type_check — restore the 15-value allow-list (drop
--    'permanent_invitation' from the CHECK constraint added in 00131).
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in (
    'person', 'vessel', 'daywork', 'application', 'message',
    'engagement', 'checklist', 'invitation', 'experience',
    'admin', 'permanent', 'support', 'shore_experience',
    'reference', 'reference_contact'
  ));

-- 7. apply_projection — function body is unaffected by this rollback.
--    Re-apply 00130 manually if you need the prior body back.
do $$
begin
  raise notice
    'Rollback for 00131: schema reverted. To restore apply_projection to its 00130 form (drop CV.GENERATED, CV.HANDLE_REGENERATED, PERMANENT.INVITED handlers and revert PERMANENT.APPLIED extension), re-apply 00130_references_nda_referee_visibility.sql after this rollback.';
end $$;
