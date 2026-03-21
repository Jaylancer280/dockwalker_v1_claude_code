# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Fix 139a: Network Failure Handling (HIGH)

**Goal:** Wire `safeFetch` into all page-level fetch calls, or wrap bare `fetch()` in try/finally to guarantee loading state cleanup on network failure. Currently 94 bare `fetch()` calls across 19 pages with zero callsites for the existing `safeFetch` wrapper.

**Will touch:** Page files in `apps/web/src/app/(app)/` — primarily discover, messages, chat, profile, mine, settings, and all permanent pages.

**Will NOT touch:** API routes (server-side), migrations, tests (unless mocks need updating).

**Done condition:** No bare `fetch()` in any page.tsx that can leave a loading spinner stuck. `safeFetch` imported and used, or every fetch wrapped in try/finally with state cleanup.

**Approach:** Two options — pick whichever is cleaner:

**Option A (preferred): Replace bare `fetch()` with `safeFetch()` from `@/lib/safe-fetch`**

- `safeFetch` already handles: timeout (15s), error catching, safe JSON parse, typed discriminated union response
- Pattern: `const result = await safeFetch<T>(url, options); if (!result.ok) { showError(result.error); return; }`
- State cleanup guaranteed because `safeFetch` never throws

**Option B: Wrap every fetch in try/finally**

- `try { const res = await fetch(...); ... } catch { showError(); } finally { setLoading(false); }`
- More mechanical, but doesn't require changing the return type handling

---

#### Critical callsites (fix these first)

These are the highest-impact stuck-spinner paths:

- [ ] `discover/page.tsx:291,311` — discovery load/loadMore. Network fail = spinner forever. Wrap in try/finally or use safeFetch. Ensure `setLoading(false)` and `setLoadingMore(false)` always run.
- [ ] `discover/page.tsx:410-411` — `Promise.all` for unified Applied tab. If one API fails, partial state. Wrap in try/catch, show error toast, set `setLoadingApps(false)`.
- [ ] `messages/[engagementId]/page.tsx:87,93` — `loadContext()` and `loadMessages()`. Network fail = chat page blank with spinner. Ensure `setLoading(false)` in finally.
- [ ] `messages/[engagementId]/page.tsx` — all action handlers (send message, complete, cancel, rate, checklist, postponement, work-started). Each sets a flag like `setSending(true)` without try/finally. Wrap each in try/finally.

#### Remaining pages (systematic sweep)

- [ ] `profile/page.tsx` — profile load, profile save, availability load
- [ ] `daywork/mine/page.tsx` — postings load, engagement fetch
- [ ] `daywork/mine/_components/permanent-mine-section.tsx` — postings load, templates load
- [ ] `daywork/post/page.tsx` — template load, form submit
- [ ] `daywork/post/_components/permanent-post-form.tsx` — template load, form submit, lookup data
- [ ] `settings/page.tsx` — password change, email change, data export, account deletion
- [ ] `docky/[conversationId]/page.tsx` — message send, conversation load
- [ ] `permanent/[id]/review/page.tsx` — applicants load, shortlist/reject/select actions
- [ ] `discover/_components/permanent-job-feed.tsx` — feed load, apply action
- [ ] `vessels/page.tsx` — vessel load, create, edit
- [ ] `profile/add-experience/page.tsx` and `profile/edit-experience/[id]/page.tsx` — form submits
- [ ] Any other page with bare `fetch()` calls

#### Verify

- [ ] Grep for bare `fetch(` in all page.tsx files — zero results (all replaced with safeFetch or wrapped in try/finally)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Manual: turn off network (airplane mode on phone), try to load discover page. Verify: error toast appears, spinner clears, app doesn't hang.

---

### Fix 139b: Onboarding Atomicity (HIGH)

**Goal:** Prevent experienced-crew onboarding from stranding users in a partial state when vessel/experience creation fails after `onboard_person` succeeds.

**Will touch:** `apps/web/src/app/api/onboarding/route.ts`

**Will NOT touch:** Onboarding UI, migrations, other routes.

**Done condition:** If vessel/experience step fails, the user can retry onboarding and the route fills in the missing data. The silent `continue` on LOA resolution failure is replaced with an error.

---

#### Root cause

- Line 98: `onboard_person` RPC creates person + profile (atomic)
- Line 268: `appendEvents` batch creates vessels + experiences (atomic within batch)
- Gap: if line 268 fails, person exists but experiences don't. Lines 49-58 block retry with 409 "Already onboarded."

#### Fix approach: Make the route re-entrant

- [ ] Change the "Already onboarded" check (lines 49-58): instead of returning 409 immediately, check if the person exists BUT is missing experiences that were submitted. If experiences are incomplete, allow the route to continue from the vessel/experience step only.

  ```typescript
  // Instead of:
  if (existingPerson) return 409;

  // Do:
  if (existingPerson) {
    // Check if this is a retry with experiences to add
    if (!body.experiences?.length) return 409; // truly already complete
    // Fall through to vessel/experience creation only
    skipOnboardPerson = true;
  }
  ```

- [ ] When `skipOnboardPerson` is true, skip the `onboard_person` RPC call but still process vessel/experience batch
- [ ] Guard against duplicate experience entries: check if experience with same vessel_id + start_date already exists before appending

#### Fix the silent continue

