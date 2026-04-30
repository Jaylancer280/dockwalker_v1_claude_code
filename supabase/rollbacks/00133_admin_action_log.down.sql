-- Rollback for 00133_admin_action_log.sql
--
-- Drops the admin_action_log table (CASCADE removes the 3 indexes and
-- the RLS policy attachment). FK targets (persons) are not affected.

drop table if exists public.admin_action_log cascade;
