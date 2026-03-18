-- =============================================================================
-- Rollback 00052: Remove messages from Realtime publication
-- =============================================================================

alter publication supabase_realtime drop table public.messages;
