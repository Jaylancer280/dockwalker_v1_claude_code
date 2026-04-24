-- Widen notification_channels to accept Telegram alongside WhatsApp
alter table public.notification_channels
  drop constraint notification_channels_channel_type_check;

alter table public.notification_channels
  add constraint notification_channels_channel_type_check
  check (channel_type in ('whatsapp', 'telegram'));

-- Add telegram_enabled to user_preferences
alter table public.user_preferences
  add column telegram_enabled boolean not null default false;

-- One-time tokens that link a DockWalker account to a Telegram chat_id.
-- Flow: app mints a token -> user taps t.me/dockwalker_bot?start=<token>
-- -> webhook consumes token, writes notification_channels row with chat_id.
create table public.telegram_link_tokens (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.persons(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index telegram_link_tokens_token_idx on public.telegram_link_tokens(token);
create index telegram_link_tokens_person_id_idx on public.telegram_link_tokens(person_id);

alter table public.telegram_link_tokens enable row level security;

-- Owner can read their own pending tokens (to show status in UI).
create policy "Owner can read own link tokens"
  on public.telegram_link_tokens for select
  using (person_id = auth.uid());

-- Inserts + updates + deletes go through service role only (API route / webhook).
-- No client-side write policies = RLS blocks direct access.
