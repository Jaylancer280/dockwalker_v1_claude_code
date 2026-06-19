-- 00026: User preferences table (CRUD, not event-sourced)
-- Follows daywork_templates precedent: plain CRUD utility data, owner-scoped via RLS.

create table public.user_preferences (
  person_id uuid primary key references public.persons(id),
  profile_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: owner-only read/write
alter table public.user_preferences enable row level security;

create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = person_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = person_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = person_id)
  with check (auth.uid() = person_id);
