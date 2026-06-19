-- =============================================================================
-- Rollback 00052: Remove messages from Realtime publication
-- =============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
