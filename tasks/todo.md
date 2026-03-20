# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 126b: Daywork Engagement Route Hardening

**Goal:** Add `daywork_id IS NOT NULL` guard to all 11 daywork-specific engagement routes. When permanent engagements are added (Stage 127+), these guards prevent permanent engagement IDs from silently triggering daywork events.

**Will touch:** 11 existing engagement route files (one-line addition each), their corresponding test files.

**Will NOT touch:** Database, migrations, types, frontend, any non-engagement routes.

**Done condition:** All 11 routes return 404 when called with an engagement ID that has `daywork_id = NULL`. All existing tests pass (716). No new migration needed.

**Context:** See `tasks/permanent-jobs-spec.md` → "Pre-Implementation: Daywork Hardening" section.

---

#### 1. Add `.not('daywork_id', 'is', null)` to engagement query

For each route below, add `.not('daywork_id', 'is', null)` to the `.from('active_engagements')` query chain, before `.single()`. This makes the query return `null` (and the route return 404) for engagements without a `daywork_id`.

**Pattern — before:**

```typescript
const { data: engagement } = await supabase
  .from('active_engagements')
  .select('id, crew_person_id, ...')
  .eq('id', engagementId)
  .single();
```

**Pattern — after:**

```typescript
const { data: engagement } = await supabase
  .from('active_engagements')
  .select('id, crew_person_id, ...')
  .eq('id', engagementId)
  .not('daywork_id', 'is', null)
  .single();
```

The existing `if (!engagement)` check already returns 404. No new error handling needed.

**Files to modify:**

- [x] `apps/web/src/app/api/engagements/[id]/cancel-employer/route.ts` — line 37-41
- [x] `apps/web/src/app/api/engagements/[id]/cancel-crew/route.ts` — line 28-32
- [x] `apps/web/src/app/api/engagements/[id]/respond-crew-cancel/route.ts` — line 19-23
- [x] `apps/web/src/app/api/engagements/[id]/propose-postponement/route.ts` — line 26-32
- [x] `apps/web/src/app/api/engagements/[id]/respond-postponement/route.ts` — line 21-27
- [x] `apps/web/src/app/api/engagements/[id]/relist-with-dates/route.ts` — line 19-25
- [x] `apps/web/src/app/api/engagements/[id]/work-started/route.ts` — line 24-28
- [x] `apps/web/src/app/api/engagements/[id]/confirm-completion/route.ts` — line 17-21
- [x] `apps/web/src/app/api/engagements/[id]/rate/route.ts` — line 20-24
- [x] `apps/web/src/app/api/engagements/[id]/checklist/route.ts` — line 21-25
- [x] `apps/web/src/app/api/engagements/[id]/checklist/toggle/route.ts` — line 20-24

---

#### 2. Verify existing tests still pass

The guard is transparent to existing tests because all test mocks return engagements with `daywork_id` set. The `.not()` filter is handled by the mock chain's `.single()` resolution — it doesn't add a new mock step since Supabase chains are fluent.

However, verify that no test mock uses a builder pattern that breaks on the additional `.not()` call. If any mock chain doesn't support `.not()`, add it to the chain builder (return `this` from `.not()`).

- [x] Run `npx vitest run` — all 716 tests pass
- [x] If any test mock breaks on `.not()`, update the mock chain builder to support `.not()` (return `this`)

---

#### 3. Documentation

- [x] Update `BUILD_STATE.md`: stage entry `[Stage 126b] Daywork engagement route hardening — daywork_id IS NOT NULL guard on 11 engagement routes, prevents permanent engagement IDs from triggering daywork events`
- [x] No migration, no schema change, no README updates needed

---

### Stage 127: Permanent Jobs — Schema + Types + Events

**Goal:** Lay the database foundation and type system for permanent jobs. Create tables, extend shared tables, add `PERMANENT.*` event handlers to `apply_projection`, and extend TypeScript types. No API routes, no UI, no app code.

**Will touch:** One new migration + rollback, `packages/types/src/events.ts`, `packages/types/src/models.ts`, `packages/types/src/enums.ts`, `packages/types/README.md`, `supabase/README.md`, `BUILD_STATE.md`.

**Will NOT touch:** Any `apps/web/src/` files. No API routes, no pages, no components, no tests (migration validated via `db reset` + integration tests).

