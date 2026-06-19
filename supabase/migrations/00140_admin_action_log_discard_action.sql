-- =============================================================================
-- Migration 00140: admin_action_log — allow 'discard_incomplete_signup' action
--
-- ADMIN-1 PR2 adds a "Discard incomplete signup" admin action: for auth
-- users who never completed onboarding (auth.users row exists, no
-- persons/profiles row), the only meaningful moderation action is to
-- delete the auth row outright via `auth.admin.deleteUser`. No cascade,
-- no event ledger writes (there's no aggregate to scrub). The action is
-- recorded in `admin_action_log` for ops audit, which requires extending
-- the `action` CHECK constraint (00133) with the new value.
--
-- Additive only — every previously-valid action stays valid. This must
-- land BEFORE the route that writes the new value; otherwise the
-- `admin_action_log` INSERT fails the CHECK. (`logAdminAction` is
-- best-effort and only Sentry-logs on failure, so a missing migration
-- degrades to "discard works but audit row lost", not a hard failure —
-- but the migration should still precede the code per the standing
-- CHECK-constraint ordering rule in tasks/lessons.md.)
--
-- Inline column CHECKs are auto-named `<table>_<column>_check` by
-- Postgres; `IF EXISTS` keeps this idempotent if the name ever drifts.
-- =============================================================================

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
    'close_thread',
    'discard_incomplete_signup'
  ));
