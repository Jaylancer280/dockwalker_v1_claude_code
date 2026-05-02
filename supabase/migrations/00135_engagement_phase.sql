-- =============================================================================
-- Migration 00135: Add `phase` column to `active_engagements` (B-011 schema prep)
--
-- Schema-only prep for the permanent shortlist-chat feature. Splits the
-- two concerns (schema vs apply_projection rewrite) into separate migrations
-- for reviewability — the projection updates land in 00136.
--
-- Today every row in `active_engagements` represents a candidate who has been
-- accepted (daywork) or selected (permanent). Under the new model, opt-in
-- shortlist conversations also live in this table, with a `phase` column
-- distinguishing the lifecycle stage:
--
--   'shortlist'  — employer-initiated shortlist chat (permanent only).
--                  Most engagement-state-machine actions are blocked here:
--                  no work-started, no postponement, no completion, no
--                  ratings, no checklist. Plus messaging works normally.
--   'active'     — selected/accepted candidate, the existing default. All
--                  state-machine actions available.
--   'completed'  — engagement reached a terminal completion state (existing
--                  semantics preserved).
--   'closed'     — auto-closed when a sibling shortlist conversation was
--                  selected, or when the posting was cancelled. Read-only
--                  history. Used in conjunction with `outcome` to record
--                  why the chat ended.
--
-- DEFAULT 'active' so all 19000+ existing rows preserve their current
-- meaning without a data rewrite — Postgres 11+ stores constant defaults
-- in the column metadata, no table scan. Reversible rollback drops the
-- column and the CHECK.
-- =============================================================================

alter table public.active_engagements
  add column phase text not null default 'active';

alter table public.active_engagements
  add constraint active_engagements_phase_check
    check (phase in ('shortlist', 'active', 'completed', 'closed'));

-- Partial index on shortlist-phase rows for the inbox-grouping query
-- (employer-side /messages list groups by posting_id, filters out
-- closed/completed). Only ~hundreds of rows in steady state, but the
-- index keeps the conversation list snappy as the platform scales.
create index if not exists idx_active_engagements_phase_shortlist
  on public.active_engagements (employer_person_id, phase)
  where phase = 'shortlist';
