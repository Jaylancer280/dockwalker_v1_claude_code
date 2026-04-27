-- =============================================================================
-- Migration 00125: Consent-based references — schema foundation
--
-- Adds the `references` and `reference_contacts` tables, broadens
-- `active_engagements` to accommodate reference-contact engagements (no
-- daywork, no permanent posting, no application — just two parties + a
-- chat thread), and extends `events.aggregate_type` with two new values.
--
-- Pre-flight verification (per tasks/todo.md):
--   • active_engagements XOR constraint name = engagements_posting_xor
--     (currently: (daywork_id is not null) != (permanent_posting_id is not null)).
--     Replaced here with a 3-way one-of including reference_contact_id.
--   • application_id / start_date / end_date are NOT NULL on active_engagements;
--     dropped here so reference-contact rows can be inserted without those.
--   • active_engagements.outcome CHECK extended with 'reference_complete'
--     (B-8 — CONTACT_THREAD_CLOSED stamps this fixed value).
--   • profiles gains referee_only column for lightweight referee signups.
--
-- Reversed by 00125_references_schema.down.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. references table — one row per (experience, claimed_referee) pair
-- ---------------------------------------------------------------------------
create table public.references (
  id uuid primary key default gen_random_uuid(),
  requester_person_id uuid not null references public.persons(id),
  -- B-2 forbids creation against is_current=true experiences at the route
  -- layer. ON DELETE SET NULL lets EXPERIENCE.REMOVED's projection handler
  -- stamp revoke_reason='experience_removed' BEFORE the FK auto-nulls, so
  -- snapshot fields preserve the audit row (Fix A).
  experience_id uuid references public.crew_experiences(id) on delete set null,
  vessel_id uuid references public.vessels(id) on delete set null,
  requester_role_at_time text not null,
  claimed_referee_role text not null,
  claimed_referee_name text not null,
  claimed_referee_email text,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  referee_person_id uuid references public.persons(id),
  comment text check (comment is null or length(comment) <= 500),
  comment_updated_at timestamptz,
  created_at timestamptz not null default now(),
  consented_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 months'),
  pending_expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason in (
    'requester_revoked', 'referee_revoked', 'experience_removed',
    'requester_deactivated', 'referee_deactivated',
    'expired_pending', 'expired_accepted'
  )),
  -- Snapshot of the experience at request time. These survive even after
  -- experience_id / vessel_id get nulled so the audit row stays readable.
  snapshot_vessel_imo text not null,
  snapshot_vessel_name text not null,
  snapshot_start_date date not null,
  snapshot_end_date date
);

-- B-1 partial unique: one LIVE referee slot per experience. Excluding
-- revoked/expired/declined audit rows lets the same referee be re-invited
-- after a revoke without unique-violating at REFERENCE.ACCEPTED time.
create unique index references_unique_live_referee_per_experience
  on public.references (experience_id, referee_person_id)
  where referee_person_id is not null
    and experience_id is not null
    and status in ('pending', 'accepted');

create index idx_references_requester
  on public.references (requester_person_id, status);

create index idx_references_referee
  on public.references (referee_person_id, status);

create index idx_references_experience_active
  on public.references (experience_id, status)
  where experience_id is not null;

create index idx_references_pending_expiry
  on public.references (pending_expires_at)
  where status = 'pending';

create index idx_references_accepted_expiry
  on public.references (expires_at)
  where status = 'accepted';

alter table public.references enable row level security;

-- RLS: own outbound + inbound. Cross-party read by employers happens on the
-- service-role API path (filtered by Phase 5 visibility logic), not RLS.
create policy "Requester reads own references"
  on public.references for select
  to authenticated
  using (requester_person_id = auth.uid() or referee_person_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. reference_contacts table — employer asks referee for a chat
-- ---------------------------------------------------------------------------
create table public.reference_contacts (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.references(id) on delete cascade,
  employer_person_id uuid not null references public.persons(id),
  engagement_id uuid,
  question text check (question is null or length(question) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index idx_reference_contacts_employer
  on public.reference_contacts (employer_person_id, created_at desc);

create index idx_reference_contacts_reference
  on public.reference_contacts (reference_id, status);

alter table public.reference_contacts enable row level security;

create policy "Parties read own reference contacts"
  on public.reference_contacts for select
  to authenticated
  using (
    employer_person_id = auth.uid()
    or reference_id in (
      select id from public.references
      where referee_person_id = auth.uid() or requester_person_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. active_engagements broadening (B-4)
-- ---------------------------------------------------------------------------
-- Drop NOT NULL on columns that don't apply to reference-contact engagements.
alter table public.active_engagements alter column application_id drop not null;
alter table public.active_engagements alter column start_date drop not null;
alter table public.active_engagements alter column end_date drop not null;

-- Add reference_contact_id linking a chat thread back to the contact row.
alter table public.active_engagements
  add column reference_contact_id uuid
  references public.reference_contacts(id) on delete set null;

-- Replace the 2-way XOR with a 3-way one-of (exactly one slot must be set).
alter table public.active_engagements drop constraint engagements_posting_xor;
alter table public.active_engagements add constraint engagements_posting_xor
  check (
    (case when daywork_id is not null then 1 else 0 end)
    + (case when permanent_posting_id is not null then 1 else 0 end)
    + (case when reference_contact_id is not null then 1 else 0 end)
    = 1
  );

-- B-8: extend outcome enum with 'reference_complete' (CONTACT_THREAD_CLOSED stamps this).
-- The original 00059 added the CHECK as an inline column constraint without a
-- named constraint clause, so the constraint name is auto-generated. We
-- look it up from pg_constraint to drop reliably across environments.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
    from pg_constraint
    where conrelid = 'public.active_engagements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%successful_placement%';
  if v_constraint_name is not null then
    execute format('alter table public.active_engagements drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.active_engagements add constraint active_engagements_outcome_check
  check (outcome is null or outcome in (
    'successful_placement', 'not_successful', 'withdrew', 'reference_complete'
  ));

create index idx_engagements_reference_contact
  on public.active_engagements (reference_contact_id)
  where reference_contact_id is not null;

-- Now wire the reverse FK (engagement_id on the contact row) to active_engagements.
-- (Column was created without an FK above so the table existed before active_engagements
-- was extended; this ALTER adds the FK now.)
alter table public.reference_contacts
  add constraint reference_contacts_engagement_fk
  foreign key (engagement_id) references public.active_engagements(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. profiles.referee_only flag for lightweight referee signups (P1-C)
-- ---------------------------------------------------------------------------
alter table public.profiles add column referee_only boolean not null default false;

create index idx_profiles_referee_only
  on public.profiles (referee_only)
  where referee_only = true;

-- ---------------------------------------------------------------------------
-- 5. events.aggregate_type_check — extend allow-list
-- ---------------------------------------------------------------------------
alter table public.events drop constraint events_aggregate_type_check;
alter table public.events add constraint events_aggregate_type_check
  check (aggregate_type in (
    'person', 'vessel', 'daywork', 'application', 'message',
    'engagement', 'checklist', 'invitation', 'experience',
    'admin', 'permanent', 'support', 'shore_experience',
    'reference', 'reference_contact'
  ));
