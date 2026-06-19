-- =============================================================================
-- Migration 00044: Advisor Conversations + Messages
--
-- 1. advisor_conversations table
-- 2. advisor_messages table
-- 3. Indexes
-- 4. RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Advisor conversations
-- ---------------------------------------------------------------------------
create table public.advisor_conversations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Advisor messages
-- ---------------------------------------------------------------------------
create table public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  model_used text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
create index advisor_conversations_person_updated
  on public.advisor_conversations (person_id, updated_at desc);

create index advisor_messages_conversation_created
  on public.advisor_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.advisor_conversations enable row level security;
alter table public.advisor_messages enable row level security;

create policy "Owner can CRUD own conversations"
  on public.advisor_conversations for all
  to authenticated
  using (person_id = auth.uid())
  with check (person_id = auth.uid());

create policy "Owner can read/write own messages"
  on public.advisor_messages for all
  to authenticated
  using (
    conversation_id in (
      select id from public.advisor_conversations where person_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.advisor_conversations where person_id = auth.uid()
    )
  );
