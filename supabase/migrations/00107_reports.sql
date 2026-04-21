-- =============================================================================
-- Migration 00107: User reporting system
--
-- Creates the `reports` table — CRUD moderation workflow data (NOT event
-- sourced). The ACTIONS taken on a report (block user, hide posting) are
-- already event-sourced via Phase 1 routes; reports just track resolution.
--
-- RLS:
--   - authenticated INSERT where reporter_person_id = auth.uid()
--   - authenticated SELECT where reporter_person_id = auth.uid()
--   - admin reads/updates via service client (bypasses RLS)
--
-- Extends admin_delete_person to clean up reports for the target as reporter,
-- reported, and admin (null-out admin_person_id).
-- =============================================================================

-- 1. Table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_person_id uuid not null references public.persons(id),
  reported_person_id uuid not null references public.persons(id),
  engagement_id uuid references public.active_engagements(id),
  reason_category text not null check (reason_category in (
    'harassment', 'fraud', 'inappropriate_content',
    'safety_concern', 'spam', 'impersonation', 'duplicate_account', 'other'
  )),
  reason_text text not null check (char_length(reason_text) <= 1000),
  status text not null default 'open' check (status in (
    'open', 'reviewing', 'dismissed', 'actioned'
  )),
  admin_person_id uuid references public.persons(id) on delete set null,
  admin_notes text,
  resolution text check (resolution in ('dismissed', 'warned', 'actioned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_no_self_report check (reporter_person_id != reported_person_id)
);

create index idx_reports_status_category on public.reports(status, reason_category);
create index idx_reports_reported on public.reports(reported_person_id);

-- 2. RLS
alter table public.reports enable row level security;

create policy "Authenticated users can submit reports"
  on public.reports for insert
  to authenticated
  with check (reporter_person_id = auth.uid());

create policy "Authenticated users can read own reports"
  on public.reports for select
  to authenticated
  using (reporter_person_id = auth.uid());

-- 3. Extend admin_delete_person to include reports
create or replace function public.admin_delete_person(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Engagement children
  delete from public.message_read_cursors where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );
  delete from public.engagement_ratings where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );
  delete from public.engagement_checklists where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );
  delete from public.engagement_documents where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );
  delete from public.messages where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );

  -- Reports referencing engagements owned by this person (must delete before
  -- active_engagements because of the FK). Then remove the target's own report
  -- rows. admin_person_id on surviving rows is set null rather than deleted.
  delete from public.reports where engagement_id in (
    select id from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id
  );

  -- Engagements themselves
  delete from public.active_engagements
    where crew_person_id = target_id or employer_person_id = target_id;

  -- Applications
  delete from public.applications
    where crew_person_id = target_id;

  -- Daywork invitations
  delete from public.daywork_invitations
    where crew_person_id = target_id or employer_person_id = target_id;

  -- Postings (daywork + permanent)
  delete from public.dayworks where poster_person_id = target_id;
  delete from public.permanent_postings where employer_person_id = target_id;
  delete from public.permanent_templates where employer_person_id = target_id;

  -- Vessels owned by this person
  delete from public.vessels where owner_person_id = target_id;

  -- User data tables
  delete from public.crew_experiences where person_id = target_id;
  delete from public.shore_experiences where person_id = target_id;
  delete from public.daywork_templates where person_id = target_id;
  delete from public.device_tokens where person_id = target_id;
  delete from public.notifications where person_id = target_id;
  delete from public.notification_read_cursors where person_id = target_id;
  delete from public.user_preferences where person_id = target_id;
  delete from public.subscriptions where person_id = target_id;
  delete from public.advisor_conversations where person_id = target_id;
  delete from public.advisor_usage where person_id = target_id;
  delete from public.docky_interactions where person_id = target_id;
  delete from public.agent_activity_log where person_id = target_id;
  delete from public.agent_placement_cities where person_id = target_id;
  delete from public.whatsapp_notification_channels where person_id = target_id;
  delete from public.availability where person_id = target_id;
  delete from public.support_messages where sender_person_id = target_id;
  delete from public.support_threads where person_id = target_id;
  delete from public.notification_channels where person_id = target_id;

  -- User notes (subject + author)
  delete from public.user_notes where person_id = target_id;
  update public.user_notes set admin_person_id = null where admin_person_id = target_id;

  -- Reports: delete where target is reporter or reported; null out admin
  -- attribution on remaining rows.
  delete from public.reports
    where reporter_person_id = target_id
       or reported_person_id = target_id;
  update public.reports set admin_person_id = null where admin_person_id = target_id;

  -- Profile and person (profile FK → persons)
  delete from public.profiles where person_id = target_id;
  delete from public.persons where id = target_id;

  -- Events are append-only but for full test cleanup, remove them too
  delete from public.events where person_id = target_id;
end;
$$;
