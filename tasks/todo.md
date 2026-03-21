# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 127 Fix: PROFILE.UPDATED Payload + Commit

**Goal:** Fix the missing permanent availability fields in the PROFILE.UPDATED EventPayloadMap entry, then commit Stage 127.

**Context:** Stage 127 migration and types are complete but uncommitted. The planning agent review found one gap: the `PROFILE.UPDATED` payload in `EventPayloadMap` doesn't include the three permanent availability fields that the migration's `apply_projection` handler reads. Without this fix, Stage 130 (profile career status form) will hit a TypeScript error when emitting profile updates.

---

#### 1. Add permanent fields to PROFILE.UPDATED payload

File: `packages/types/src/events.ts`

Add three optional fields to the `PROFILE.UPDATED` entry in `EventPayloadMap` (after `visa_ids`):

- [ ] Add `permanent_availability?: string | null` to `PROFILE.UPDATED` payload
- [ ] Add `notice_period_days?: number | null` to `PROFILE.UPDATED` payload
- [ ] Add `currently_employed?: boolean` to `PROFILE.UPDATED` payload

---

#### 2. Verify

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — 716 tests pass
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings

---

#### 3. Commit Stage 127

Stage 127 is ready to commit after this fix. All files in the working tree (migration, rollback, types, enums, models, README updates, BUILD_STATE) are part of one stage.

- [ ] Commit with message referencing Stage 127

---

### Fix 127a: Integration Test Seed Data Alignment

**Goal:** Fix 10 pre-existing integration test failures caused by stale test expectations and seed data conflicts. These failures predate Stage 127 but should be resolved before permanent jobs implementation continues.

**Will touch:** `apps/web/__tests__/integration/event-roundtrip.test.ts`, possibly `supabase/seed/003_advanced_scenarios.sql`.

**Will NOT touch:** Migration, types, API routes, frontend, unit tests.

**Done condition:** `npm run test:integration` — all 38 tests pass (26 currently passing + 10 fixed + 2 skipped).

---

#### Root Cause Analysis

4 root causes produce 10 failures:

| Root Cause                          | Tests Affected | Fix Approach                    |
| ----------------------------------- | -------------- | ------------------------------- |
| Vessel name mismatch                | 1              | Update test expectation         |
| Working days mismatch               | 1              | Update test expectation         |
| Duplicate crew+daywork pair in seed | 2 (+2 cascade) | Use unique test IDs not in seed |
| Stale experience baseline           | 1              | Account for seed experiences    |
| Cascade from engagement not created | 4              | Fixed by root cause 3           |

---

#### 1. Fix vessel name expectation

File: `apps/web/__tests__/integration/event-roundtrip.test.ts`

The test expects `'M/Y Serenity'` but seed creates vessel with `name: 'Serenity'` (the M/Y prefix is a UI display convention, not stored in the DB — Stage 50 moved vessel_type to a separate column).

- [ ] Change `expect(data?.name).toBe('M/Y Serenity')` to `expect(data?.name).toBe('Serenity')`

---

#### 2. Fix working days expectation

Same file. Test expects `working_days` to be 5 but seed Job 1 has `working_days: 2`.

- [ ] Change `expect(data?.working_days).toBe(5)` to `expect(data?.working_days).toBe(2)`

---

#### 3. Fix duplicate application conflicts

Same file. Tests "creates application, then acceptance creates engagement" and "revokes all pending invitations when crew is accepted" try to create applications for crew+daywork pairs that seed data already created.

Two approaches — pick whichever is cleaner:

**Option A (preferred): Use different daywork IDs.** The test should create its own daywork posting via `append_event('DAYWORK.POSTED', ...)` with a fresh UUID, then apply to that. This makes the test self-contained and immune to seed data changes.

**Option B: Change seed data.** Remove the conflicting applications from `003_advanced_scenarios.sql`. Risk: other tests or manual testing may depend on them.

- [ ] Update the DAYWORK.APPLIED test to create its own daywork posting first (fresh UUID), then apply crew to it
- [ ] Update the invitation revocation test similarly — create its own daywork + apply + accept flow
- [ ] Verify: both tests pass, and the cascade dependents (MESSAGE.SENT, engagement lifecycle) also pass since they depend on engagements created by these tests

---

#### 4. Fix experience auto-derivation baseline

Same file. Test adds a 90-day experience and expects the crew's bracket to be recalculated to the "Green" bracket. But seed data already added experiences to the crew profile, so the baseline isn't clean.

- [ ] Either: use a fresh crew person (created in test setup, not the seed crew)
- [ ] Or: account for existing seed experiences in the expected bracket calculation — read the current bracket before the test, add the new experience, and verify the bracket changed appropriately

---

#### 5. Fix engagement lifecycle cascade

Same file. Tests for DAYWORK.COMPLETED, COMPLETION_CONFIRMED, RATED_BY_CREW, RATED_BY_EMPLOYER depend on Job 5's engagement from seed. Verify that seed Job 5's engagement actually materialises. If it does, the failures cascade from root cause 3 (not from seed). If the engagement exists, these tests should pass once root cause 3 is fixed.

- [ ] After fixing root cause 3, run the full integration suite. If engagement lifecycle tests still fail, check whether `beforeAll` fetches the correct engagement ID for Job 5
- [ ] If Job 5 engagement doesn't exist in DB after seed, investigate seed data for Job 5 (lines 338-470 of `003_advanced_scenarios.sql`)

---

#### 6. Verify

- [ ] `npm run test:integration` — all 38 tests pass (26 + 10 fixed + 2 skipped)
- [ ] `npx vitest run` — 716 unit tests still pass (no regression)

---

#### 7. Documentation

- [ ] Update `BUILD_STATE.md`: `[Fix 127a] Integration test seed data alignment — vessel name, working days expectations, self-contained application tests, experience baseline fix`

---

## Done

(See git history for completed stages 51-126b, fixes 118a/123a/123b, messages test cleanup)
