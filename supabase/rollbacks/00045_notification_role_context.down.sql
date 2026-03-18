-- =============================================================================
-- Rollback 00045: Remove role_context from notifications
-- =============================================================================
drop index if exists public.idx_notifications_unread;
alter table public.notifications drop constraint if exists notifications_role_context_check;
alter table public.notifications drop column if exists role_context;

-- Restore original index
create index idx_notifications_unread
  on public.notifications (person_id, read, created_at desc);
