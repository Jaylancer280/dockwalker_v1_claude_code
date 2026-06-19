-- Rollback for 00137_engagement_outcome_b011.sql
--
-- Re-narrows the CHECK back to the 00125-era allowlist
-- (`successful_placement`, `not_successful`, `withdrew`,
-- `reference_complete`).
--
-- Any rows that 00136's cascade wrote with the new outcomes
-- (`role_filled`, `rejected`, `posting_cancelled`) get coerced to
-- `not_successful` first so the CHECK re-add doesn't raise. This is
-- lossy on the audit dimension — the system messages inserted alongside
-- the close still tell the story — but it's the only way to restore the
-- old constraint without orphaning historical rows.

update public.active_engagements
  set outcome = 'not_successful'
  where outcome in ('role_filled', 'rejected', 'posting_cancelled');

alter table public.active_engagements drop constraint active_engagements_outcome_check;

alter table public.active_engagements add constraint active_engagements_outcome_check
  check (outcome is null or outcome in (
    'successful_placement', 'not_successful', 'withdrew', 'reference_complete'
  ));
