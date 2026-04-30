-- =============================================================================
-- Migration 00133: admin_action_log table (audit P1-S6)
--
-- Audit P1-S6 (2026-04-30): admin actions go through `appendEvent` with
-- `admin_person_id` in the payload (covered by ADMIN.* events on the
-- ledger), but there is no INDEXED admin-action surface for ops review.
-- Querying the events table by `payload->>'admin_person_id' is not null`
-- requires a full scan with JSON extraction — too slow for the live
-- /admin/audit-log page that ops needs on day one.
--
-- This adds a dedicated CRUD utility table populated by the four admin
-- routes (`/api/admin/{engagements/[id]/cancel,postings/[id]/hide,
-- users/[id]/{block,unblock,delete,restore},reports/[id]}`) — each
-- inserts a row immediately after `appendEvent` succeeds. The table is
-- documented as a non-event-sourced exception (CRUD utility) per the
-- CLAUDE.md "Documented exceptions" pattern (matches `daywork_templates`
-- + `permanent_templates`).
--
-- Service-role only at the RLS layer — admin reads happen via the
-- service client in `/admin/*` routes. No authenticated policies, so a
-- compromised admin user can't tamper with the log via direct DB access.
-- =============================================================================

create table public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  admin_person_id uuid not null references public.persons(id),
  action text not null check (action in (
    'block_user',
    'unblock_user',
    'delete_user',
    'restore_user',
    'cancel_engagement',
    'hide_posting',
    'resolve_report',
    'close_thread'
  )),
  target_person_id uuid references public.persons(id) on delete set null,
  target_id uuid,                          -- engagement_id, posting_id, report_id, thread_id
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes:
--   - by admin: "what has admin X done?"
--   - by target: "what's been done to user/posting/etc Y?"
--   - by action+time: "show me all blocks in the last 7 days"

create index idx_admin_action_log_admin
  on public.admin_action_log(admin_person_id, created_at desc);

create index idx_admin_action_log_target_person
  on public.admin_action_log(target_person_id, created_at desc)
  where target_person_id is not null;

create index idx_admin_action_log_action_time
  on public.admin_action_log(action, created_at desc);

-- Service-role only. No authenticated policies — admin reads via
-- `createServiceClient()` in `/admin/*` routes. RLS is enabled to
-- ensure no future authenticated policy is added accidentally.
alter table public.admin_action_log enable row level security;
