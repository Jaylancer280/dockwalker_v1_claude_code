-- Admin-only function to fully delete a person and all their data.
-- Use this to clean up test users or complete GDPR erasure after DATA_SCRUBBED.
-- Deletes child rows in correct FK dependency order, then the persons row.
-- The auth.users row is NOT deleted here (Supabase dashboard handles that after
-- the FK-blocking persons row is gone).
--
-- Must be called with service_role or as a superuser.

create or replace function public.admin_delete_person(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deepest children first, working up the FK tree

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

  -- Profile and person (profile FK → persons)
  delete from public.profiles where person_id = target_id;
  delete from public.persons where id = target_id;

  -- Events are append-only but for full test cleanup, remove them too
  delete from public.events where person_id = target_id;
end;
$$;

-- Only service_role can execute this (no RLS bypass needed — security definer handles it)
revoke execute on function public.admin_delete_person(uuid) from public;
revoke execute on function public.admin_delete_person(uuid) from authenticated;
