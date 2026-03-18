-- =============================================================================
-- Migration 00046: Advisor Usage Tracking
-- =============================================================================

create table public.advisor_usage (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  month text not null,
  question_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (person_id, month)
);

alter table public.advisor_usage enable row level security;

create policy "Owner can read own usage"
  on public.advisor_usage for select
  to authenticated
  using (person_id = auth.uid());
