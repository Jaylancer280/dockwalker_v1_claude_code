-- =============================================================================
-- Migration 00045: Add role_context to notifications
--
-- Notifications are hat-scoped so badge counts can be split by current hat.
-- Backfill existing rows based on notification type.
-- =============================================================================

-- 1. Add column (nullable for backfill, then set NOT NULL)
alter table public.notifications
  add column role_context text;

-- 2. Backfill existing rows based on type
-- Employer-context notifications: things that happen TO an employer
update public.notifications set role_context = 'employer'
where type in ('application_received', 'work_started', 'work_started_confirmed', 'checklist_updated');

-- Crew-context notifications: things that happen TO crew
update public.notifications set role_context = 'crew'
where type in ('application_accepted', 'application_rejected', 'application_shortlisted',
               'invitation_received', 'new_job_posted', 'job_completed',
               'postponement_proposed');

-- Shared context: both parties get these, context depends on recipient
-- message_received and engagement_cancelled go to both sides
update public.notifications set role_context = 'crew'
where type in ('message_received', 'engagement_cancelled') and role_context is null;

-- Catch-all: anything still null defaults to crew
update public.notifications set role_context = 'crew' where role_context is null;

-- 3. Add NOT NULL + CHECK
alter table public.notifications
  alter column role_context set not null;

alter table public.notifications
  add constraint notifications_role_context_check
  check (role_context in ('crew', 'employer', 'agent'));

-- 4. Update index to include role_context for filtered count queries
drop index if exists public.idx_notifications_unread;
create index idx_notifications_unread
  on public.notifications (person_id, read, role_context, created_at desc);
