-- =============================================================================
-- Rollback for 00135: drop the engagement-phase column + index
--
-- Self-contained per the project rule. Any shortlist-phase rows created
-- post-00135 will be lost when the column drops — that's the inherent cost
-- of reverting the feature (the engagements would be invalid post-rollback
-- anyway since their phase distinction is gone).
-- =============================================================================

drop index if exists public.idx_active_engagements_phase_shortlist;

alter table public.active_engagements
  drop constraint if exists active_engagements_phase_check;

alter table public.active_engagements
  drop column if exists phase;