**Done condition:** `npx supabase db reset` succeeds. Integration tests pass. `tsc --noEmit` clean. New tables exist with RLS. `apply_projection` handles all 12 `PERMANENT.*` events. Rollback fully reverses migration.

**Context:** See `tasks/permanent-jobs-spec.md` for full schema, event types, state machines, and RLS policies.

---

#### 1. Migration — `supabase/migrations/00059_permanent_jobs.sql`

##### 1a. Create `permanent_postings` table

- [ ] Create table with columns per spec schema:
  - `id uuid PK DEFAULT gen_random_uuid()`
  - `employer_person_id uuid NOT NULL FK → persons`
  - `vessel_id uuid NOT NULL FK → vessels`
  - `role_id integer NOT NULL FK → yacht_roles`
  - `port_id integer NOT NULL FK → ports`
  - `start_date date NOT NULL`
  - `salary_min numeric(10,2) NOT NULL`
  - `salary_max numeric(10,2) NOT NULL`
  - `salary_currency text NOT NULL CHECK (salary_currency IN ('EUR', 'USD', 'GBP', 'AED'))`
  - `salary_period text NOT NULL CHECK (salary_period IN ('monthly', 'annual'))`
  - `live_aboard boolean NOT NULL`
  - `required_certification_ids integer[] NOT NULL DEFAULT '{}'`
  - `experience_bracket_id integer FK → experience_brackets` (nullable)
  - `shortlist_cap integer NOT NULL DEFAULT 5`
  - `notes text` (nullable)
  - `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_negotiation', 'filled', 'cancelled'))`
  - `job_number serial UNIQUE`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- [ ] Add index on `employer_person_id`
- [ ] Add index on `status` (for discovery query)
- [ ] Add index on `port_id` (for location filter)

##### 1b. Create `permanent_templates` table

- [ ] Create table with same columns as `permanent_postings` minus `status`, `job_number`, `created_at`, `updated_at`
- [ ] Add `id uuid PK DEFAULT gen_random_uuid()`
- [ ] Add `employer_person_id uuid NOT NULL FK → persons`
- [ ] Add `template_name text NOT NULL`
- [ ] Add `created_at timestamptz NOT NULL DEFAULT now()`
- [ ] Add `updated_at timestamptz NOT NULL DEFAULT now()`

##### 1c. Extend `profiles` table

- [ ] `ALTER TABLE profiles ADD COLUMN permanent_availability text CHECK (permanent_availability IN ('immediate', 'after_notice', 'not_looking'))`
- [ ] `ALTER TABLE profiles ADD COLUMN notice_period_days integer`
- [ ] `ALTER TABLE profiles ADD COLUMN currently_employed boolean DEFAULT false`

##### 1d. Extend `applications` table

- [ ] `ALTER TABLE applications ADD COLUMN permanent_posting_id uuid REFERENCES permanent_postings(id)`
- [ ] `ALTER TABLE applications ADD COLUMN rejection_reason text`
- [ ] Drop and recreate `applications_status_check` to add `'selected'` and `'not_selected'`:
  ```sql
  ALTER TABLE applications DROP CONSTRAINT applications_status_check;
  ALTER TABLE applications ADD CONSTRAINT applications_status_check
    CHECK (status IN ('applied', 'viewed', 'shortlisted', 'accepted', 'rejected',
      'withdrawn', 'superseded', 'completed', 'cancelled_by_crew', 'cancelled_by_employer',
      'selected', 'not_selected'));
  ```
- [ ] Add XOR constraint: `ALTER TABLE applications ADD CONSTRAINT applications_posting_xor CHECK ((daywork_id IS NOT NULL) != (permanent_posting_id IS NOT NULL))`
- [ ] Add index on `permanent_posting_id`

##### 1e. Extend `active_engagements` table

- [ ] `ALTER TABLE active_engagements ADD COLUMN permanent_posting_id uuid REFERENCES permanent_postings(id)`
- [ ] `ALTER TABLE active_engagements ADD COLUMN outcome text CHECK (outcome IN ('successful_placement', 'not_successful', 'withdrew'))`
- [ ] Add XOR constraint: `ALTER TABLE active_engagements ADD CONSTRAINT engagements_posting_xor CHECK ((daywork_id IS NOT NULL) != (permanent_posting_id IS NOT NULL))`
- [ ] Add index on `permanent_posting_id`

