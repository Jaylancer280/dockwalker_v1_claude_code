-- Restore original (buggy) RLS policies from 00070
drop policy if exists "agent_insert_own" on public.agent_activity_log;
drop policy if exists "admin_select_all" on public.agent_activity_log;

create policy "agent_insert_own" on public.agent_activity_log
  for insert with check (person_id = auth.uid());

create policy "admin_select_all" on public.agent_activity_log
  for select using (
    exists (
      select 1 from public.persons p
      where p.id = auth.uid() and p.identity_type = 'admin'
    )
  );
