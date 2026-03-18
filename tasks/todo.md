# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 95: Codebase Hardening — Audit Fixes

---

## Queue

---

### Stage 95: Codebase Hardening — Audit Fixes

**Goal:** Fix 5 issues identified in the full codebase audit: projection state guards, hat validation, RLS completeness, architectural consistency, env var safety.

**Will NOT touch:** UI pages, Docky advisor, billing flows, test files (except new tests for new migration logic).

**Done condition:** Ledger replay produces identical projection state as live writes. All event handlers are in `apply_projection`. All CRUD tables have complete RLS. All routes validate hat before recording roleContext.

---

#### 1. Migration — `supabase/migrations/00048_projection_state_guards.sql`

**Fixes E1/E2:** Add WHERE clauses to ACCEPTED and REJECTED handlers in `apply_projection`. Also moves DAYWORK.EXTENDED into `apply_projection` (fix E3) and drops the standalone trigger.

- [x] Create migration with `CREATE OR REPLACE FUNCTION public.apply_projection(...)`:
  - **CRITICAL: Diff against migration 00041** (the current version). The new function body must include ALL existing handlers unchanged, plus these modifications:
    - `DAYWORK.ACCEPTED` (line 237 in 00041): Add `AND status IN ('applied', 'viewed', 'shortlisted')` to the UPDATE on applications. This matches the API-layer validation in the accept route (lines 57-61).
      ```sql
      -- Was:
      update public.applications set status = 'accepted', updated_at = now()
        where crew_person_id = ... and daywork_id = ...;
      -- Becomes:
      update public.applications set status = 'accepted', updated_at = now()
        where crew_person_id = ... and daywork_id = ...
        and status in ('applied', 'viewed', 'shortlisted');
      ```
    - `DAYWORK.REJECTED` (line 255 in 00041): Same fix.
      ```sql
      -- Was:
      update public.applications set status = 'rejected', updated_at = now()
        where crew_person_id = ... and daywork_id = ...;
      -- Becomes:
      update public.applications set status = 'rejected', updated_at = now()
        where crew_person_id = ... and daywork_id = ...
        and status in ('applied', 'viewed', 'shortlisted');
      ```
    - **Add `DAYWORK.EXTENDED` handler** to the CASE statement (currently handled by standalone trigger in 00036). Copy the logic from `apply_daywork_extended()`:
      ```sql
      when 'DAYWORK.EXTENDED' then
        update public.dayworks set
          end_date = coalesce((p_payload->>'end_date')::date, end_date),
          working_days = coalesce((p_payload->>'working_days')::int, working_days),
          working_day_dates = case
            when p_payload ? 'working_day_dates' then (
              select array_agg(d::date)
              from jsonb_array_elements_text(p_payload->'working_day_dates') d
            )
            else working_day_dates
          end
        where id = (p_payload->>'daywork_id')::uuid;
      ```
      **Note:** The standalone trigger uses `new.payload` (trigger row reference). Inside `apply_projection`, use the function parameter `p_payload` instead.
  - **Drop the standalone trigger and function:**
    ```sql
    drop trigger if exists trg_apply_daywork_extended on public.events;
    drop function if exists public.apply_daywork_extended();
    ```

- [x] Create rollback `supabase/rollbacks/00048_projection_state_guards.down.sql`:
  - Restore `apply_projection` to the 00041 version (copy the FULL function body from 00041)
  - Recreate the standalone `apply_daywork_extended()` function and trigger (copy from 00036)
  - **Rollback must be self-contained** — include the full function bodies, not comments saying "restore from migration X"

**Verification:** After `npx supabase db reset`, manually test:

- Accept an applied application → status becomes 'accepted'
- Try to accept an already-rejected application via raw SQL `appendEvent` → status should NOT change (WHERE clause prevents it)
- Extend a daywork via the API → end_date updates (EXTENDED handler works in apply_projection)

---

#### 2. Route fix — Hat validation on `update-positions`

**Fixes S2.**

