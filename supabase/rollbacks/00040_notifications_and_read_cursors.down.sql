-- =============================================================================
-- Rollback 00040: Notifications and Message Read Cursors
-- =============================================================================

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop index if exists idx_notifications_unread;
drop table if exists public.notifications;

drop policy if exists "Users can read own cursors" on public.message_read_cursors;
drop policy if exists "Users can upsert own cursors" on public.message_read_cursors;
drop policy if exists "Users can update own cursors" on public.message_read_cursors;
drop table if exists public.message_read_cursors;
