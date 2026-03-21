# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 141a: safeFetch Migration + Consistent Error Handling

---

## Queue

### Stage 141: Client-Side Resilience Polish

**Goal:** "Works when the network behaves" → "feels solid when the network doesn't." Consistent fetch error handling across all pages, safeFetch adoption, silent-but-intentional degradation for background refreshes, and uniform user feedback on all async actions.

**Will touch:** All page files in `apps/web/src/app/(app)/`, `safe-fetch.ts`, component files with fetch calls.

**Will NOT touch:** API routes, migrations, push-triggers, tests (except adding resilience tests in Stage 141b).

**Done condition:** Zero bare `fetch()` calls that can produce unhandled rejections. Every async action either shows a toast or intentionally degrades. `safeFetch` is the standard for all client-side fetches.

**Approach:** Two sub-stages for clean commit boundaries.

---

### Stage 141a: safeFetch Migration + Consistent Error Handling

**Goal:** Replace all bare `fetch()` in page files with `safeFetch` from `@/lib/safe-fetch`. This gives every fetch call: 15s timeout, catch-all error handling, typed discriminated union response, and zero unhandled rejections — by construction.

---

#### The Standard

Every client-side fetch should follow one of two patterns:

**Pattern A — User-initiated action (apply, submit, withdraw, etc.):**

```typescript
setLoading(true);
const result = await safeFetch<ResponseType>(url, options);
if (!result.ok) {
  showError(result.error);
} else {
  // Handle success
}
setLoading(false); // Or in a finally if there's early returns
```

User sees a toast on failure. Loading state always clears.

**Pattern B — Background refresh (load data, poll, mount-time fetch):**

```typescript
const result = await safeFetch<ResponseType>(url);
if (result.ok) {
  setData(result.data);
}
// No error toast — silent degradation. Data stays stale but UI doesn't break.
```

No toast. Failed background refresh just means stale data. The page still functions.

#### Pages to migrate (ordered by gap severity)

##### HIGH — Most bare fetches relative to try coverage

- [x] `messages/[engagementId]/page.tsx` — 21 fetches, 16 try, 9 finally. The 5 unguarded fetches are mostly permanent actions added in Stage 135. Migrate all 21 to safeFetch.
  - Action fetches (send, cancel, complete, rate, checklist, work-started, postponement, permanent actions): Pattern A with toast
  - `loadContext`, `loadMessages`: Pattern B — already have try/catch, convert to safeFetch for consistency
  - `init()` auth fetch: Pattern B — already has `.catch(() => null)`, convert to safeFetch
  - `markRead`: fire-and-forget, already has `.catch(() => {})` — convert to safeFetch with no result check

- [x] `daywork/[id]/review/page.tsx` — 6 fetches, 2 try, 2 finally. The 4 unguarded fetches are likely data loads (applicants, shortlist actions). Migrate all.

- [x] `profile/add-experience/page.tsx` — 3 fetches, 1 try, 1 finally. Likely lookup data loads + form submit.

##### MEDIUM — Some gaps

- [x] `docky/page.tsx` — 6 fetches, 5 try, 2 finally. Mostly covered, fill the gap.
- [x] `profile/page.tsx` — 5 fetches, 4 try, 3 finally. One unguarded fetch, likely a data load.
- [x] `daywork/post/page.tsx` — 4 fetches, 2 try, 2 finally. Template load + submit.
- [x] `permanent/[id]/review/page.tsx` — 5 fetches, 5 try, 1 finally. Try coverage good but finally missing on 4 — loading flags may stick.
- [x] `notifications/page.tsx` — 2 fetches, 1 try, 1 finally.
- [x] `billing/page.tsx` — 3 fetches, 3 try, 1 finally.

##### LOW — Already good, convert for consistency

- [x] `discover/page.tsx` — 9 fetches, 10 try, 9 finally. Well-covered already. Convert for consistency.
- [x] `settings/page.tsx` — already well-guarded. Convert for consistency.
- [x] `vessels/page.tsx`, `vessels/[id]/edit/page.tsx` — already well-guarded. Convert.
- [x] `messages/page.tsx` — 1 fetch, well-guarded. Convert.
- [x] `docky/[conversationId]/page.tsx` — well-guarded. Convert.
- [x] `daywork/mine/page.tsx` — well-guarded. Convert.
- [x] `profile/edit-experience/[id]/page.tsx` — well-guarded. Convert.

##### Component files with fetch calls

- [x] `daywork/mine/_components/permanent-mine-section.tsx` — has fetch calls for postings + templates
- [x] `discover/_components/permanent-job-feed.tsx` — has fetch calls for feed + apply
- [x] `daywork/post/_components/permanent-post-form.tsx` — has fetch calls for lookups + submit + templates
- [x] Any other `_components/` files with fetch calls — audit and convert

#### Verify

- [x] `grep -rn "await fetch(" src/app/\(app\)/ --include="*.tsx"` — zero results (all converted to safeFetch)
- [x] `npx tsc --noEmit` — zero errors
- [x] `npx vitest run` — all tests pass (812/812)
- [x] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] Commit: "Stage 141a: safeFetch migration — zero bare fetch in client pages"

---

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Resilience Tests

Component tests that verify UI recovery from network failures. safeFetch migration (141a) gives correct behavior by construction; these tests prove it.

- [ ] Discover page: mock safeFetch to return `{ ok: false }` on loadCards → verify: no spinner stuck, error state shown
- [ ] Chat page: mock safeFetch to return `{ ok: false }` on loadMessages → verify: no spinner stuck, polling still sets up
- [ ] Apply action: mock safeFetch to return `{ ok: false }` → verify: toast shown, applying state clears
- [ ] Post form: mock safeFetch to return `{ ok: false }` on submit → verify: toast shown, submitting state clears
- [ ] Availability overlay close → network fail → verify: no unhandled rejection, cached state preserved

### Component Tests for Permanent UI

Zero component tests exist for permanent job pages (cards, feed, review, mine, post form). API tests cover the critical paths but rendering regressions are only caught manually.

- [ ] PermanentJobCard: renders salary (exact vs range), "ASAP" for past dates, cert list, disabled apply when missing certs
- [ ] PermanentJobFeed: filter panel renders, empty state, pagination trigger
- [ ] PermanentPostForm: required field validation, salary preview, template load/save
- [ ] PermanentReviewPage: tab switching, shortlist cap indicator, negotiation banner
- [ ] PermanentApplicationCard: status labels (Under review / Shortlisted / Selected / Position filled), withdraw button visibility

### Push-Triggers Further Decomposition

If a third domain is added (e.g., `CONTRACT.*`), decompose `daywork-handlers.ts` (320 lines) further. Currently manageable but approaching the threshold.

### Onboarding True Atomicity

The re-entrant retry fix handles the failure case, but `onboard_person` + vessel/experience batch are still two DB calls. A single Postgres RPC wrapping the full onboarding flow would make it truly atomic. Build when onboarding failures appear in real data.

### App Feature Guide

On-signup slideshow/overlay showing screenshotted features. General UX, not permanent-specific. Build before promoting to experienced crew.

### Negotiation Timeout

Auto-revert selection after N days of no activity. Build when ghosted selections become a pattern in real data.

### Weekly Check-In Cron (Permanent)

Nudge employers with active permanent engagements that have no activity. Build when abandoned permanent engagements appear in real data.

---

## Done

(See git history for completed stages 51-139, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e, template name cap, messages test cleanup)