- [x] Update `apps/web/src/app/api/daywork/[id]/update-positions/route.ts`:
  - After the `requireDomainUser()` guard (line 12), add hat validation before the ownership check:
    ```typescript
    if (!['employer', 'agent'].includes(person.current_hat)) {
      return NextResponse.json({ error: 'Only employers can update positions' }, { status: 403 });
    }
    ```
  - Change the destructuring to include `person`:
    ```typescript
    const { user, person, supabase, serviceClient } = guard.value;
    ```
  - Replace the hardcoded `roleContext: 'employer'` with `roleContext: person.current_hat as 'employer' | 'agent'` so the event records the actual hat worn.

---

#### 3. Migration — `supabase/migrations/00049_templates_update_policy.sql`

**Fixes R1.**

- [x] Create migration:

  ```sql
  -- =============================================================================
  -- Migration 00049: daywork_templates UPDATE policy
  -- =============================================================================

  create policy "Owner can update own templates"
    on public.daywork_templates for update
    to authenticated
    using (person_id = auth.uid())
    with check (person_id = auth.uid());
  ```

- [x] Create rollback `supabase/rollbacks/00049_templates_update_policy.down.sql`:
  ```sql
  drop policy if exists "Owner can update own templates" on public.daywork_templates;
  ```

---

#### 4. Route fix — Stripe webhook env var guard

**Fixes S3.**

- [x] Update `apps/web/src/app/api/webhooks/stripe/route.ts`:
  - Before the `stripe.webhooks.constructEvent()` call, add explicit check:
    ```typescript
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    ```
  - This removes the `!` non-null assertion.

---

#### 5. Tests

- [x] Update existing accept route test (`__tests__/api/daywork-accept.test.ts` or similar):
  - Verified: test already covers `status: 'rejected'` → returns 400. No changes needed.

- [x] Update existing reject route test:
  - Verified: test already covers `status: 'accepted'` → returns 400. No changes needed.

- [x] Add test for update-positions hat validation:
  - Added crew hat → 403 test to multi-crew.test.ts.

---

#### 6. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 95] Codebase hardening — projection state guards on ACCEPTED/REJECTED, DAYWORK.EXTENDED moved into apply_projection, hat validation on update-positions, daywork_templates UPDATE policy, webhook env guard`
  - Schema version bump to v49
  - Migration table entries for 00048 and 00049
- [x] Update `supabase/README.md` — migration 00048 and 00049 entries
- [x] Update `tasks/lessons.md` — append: "Projection handlers must enforce the same state preconditions as the API layer. API validation prevents invalid events from being appended, but projection WHERE clauses prevent invalid transitions during ledger replay. Both layers must agree."

---

### Stage 96: Security Headers + Multi-Event Transactionality

**Goal:** Add production security headers via `vercel.json`. Audit and fix the one route (`/api/onboarding`) that uses sequential `appendEvent` calls in a loop instead of `appendEvents` batch.

**Will NOT touch:** UI pages, components, styles, migrations, RLS.

**Done condition:** `vercel.json` exists with HSTS, X-Frame-Options, X-Content-Type-Options, CSP headers. Onboarding route uses `appendEvents()` for vessel+experience batch. All other multi-event routes already use batch or are conditional branches (confirmed safe).

---

#### 1. Security headers — `vercel.json`

- [ ] Create `apps/web/vercel.json` with production security headers:

  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=63072000; includeSubDomains; preload"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ]
  }
  ```

  - **Note:** CSP omitted intentionally — Next.js inline scripts and Supabase/Stripe external calls make a restrictive CSP fragile. Can be added later with `nonce`-based approach.
  - **Note:** Check if `vercel.json` should live at repo root or `apps/web/` (monorepo — likely repo root since Vercel deploys from root).

---

#### 2. Onboarding route — batch vessel+experience events

- [ ] Update `apps/web/src/app/api/onboarding/route.ts`:
  - Currently lines ~196-216: a `for...of` loop calls `appendEvent` sequentially for each `VESSEL.CREATED` + `EXPERIENCE.ADDED` pair
  - Refactor: collect all events into an array during the loop, then call `appendEvents(serviceClient, allEvents)` once after the loop
  - This makes the entire vessel+experience batch atomic — if any event fails, none are committed
  - Preserve the vessel lookup logic (check existing vessel before creating) — the lookup stays sequential, only the event appending becomes batched
  - Import `appendEvents` from `@dockwalker/db` (already exported alongside `appendEvent`)

- [ ] Verify `/api/availability/route.ts` is safe:
  - Has 3 `appendEvent` calls but they're in mutually exclusive conditional branches (clear vs not-available vs date-ranges)
  - No fix needed — confirm by reading the file

---

#### 3. Tests

- [ ] Update onboarding test (`__tests__/api/onboarding.test.ts` or similar):
  - Verify existing test for experienced crew onboarding still passes after batch refactor
  - Mock should now expect a single `appendEvents` call with array of events instead of multiple `appendEvent` calls

---

#### 4. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 96] Security headers (vercel.json) + onboarding event batching for atomicity`
- [ ] Mark P0 #5 (security headers) and P2 #15 (multi-event transactionality) as `[x]` in `tasks/launch-readiness.md`