##### 1f. Update `events_aggregate_type_check`

- [ ] Drop and recreate CHECK constraint to add `'permanent'`:
  ```sql
  ALTER TABLE events DROP CONSTRAINT events_aggregate_type_check;
  ALTER TABLE events ADD CONSTRAINT events_aggregate_type_check
    CHECK (aggregate_type IN ('person', 'vessel', 'daywork', 'application', 'message',
      'engagement', 'checklist', 'invitation', 'experience', 'admin', 'permanent'));
  ```

##### 1g. RLS policies on `permanent_postings`

- [ ] Enable RLS: `ALTER TABLE permanent_postings ENABLE ROW LEVEL SECURITY`
- [ ] SELECT for authenticated: `status IN ('active', 'in_negotiation') OR employer_person_id = auth.uid()`
- [ ] INSERT/UPDATE: service role only (via `apply_projection`)
- [ ] No DELETE policy (append-only projections)

##### 1h. RLS policies on `permanent_templates`

- [ ] Enable RLS: `ALTER TABLE permanent_templates ENABLE ROW LEVEL SECURITY`
- [ ] SELECT: `employer_person_id = auth.uid()`
- [ ] INSERT: `employer_person_id = auth.uid()`
- [ ] UPDATE: `employer_person_id = auth.uid()`
- [ ] DELETE: `employer_person_id = auth.uid()`

##### 1i. RLS policy extension on `applications`

- [ ] Add SELECT policy for permanent: crew can read own permanent applications (`crew_person_id = auth.uid() AND permanent_posting_id IS NOT NULL`)
- [ ] Add SELECT policy for permanent employer: employer can read applications on own permanent postings (`permanent_posting_id IN (SELECT id FROM permanent_postings WHERE employer_person_id = auth.uid())`)
- [ ] Verify existing daywork RLS policies are unchanged

##### 1j. Add `PERMANENT.*` handlers to `apply_projection`

**CRITICAL:** `CREATE OR REPLACE FUNCTION` replaces the entire function body. Diff the new version against the current (migration 00058) line-by-line. Every existing handler must be character-identical. New PERMANENT handlers go at the end of the CASE statement, before the ELSE.

**Documented exception:** The `PROFILE.UPDATED` handler is extended to write `permanent_availability`, `notice_period_days`, `currently_employed` from payload. These are nullable columns that default to NULL when absent.

Handlers to add:

- [ ] `PERMANENT.POSTED` — INSERT into `permanent_postings` with all posting fields from payload
- [ ] `PERMANENT.APPLIED` — INSERT into `applications` with `permanent_posting_id` (not `daywork_id`), status `'applied'`
- [ ] `PERMANENT.APPLICATION_BLOCKED` — No-op (intelligence only). `RAISE NOTICE` like admin canonical events.
- [ ] `PERMANENT.SHORTLISTED` — UPDATE application status → `'shortlisted'`. Guard: count existing `shortlisted` + `selected` applications for posting, no-op if >= `shortlist_cap`
- [ ] `PERMANENT.REJECTED` — UPDATE application status → `'rejected'`. Guard: status must be `IN ('applied', 'shortlisted')`
- [ ] `PERMANENT.SELECTED` — UPDATE application → `'selected'`. INSERT into `active_engagements` with `permanent_posting_id` (not `daywork_id`). UPDATE `permanent_postings` status → `'in_negotiation'`. Guard: posting must be `'active'`, no other `'selected'` application exists
- [ ] `PERMANENT.PLACEMENT_CONFIRMED` — UPDATE `permanent_postings` status → `'filled'`. UPDATE all remaining `shortlisted`/`applied` applications → `'not_selected'` with generic `rejection_reason`. Guard: posting must be `'in_negotiation'`
- [ ] `PERMANENT.SELECTION_REVERTED` — UPDATE `active_engagements` status → `'closed'`, outcome → `'not_successful'`. UPDATE selected application → `'not_selected'`. UPDATE `permanent_postings` status → `'active'`. Guard: posting must be `'in_negotiation'`
- [ ] `PERMANENT.WITHDRAWN` — UPDATE application → `'withdrawn'`. If application was `'selected'`: also close engagement (outcome `'withdrew'`) and revert posting to `'active'`. Guard: application must be in withdrawable status (`'applied'`, `'shortlisted'`, `'selected'`)
- [ ] `PERMANENT.CANCELLED_BY_EMPLOYER` — UPDATE `permanent_postings` status → `'cancelled'`. UPDATE all pending/shortlisted/applied applications → `'rejected'`. If posting was `'in_negotiation'`: also close engagement (outcome `'not_successful'`), set selected application → `'not_selected'`
- [ ] `PERMANENT.ENGAGEMENT_CLOSED` — UPDATE `active_engagements` status → `'closed'`, write `outcome` and `closed_by` from payload. If outcome is `'withdrew'` and `closed_by` is `'crew'`: also revert posting to `'active'`
- [ ] Extend `PROFILE.UPDATED` handler — add `permanent_availability`, `notice_period_days`, `currently_employed` to the UPDATE SET clause (nullable, COALESCE with existing values)

