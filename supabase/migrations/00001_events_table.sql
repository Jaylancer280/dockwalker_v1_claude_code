-- =============================================================================
-- Events table: append-only event log for event-sourced architecture
-- =============================================================================

create extension if not exists "uuid-ossp";

create table public.events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  aggregate_id text not null,
  aggregate_type text not null check (aggregate_type in ('person', 'vessel', 'daywork', 'application', 'message')),
  role_context text not null check (role_context in ('crew', 'employer', 'agent')),
  payload jsonb not null default '{}',
  person_id uuid not null,
  created_at timestamptz not null default now()
);

-- Append-only: no updates or deletes allowed
create or replace function prevent_event_mutation()
returns trigger as $$
begin
  raise exception 'Events table is append-only. Updates and deletes are not permitted.';
  return null;
end;
$$ language plpgsql;

create trigger events_no_update
  before update on public.events
  for each row execute function prevent_event_mutation();

create trigger events_no_delete
  before delete on public.events
  for each row execute function prevent_event_mutation();

-- Indexes for common query patterns
create index idx_events_aggregate on public.events (aggregate_type, aggregate_id);
create index idx_events_person on public.events (person_id);
create index idx_events_type on public.events (event_type);
create index idx_events_created on public.events (created_at);

-- RLS: users can only read their own events or events on aggregates they participate in
alter table public.events enable row level security;

create policy "Users can insert events as themselves"
  on public.events for insert
  with check (person_id = auth.uid());

create policy "Users can read events they created"
  on public.events for select
  using (person_id = auth.uid());
