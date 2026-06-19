-- Fix agent_activity_log RLS policies:
-- 1. INSERT: restrict to agents only (not any authenticated user)
-- 2. SELECT: use is_admin boolean (identity_type='admin' doesn't exist)

drop policy "agent_insert_own" on public.agent_activity_log;
drop policy "admin_select_all" on public.agent_activity_log;

create policy "agent_insert_own" on public.agent_activity_log
  for insert with check (
    person_id = auth.uid()
    and exists (
      select 1 from public.persons p
      where p.id = auth.uid() and p.identity_type = 'agent'
    )
  );

create policy "admin_select_all" on public.agent_activity_log
  for select using (
    exists (
      select 1 from public.persons p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
