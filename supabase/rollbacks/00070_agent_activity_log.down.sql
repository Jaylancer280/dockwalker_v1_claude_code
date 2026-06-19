-- Rollback: drop agent_activity_log table and policies
drop policy if exists "admin_select_all" on public.agent_activity_log;
drop policy if exists "agent_insert_own" on public.agent_activity_log;
drop table if exists public.agent_activity_log;
