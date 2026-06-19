-- =============================================================================
-- Migration 00040: Notifications and Message Read Cursors
--
-- 1. Create message_read_cursors table
-- 2. Create notifications table with index
-- 3. RLS policies for both tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Message read cursors — tracks last read position per user per engagement
-- ---------------------------------------------------------------------------
create table public.message_read_cursors (
  person_id uuid not null references public.persons(id),
  engagement_id uuid not null references public.active_engagements(id),
  last_read_at timestamptz not null default now(),
  primary key (person_id, engagement_id)
);

alter table public.message_read_cursors enable row level security;

create policy "Users can read own cursors"
  on public.message_read_cursors for select
  to authenticated
  using (person_id = auth.uid());

create policy "Users can upsert own cursors"
  on public.message_read_cursors for insert
  to authenticated
  with check (person_id = auth.uid());

create policy "Users can update own cursors"
  on public.message_read_cursors for update
  to authenticated
  using (person_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Notifications table — in-app notification centre
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  type text not null,
  title text not null,
  body text not null,
  deep_link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index idx_notifications_unread
  on public.notifications (person_id, read, created_at desc);

create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (person_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (person_id = auth.uid());

-- Service role inserts notifications (fire-and-forget from push-triggers)
-- No insert policy for authenticated — only service role writes