---

### Stage 97: Offline Resilience + Unified Error Feedback

**Goal:** Add network status detection, a fetch wrapper with timeout and retry, and fix all 9 silent-failure fetch calls across discover, review, messages, and profile pages.

**Will NOT touch:** API routes, migrations, database, Capacitor native code.

**Done condition:** Every user-facing fetch call shows a toast on failure. Network-down state shows a persistent banner. Fetch calls have a 15s timeout. Submit buttons are disabled during all async actions.

---

#### 1. Network status hook — `apps/web/src/hooks/use-network-status.ts`

- [ ] Create hook that:
  - Tracks `navigator.onLine` state
  - Listens to `online`/`offline` window events
  - Returns `{ isOnline: boolean }`
  - Cleans up listeners on unmount

---

#### 2. Offline banner component — `apps/web/src/components/offline-banner.tsx`

- [ ] Create a fixed-top banner (below status bar, above content):
  - Shows "You're offline — actions will fail until connection returns" in warning style
  - Only visible when `isOnline === false`
  - Dismisses automatically when connection restores
  - Uses `use-network-status` hook

- [ ] Add `<OfflineBanner />` to `apps/web/src/app/(app)/layout.tsx` inside the authenticated layout, above the main content area

---

#### 3. Fetch wrapper — `apps/web/src/lib/safe-fetch.ts`

- [ ] Create a thin wrapper around `fetch` that:
  - Adds a 15-second `AbortController` timeout (configurable)
  - On network error or timeout, returns `{ ok: false, error: 'Network error — check your connection' }`
  - On HTTP error (4xx/5xx), parses `res.json()` safely (with the `text → JSON.parse` guard from lessons.md) and returns `{ ok: false, error: data.error ?? 'Something went wrong' }`
  - On success, returns `{ ok: true, data }`
  - Signature: `safeFetch(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }>`
  - Does NOT retry — keep it simple. Retry adds complexity and can cause duplicate events on non-idempotent routes.

---

#### 4. Add `showSuccess` to toast hook

- [ ] Update `apps/web/src/hooks/use-toast.ts`:
  - Add `showSuccess(message: string)` alongside existing `showError`
  - Success toast uses `bg-success text-white` styling (green) instead of `bg-destructive`
  - Same auto-dismiss (5s), same max-3 limit
- [ ] Update `apps/web/src/components/toast-container.tsx`:
  - Support a `variant` field on Toast type (`'error' | 'success'`)
  - Apply conditional styling based on variant

---

#### 5. Fix silent failures — Discover page

File: `apps/web/src/app/(app)/discover/page.tsx`

- [ ] **Apply action** (`handleApply`): Add toast on failure — `showError(data.error ?? 'Failed to apply')`. Use `safeFetch` or add inline error handling after the `if (res.ok)` check.
- [ ] **Withdraw action** (`handleWithdraw`): Same — add `showError` on failure.
- [ ] Verify apply/withdraw buttons are already disabled during request (they are per audit — `disabled={applying}`). No change needed.

---

#### 6. Fix silent failures — Review page

File: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

- [ ] **Accept action** (`handleAccept`): Add `showError(data.error ?? 'Failed to accept')` in else branch after `if (res.ok)`.
- [ ] **Reject action** (`handleReject`): Add `showError(data.error ?? 'Failed to reject')` in else branch.
- [ ] **Shortlist action** (`handleShortlist`): Add `showError(data.error ?? 'Failed to shortlist')` in else branch.
- [ ] Verify the page uses `useToast()` — if not, add the import and hook call.

---

#### 7. Fix silent failures — Messages page