---

#### 2. Rollback — `supabase/rollbacks/00059_permanent_jobs.down.sql`

- [ ] Drop RLS policies on `permanent_postings` and `permanent_templates`
- [ ] Drop new RLS policies on `applications` (permanent-specific ones only, leave daywork policies intact)
- [ ] Drop XOR constraints on `applications` and `active_engagements`
- [ ] Drop `rejection_reason`, `permanent_posting_id` columns from `applications`
- [ ] Restore `applications_status_check` without `'selected'` and `'not_selected'`
- [ ] Drop `permanent_posting_id`, `outcome` columns from `active_engagements`
- [ ] Drop XOR constraint on `active_engagements`
- [ ] Drop `permanent_availability`, `notice_period_days`, `currently_employed` columns from `profiles`
- [ ] Drop `permanent_templates` table
- [ ] Drop `permanent_postings` table
- [ ] Restore `events_aggregate_type_check` without `'permanent'`
- [ ] Restore `apply_projection` to the exact body from migration 00058 (full function, self-contained per CLAUDE.md rule 4)
- [ ] Verify rollback is self-contained — running only this file returns DB to pre-Stage-127 state

---

#### 3. TypeScript types — `packages/types/src/events.ts`

- [ ] Add to `EventType` union (after admin events):
  ```typescript
  // Permanent aggregate
  | 'PERMANENT.POSTED'
  | 'PERMANENT.APPLIED'
  | 'PERMANENT.APPLICATION_BLOCKED'
  | 'PERMANENT.SHORTLISTED'
  | 'PERMANENT.REJECTED'
  | 'PERMANENT.SELECTED'
  | 'PERMANENT.PLACEMENT_CONFIRMED'
  | 'PERMANENT.SELECTION_REVERTED'
  | 'PERMANENT.WITHDRAWN'
  | 'PERMANENT.CANCELLED_BY_EMPLOYER'
  | 'PERMANENT.ENGAGEMENT_CLOSED'
  ```
- [ ] Add `'permanent'` to `AggregateType` union
- [ ] Add `EventPayloadMap` entries for all 11 events (APPLICATION_BLOCKED is intelligence-only but still needs a payload shape):
  - `PERMANENT.POSTED` — all posting fields (vessel_id, role_id, port_id, start_date, salary_min, salary_max, salary_currency, salary_period, live_aboard, required_certification_ids, experience_bracket_id, shortlist_cap, notes)
  - `PERMANENT.APPLIED` — `{ id: string; permanent_posting_id: string; crew_person_id: string; message?: string }`
  - `PERMANENT.APPLICATION_BLOCKED` — `{ crew_person_id: string; permanent_posting_id: string; missing_certification_ids: number[] }`
  - `PERMANENT.SHORTLISTED` — `{ crew_person_id: string; permanent_posting_id: string }`
  - `PERMANENT.REJECTED` — `{ crew_person_id: string; permanent_posting_id: string }`
  - `PERMANENT.SELECTED` — `{ crew_person_id: string; permanent_posting_id: string; engagement_id: string }`
  - `PERMANENT.PLACEMENT_CONFIRMED` — `{ permanent_posting_id: string }`
  - `PERMANENT.SELECTION_REVERTED` — `{ permanent_posting_id: string; engagement_id: string }`
  - `PERMANENT.WITHDRAWN` — `{ crew_person_id: string; permanent_posting_id: string }`
  - `PERMANENT.CANCELLED_BY_EMPLOYER` — `{ permanent_posting_id: string; reason?: string }`
  - `PERMANENT.ENGAGEMENT_CLOSED` — `{ engagement_id: string; outcome: 'successful_placement' | 'not_successful' | 'withdrew'; closed_by: 'crew' | 'employer' }`

