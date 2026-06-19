-- =============================================================================
-- Rollback 00140: revert admin_action_log.action CHECK to the 00133 set.
--
-- Defensive: any rows written with the new 'discard_incomplete_signup'
-- value would violate the narrower re-asserted CHECK and make the
-- rollback itself raise. Coerce them to 'delete_user' first — the
-- closest semantic neighbour (both are admin-initiated account removals;
-- 'delete_user' is the scrub-flow analogue). This is lossy on the exact
-- action label but preserves the audit row + admin/target linkage.
-- =============================================================================

update public.admin_action_log
  set action = 'delete_user'
  where action = 'discard_incomplete_signup';

alter table public.admin_action_log
  drop constraint if exists admin_action_log_action_check;

alter table public.admin_action_log
  add constraint admin_action_log_action_check check (action in (
    'block_user',
    'unblock_user',
    'delete_user',
    'restore_user',
    'cancel_engagement',
    'hide_posting',
    'resolve_report',
    'close_thread'
  ));