File: `apps/web/src/app/(app)/messages/[engagementId]/page.tsx`

- [ ] **Send message** (`handleSend`): Add `showError('Failed to send message')` in else branch after `if (res.ok)`. Do NOT clear the input on failure so the user can retry.
- [ ] **Checklist toggle** (`handleChecklistToggle`): Add `showError` on failure. This is a non-critical action — error feedback is still valuable.

---

#### 8. Fix silent failures — Profile page

File: `apps/web/src/app/(app)/profile/page.tsx`

- [ ] **Profile save** (`handleSave`): Add `showError(data.error ?? 'Failed to save profile')` on failure. Add `showSuccess('Profile updated')` on success.
- [ ] **Delete experience** (`handleDeleteExperience`): Add `showError(data.error ?? 'Failed to delete experience')` on failure.

---

#### 9. Tests

- [ ] Create `__tests__/lib/safe-fetch.test.ts`:
  - Test: successful fetch returns `{ ok: true, data }`
  - Test: HTTP 400 returns `{ ok: false, error: '...' }`
  - Test: network error returns `{ ok: false, error: 'Network error...' }`
  - Test: timeout returns `{ ok: false, error: 'Network error...' }`

- [ ] Create `__tests__/hooks/use-network-status.test.ts`:
  - Test: returns `isOnline: true` when `navigator.onLine` is true
  - Test: updates when offline event fires

---

#### 10. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 97] Offline resilience — network status hook, offline banner, safeFetch wrapper with timeout, unified toast error feedback on all 9 silent-failure fetch calls`
- [ ] Mark P0 #2 (offline handling) and P0 #3 (error feedback) as `[x]` in `tasks/launch-readiness.md`

---

### Stage 98: Landing Page

**Goal:** Replace the design system preview at `/` with a proper product landing page for unauthenticated visitors. Authenticated users are already redirected by middleware — this page is only seen by new visitors.

**Will NOT touch:** Auth pages, protected app pages, API routes, database.

**Done condition:** Unauthenticated visitor sees a branded page explaining what DockWalker is, with clear CTAs to sign up or log in. Page is mobile-first, uses existing design tokens, and loads fast (no heavy assets).

---

#### 1. Landing page — `apps/web/src/app/page.tsx`

- [ ] Replace the design system preview with a product landing page:
  - **Hero section:**
    - DockWalker logo (existing `/images/brand/dw_app_icon_cropped.png`)
    - Headline: concise value prop (e.g. "Superyacht daywork, simplified")
    - Subtitle: one line explaining the two-sided marketplace
    - Two CTAs: "Sign up" (primary, links to `/auth/signup`) and "Log in" (secondary/outline, links to `/auth/login`)
  - **Value props section** (3 cards or icon+text blocks):
    - For crew: "Find daywork fast — browse and apply in seconds"
    - For employers: "Fill roles today — post a job, review applicants, hire"
    - For both: "Structured, fair, no hidden algorithms"
  - **How it works** (3 steps, simple):
    - 1. Create your profile
    - 2. Browse or post daywork
    - 3. Connect and confirm
  - **Footer:** App name, tagline from manifest ("Superyacht daywork hiring — find crew or find work"), link to login

- [ ] Design constraints:
  - Mobile-first (max-w-lg mx-auto, matching app layout)
  - Use existing design tokens only (`bg-navy`, `text-sea`, `bg-teal`, etc.)
  - No external images or heavy assets — text + icons + existing brand image
  - No JavaScript interactivity needed (static content)
  - Semantic HTML for SEO (h1, h2, section, footer)

- [ ] Verify middleware behavior:
  - Authenticated users hitting `/` should still redirect to `/discover` or `/daywork/mine` based on hat
  - Only unauthenticated users see the landing page
  - Confirm this is handled by the `(app)/layout.tsx` auth check or the proxy middleware — read the redirect logic to be sure

---

#### 2. Tests

- [ ] No component tests needed for a static landing page — it has no interactive logic
- [ ] Verify existing tests still pass (no regressions from replacing page.tsx)

---

#### 3. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 98] Landing page — product hero, value props, and CTAs replacing design system preview`
- [ ] Mark P0 #4 (landing page) as `[x]` in `tasks/launch-readiness.md`

---

## Done

(See git history for completed stages 51-94b)