---

#### 4. TypeScript types — `packages/types/src/enums.ts`

- [ ] Add `'selected'` and `'not_selected'` to `ApplicationStatus` type
- [ ] Add new types:

  ```typescript
  /** Permanent posting status */
  export type PermanentPostingStatus = 'active' | 'in_negotiation' | 'filled' | 'cancelled';

  /** Permanent availability for career status */
  export type PermanentAvailability = 'immediate' | 'after_notice' | 'not_looking';

  /** Salary period for permanent postings */
  export type SalaryPeriod = 'monthly' | 'annual';
  ```

---

#### 5. TypeScript types — `packages/types/src/models.ts`

- [ ] Add `PermanentPosting` interface:
  ```typescript
  export interface PermanentPosting {
    id: string;
    employer_person_id: string;
    vessel_id: string;
    role_id: number;
    port_id: number;
    start_date: string;
    salary_min: number;
    salary_max: number;
    salary_currency: string;
    salary_period: SalaryPeriod;
    live_aboard: boolean;
    required_certification_ids: number[];
    experience_bracket_id: number | null;
    shortlist_cap: number;
    notes: string | null;
    status: PermanentPostingStatus;
    job_number: number;
    created_at: string;
    updated_at: string;
  }
  ```
- [ ] Add `PermanentTemplate` interface (same fields minus status, job_number, add template_name)
- [ ] Update `Application` interface — add `permanent_posting_id: string | null` and `rejection_reason: string | null`
- [ ] Update `Engagement` interface (if it exists) — add `permanent_posting_id: string | null` and `outcome: string | null`
- [ ] Update `CrewProfile` interface — add `permanent_availability: PermanentAvailability | null`, `notice_period_days: number | null`, `currently_employed: boolean`
- [ ] Ensure all new types are exported from `src/index.ts`

---

#### 6. Verify

- [ ] `npx supabase db reset` — succeeds with no errors
- [ ] `cd apps/web && npm run test:integration` — all integration tests pass
- [ ] `npx tsc --noEmit` — zero errors (from repo root or apps/web)
- [ ] Verify new tables exist: `permanent_postings`, `permanent_templates`
- [ ] Verify RLS is enabled on both new tables
- [ ] Verify XOR constraints on `applications` and `active_engagements`
- [ ] Verify `events_aggregate_type_check` includes `'permanent'`
- [ ] Verify `applications_status_check` includes `'selected'` and `'not_selected'`
- [ ] Run rollback mentally: does `00059_permanent_jobs.down.sql` fully reverse every change? Does the restored `apply_projection` match migration 00058's version character-for-character?

---

#### 7. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 127] Permanent jobs schema + types + events — permanent_postings table, permanent_templates table, profile availability columns, applications + engagements XOR extensions, 12 PERMANENT.* event handlers in apply_projection, aggregate_type + application_status CHECK updates`
  - Schema version: v59
  - Migration 00059 in table: `permanent_postings + permanent_templates tables, profile permanent availability columns, applications + engagements XOR extensions (permanent_posting_id, outcome), PERMANENT.* handlers in apply_projection, aggregate_type + application_status CHECK updates`
- [ ] Update `supabase/README.md`:
  - Add migration 00059 to RPC table
  - Add "Permanent Posting Status Lifecycle" section (active → in_negotiation → filled/active/cancelled)
  - Add "Permanent Application State Machine" section
  - Add `permanent_postings` and `permanent_templates` table descriptions
- [ ] Update `packages/types/README.md`:
  - Add permanent event types to `src/events.ts` row
  - Add `PermanentPosting`, `PermanentTemplate` to `src/models.ts` row
  - Add `PermanentPostingStatus`, `PermanentAvailability`, `SalaryPeriod`, updated `ApplicationStatus` to `src/enums.ts` row

---

## Done

(See git history for completed stages 51-126, fixes 118a/123a/123b, messages test cleanup)
