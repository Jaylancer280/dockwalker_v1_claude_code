-- =============================================================================
-- Migration 00052: Enable Realtime on messages table
-- =============================================================================

alter publication supabase_realtime add table public.messages;
