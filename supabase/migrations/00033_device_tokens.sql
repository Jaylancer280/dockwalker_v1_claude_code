-- =============================================================================
-- Migration 00033: Device tokens for push notifications
--
-- Stores push notification tokens (APNs/FCM/Web) per user.
-- CRUD utility data, not event-sourced — follows daywork_templates precedent.
-- =============================================================================

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  token text not null,
  platform text not null check (platform in ('apns', 'fcm', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, token)
);

create index idx_device_tokens_person_id on public.device_tokens(person_id);

-- RLS: users can only manage their own tokens
alter table public.device_tokens enable row level security;

create policy "Users can read own tokens"
  on public.device_tokens for select
  using (person_id = auth.uid());

create policy "Users can insert own tokens"
  on public.device_tokens for insert
  with check (person_id = auth.uid());

create policy "Users can update own tokens"
  on public.device_tokens for update
  using (person_id = auth.uid());

create policy "Users can delete own tokens"
  on public.device_tokens for delete
  using (person_id = auth.uid());
