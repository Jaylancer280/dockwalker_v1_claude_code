-- =============================================================================
-- Rollback 00042: Subscriptions
-- =============================================================================
drop policy if exists "Owner can read own subscription" on public.subscriptions;
drop table if exists public.subscriptions;