- [ ] Line 211: `if (!sizeBand) continue;` — replace with error response:
  ```typescript
  if (!sizeBand) {
    return NextResponse.json(
      {
        error: `Could not resolve size band for LOA ${exp.loaMeters}m on vessel "${exp.vesselName}"`,
      },
      { status: 400 },
    );
  }
  ```
  This surfaces the problem to the user instead of silently dropping their experience entry.

#### Tests

- [ ] Test: retry after partial onboarding with experiences succeeds (doesn't 409)
- [ ] Test: retry without experiences still returns 409
- [ ] Test: LOA that doesn't match any size band returns 400 (not silent skip)

#### Verify

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Manual: start onboarding as experienced crew. Verify full flow completes. Then test: what happens if you visit /onboarding after completing it?

---

### Fix 139c: Stripe Origin Header Hardening (MEDIUM)

**Goal:** Replace caller-supplied `Origin` header with server-side canonical URL in Stripe redirect URLs.

**Will touch:** `apps/web/src/app/api/billing/create-checkout/route.ts`, `apps/web/src/app/api/billing/create-portal/route.ts`

**Done condition:** Stripe success/cancel/return URLs always use `NEXT_PUBLIC_APP_URL`, never the request Origin header.

---

- [ ] In `create-checkout/route.ts` line 45-46, change:

  ```typescript
  // From:
  const origin =
    request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // To:
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  ```

- [ ] In `create-portal/route.ts` line 31-32, same change
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Commit

---

### Fix 139d: Docky Usage Race Condition (MEDIUM)

**Goal:** Make the free-tier question count check-and-increment atomic to prevent concurrent requests bypassing the 3-question limit.

**Will touch:** `apps/web/src/app/api/advisor/conversations/[id]/messages/route.ts`

**Done condition:** Two concurrent requests cannot both pass the <3 gate. Usage count is accurate.

---

#### Current flow (lines 76-147)

1. Read `question_count` (line 76)
2. Gate: `if (usageCount >= 3)` return 402 (line 82)
3. Save user message (line 91)
4. LLM call (line 114)
5. Save assistant message (line 123)
6. Increment: upsert `question_count: usageCount + 1` (line 147)

6 async operations between check and increment.

#### Fix: Increment first, rollback on failure

- [ ] Move the usage increment BEFORE the LLM call:

  ```typescript
  // Atomic check-and-increment using Postgres
  const { data: usage, error: usageError } = await serviceClient
    .from('advisor_usage')
    .upsert(
      { person_id: user.id, month: currentMonth, question_count: 1 },
      { onConflict: 'person_id,month', ignoreDuplicates: false },
    )
    .select('question_count')
    .single();
  ```

  Actually, the cleanest fix is an atomic SQL approach:

  ```typescript
  // Use raw RPC or Postgres function:
  // INSERT INTO advisor_usage (person_id, month, question_count) VALUES ($1, $2, 1)
  // ON CONFLICT (person_id, month) DO UPDATE SET question_count = advisor_usage.question_count + 1
  // WHERE advisor_usage.question_count < 3
  // RETURNING question_count;
  ```

  If `question_count` was already >= 3, the UPDATE WHERE clause doesn't match, so no row is returned → return 402.

- [ ] Alternative simpler approach: increment optimistically, check result:

  ```typescript
  const { data, error } = await serviceClient.rpc('increment_advisor_usage', {
    p_person_id: user.id,
    p_month: currentMonth,
    p_limit: 3,
  });
  if (!data) return 402; // limit reached
  ```

  This requires a small Postgres function (new migration) but is the most correct solution.

- [ ] If the LLM call fails after incrementing, the count still goes up. This is acceptable — the user "used" a question even if the AI didn't respond. Better than the alternative (count doesn't increment, user retries, gets a free answer).

#### Verify

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Test: send 3 Docky messages → 4th returns 402

---

### Fix 139e: Integration Test Harness (MEDIUM)

**Goal:** Fix password mismatch, document db reset requirement, update README.

**Will touch:** Integration test file, seed data or test credentials, `supabase/README.md`.

**Done condition:** `npm run test:integration` passes without the 2 skipped NDA tests failing. README documents correct test passwords and db reset requirement.

---

- [ ] Determine which is canonical — test password (`12345678`) or seed password (`87654321`). Align one to the other.
- [ ] If changing seed: update `supabase/seed/002_test_profiles.sql` passwords
- [ ] If changing test: update `__tests__/integration/event-roundtrip.test.ts` credentials
- [ ] Update `supabase/README.md` seed data table with correct password
- [ ] Add note to test section: "Integration tests require `npx supabase db reset` before each run. They use fixed UUIDs and will fail against a non-clean database."
- [ ] Verify: `npx supabase db reset && npm run test:integration` — 47/47 pass (0 skipped)
- [ ] Commit

---

### Fix 139f: UUID Validation on Profile View Param (LOW)

**Goal:** Validate `personId` param is a valid UUID before interpolating into PostgREST `.or()` filter strings. Converts a noisy 500 into a clean 400.

**Will touch:** `apps/web/src/app/api/profile/[personId]/route.ts`

**Done condition:** Non-UUID personId returns 400 instead of 500.

---

- [ ] Add UUID validation after param extraction (after line 19):
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(personId)) {
    return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
  }
  ```
- [ ] Same validation for `requesterId` (user.id — but this comes from auth, so it's always valid. Skip.)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Commit

---

## Done

(See git history for completed stages 51-139, fixes 118a/123a/123b/127a/128a/128b/131a, template name cap, messages test cleanup)
