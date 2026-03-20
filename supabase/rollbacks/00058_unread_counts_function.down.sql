-- Rollback migration 00058: Remove get_unread_counts function
drop function if exists public.get_unread_counts(uuid);
