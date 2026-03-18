-- =============================================================================
-- Rollback 00044: Advisor Conversations + Messages
-- =============================================================================
drop policy if exists "Owner can read/write own messages" on public.advisor_messages;
drop policy if exists "Owner can CRUD own conversations" on public.advisor_conversations;
drop index if exists public.advisor_messages_conversation_created;
drop index if exists public.advisor_conversations_person_updated;
drop table if exists public.advisor_messages;
drop table if exists public.advisor_conversations;
