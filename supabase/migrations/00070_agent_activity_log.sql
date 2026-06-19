-- Agent activity log — pure append-only telemetry, not event-sourced
create table public.agent_activity_log (
  id uuid default gen_random_uuid() primary key,
  person_id uuid not null references public.persons(id),
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_agent_activity_person_created on public.agent_activity_log (person_id, created_at);

-- RLS: agent can INSERT own rows, admin can SELECT all
alter table public.agent_activity_log enable row level security;

create policy "agent_insert_own" on public.agent_activity_log
  for insert with check (person_id = auth.uid());

create policy "admin_select_all" on public.agent_activity_log
  for select using (
    exists (
      select 1 from public.persons p
      where p.id = auth.uid() and p.identity_type = 'admin'
    )
  );
