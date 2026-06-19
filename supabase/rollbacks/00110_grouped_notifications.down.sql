-- =============================================================================
-- Rollback 00110: drop grouped_notifications() RPC
-- =============================================================================

drop function if exists public.grouped_notifications();
