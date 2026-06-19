-- WhatsApp notification channels: stores encrypted phone numbers for WhatsApp delivery
create table public.notification_channels (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.persons(id) on delete cascade,
  channel_type text not null check (channel_type = 'whatsapp'),
  channel_value_encrypted bytea not null,
  verified boolean not null default false,
  verification_code text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, channel_type)
);

-- RLS: owner can SELECT/INSERT/UPDATE own rows. Service role bypasses for dispatch.
alter table public.notification_channels enable row level security;

create policy "Owner can read own channels"
  on public.notification_channels for select
  using (person_id = auth.uid());

create policy "Owner can insert own channels"
  on public.notification_channels for insert
  with check (person_id = auth.uid());

create policy "Owner can update own channels"
  on public.notification_channels for update
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

create policy "Owner can delete own channels"
  on public.notification_channels for delete
  using (person_id = auth.uid());

-- Add whatsapp_enabled to user_preferences
alter table public.user_preferences
  add column whatsapp_enabled boolean not null default false;
