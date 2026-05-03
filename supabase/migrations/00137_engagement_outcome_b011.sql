-- 00137_engagement_outcome_b011.sql
--
-- Extends `active_engagements.outcome` CHECK to admit the three new
-- outcomes that migration 00136 (B-011 commit 2) writes from the new
-- shortlist-chat cascade handlers. Without this, any branch of
-- apply_projection that closes a phase='shortlist' engagement raises
-- `active_engagements_outcome_check` and the parent event (e.g.
-- `PERMANENT.CANCELLED_BY_EMPLOYER`, `PERMANENT.SELECTED`,
-- `PERMANENT.REJECTED`, `PERMANENT.WITHDRAWN`) fails to commit.
--
-- New outcomes:
--   role_filled         — sibling shortlist chats auto-closed because the
--                         employer selected another candidate.
--   rejected            — this candidate's shortlist chat closed because
--                         the employer explicitly rejected the application.
--   posting_cancelled   — this candidate's shortlist chat closed because
--                         the employer cancelled the underlying posting.
--
-- Existing outcomes (`successful_placement`, `not_successful`, `withdrew`,
-- `reference_complete`) preserved verbatim. Rollback narrows the CHECK
-- back; any rows that already carry one of the new outcomes are cleaned
-- to `not_successful` first so the rollback doesn't itself raise.

alter table public.active_engagements drop constraint active_engagements_outcome_check;

alter table public.active_engagements add constraint active_engagements_outcome_check
  check (outcome is null or outcome in (
    'successful_placement', 'not_successful', 'withdrew', 'reference_complete',
    'role_filled', 'rejected', 'posting_cancelled'
  ));
