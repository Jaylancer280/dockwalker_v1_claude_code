# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

TestFlight fix sweep — all items blocking or degrading the beta experience

---

## Queue

### 1. Quick wins batch — experience brackets production deploy (user action)

- [ ] Deploy migration 00076 to production Supabase

---

### 2. Capacitor static export architecture (BLOCKING — proper TF build)

**STATUS: BLOCKED — needs planning agent revision. See investigation notes below.**

The current Codemagic build loads the entire app remotely from Vercel. Correct architecture: static HTML locally, only API calls remote.

#### Implementation agent investigation (2026-03-28)

**Current state of the codebase after investigation:**

- `next.config.ts`: `output: 'export'` conditional on `CAPACITOR_BUILD=1`, plus `typescript.ignoreBuildErrors` for Capacitor builds
- `apps/web/scripts/capacitor-build.sh`: build script that backs up and removes API routes + auth callback before build, restores after
- 6 dynamic routes split into `_client.tsx` (original `'use client'` page) + `page.tsx` (server wrapper with `generateStaticParams`)
- `safeFetch` resolveUrl already committed and working

**Problem 1: API routes incompatible with `output: 'export'`**

- Next.js static export cannot include route handlers (API routes)
- All 50+ API routes under `src/app/api/` fail with "missing generateStaticParams"
- Also: `src/app/auth/callback/route.ts` (non-API route handler)
- **Solution implemented:** Build script (`capacitor-build.sh`) that:
  1. Backs up `src/app/api/` and `auth/callback/route.ts`
  2. Removes them (replaces with empty dir)
  3. Runs `CAPACITOR_BUILD=1 npx next build`
  4. Restores originals after build (or on failure)
- This successfully eliminates the API route errors

**Problem 2: Generated type validator references missing routes**

- After removing API routes, `.next/dev/types/validator.ts` and `routes.d.ts` reference the missing route modules
- TypeScript compilation fails with "Cannot find module '../../../src/app/api/profile/route.js'"
- **Solution implemented:** `typescript.ignoreBuildErrors: true` in next.config.ts (conditional on `CAPACITOR_BUILD`)
- This skips TS validation, getting past the type error

**Problem 3 (BLOCKER): `generateStaticParams` not recognized on dynamic routes**

- 6 dynamic page routes: `daywork/[id]/review`, `permanent/[id]/review`, `messages/[engagementId]`, `docky/[conversationId]`, `profile/edit-experience/[id]`, `vessels/[id]/edit`
- All are `'use client'` components — can't export `generateStaticParams` directly (server-only export)
- Split each into `_client.tsx` (original client component) + `page.tsx` (server wrapper)

**Approaches tried for Problem 3 (ALL FAILED):**

1. **Basic server wrapper** — `page.tsx` imports ClientPage, exports `generateStaticParams() { return [] }`, default exports wrapper rendering `<ClientPage />`. Result: "Page is missing generateStaticParams()" error. Tried sync and async versions.

2. **`export const dynamic = 'force-static'`** — Added alongside `generateStaticParams`. Result: Same error. One route passed but others failed randomly.

3. **Re-export pattern** — `export { default } from './_client'` with separate `generateStaticParams`. Result: Same error.

4. **`next/dynamic` with `ssr: false`** — `const ClientPage = dynamic(() => import('./_client'), { ssr: false })`. Result: "ssr: false is not allowed with next/dynamic in Server Components."

5. **`.js` extension** — Changed `page.tsx` to `page.js`. Result: Same error pattern.

6. **Single worker** — `NEXT_WORKER_COUNT=1`. Result: Same error.

7. **Skip Turbopack** — `NEXT_PRIVATE_SKIP_TURBOPACK=1`. Result: Same error.

8. **10 consecutive retries** — Built 10 times in a loop. Result: All 10 failed. Different route each time but always one of the 6 dynamic routes. NOT intermittent — consistently fails.

**Key observation:** The error appears for a DIFFERENT route each build run (random among the 6 dynamic routes), but at least one always fails. This suggests a non-deterministic worker issue in Next.js 16's page data collection phase, where the `generateStaticParams` export from server wrapper pages that import `'use client'` child components is intermittently not detected.

**Environment:** Next.js 16.1.6, Turbopack (default), Windows 11, Node 22

**Files changed during investigation (need cleanup or commit):**

- `apps/web/next.config.ts` — added conditional `typescript.ignoreBuildErrors` + removed invalid `eslint` key
- `apps/web/scripts/capacitor-build.sh` — new build script
- 6 `_client.tsx` files — copied from original `page.tsx`
- 6 `page.tsx` files — server wrappers with `generateStaticParams`
- `tasks/lessons.md` — added lesson about not deferring todo items

**Options for planning agent to evaluate:**

1. **Downgrade to Next.js 15** — static export may work better with webpack bundler
2. **Use `next-export-ssg` or similar plugin** that handles dynamic routes differently
3. **Pre-render all pages as static HTML** using a custom script that hits each route and saves HTML (not Next.js export)
4. **Keep remote-loading architecture** but add service worker for offline caching (ServiceWorker API + Cache Storage)
5. **Wait for Next.js fix** — this may be a Turbopack bug; file issue on vercel/next.js
6. **Use `pages/` router for Capacitor build** — create a parallel pages/ directory just for export (high effort)
7. **Investigate if `output: 'standalone'` + custom server** works for Capacitor (different architecture)
8. **Build with webpack explicitly** — Next.js 16 may have a flag or config to disable Turbopack for production builds

---

### 3. Permanent post form — remaining display + tests

**E. Display:**

- [ ] `permanent-job-card.tsx` — show contract type, meals, positions
- [ ] `permanent-job-detail.tsx` — show description, contract details
- [ ] Chat `PermanentSummaryCard` — show contract type

**F. Tests:**

- [ ] POST with new fields → 200, invalid contract_type → 400

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Permanent crew withdrawal auto-revert — employer should decide

Full spec preserved in git history.

### Billing IAP bypass redesign

4-phase project. Full spec preserved in git history.

### Deactivated user server-side sign-out

### OG social sharing image

### Agent market as discover mode

### Resilience Tests

### Component Tests for Permanent UI

### Component Tests for Form Pickers

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

### Form validation — styled inline errors (SUG-012)

### Invalid URL error pages (SUG-013)

### Edit experience "Unknown vessel" prefix (SUG-017 secondary)

### Applicant count badge on My Jobs posting cards

### Swipe card momentum — exit animation should use swipe velocity

### Notifications grouping — by date or engagement

### Discover filter chips — show active filters as dismissible pills above feed

### Haptics on toggles, filters, apply confirmation (not just swipe)

---

## Done

(See git history for completed stages 51-152, UI-0 through UI-19, all fix batches, pre-TestFlight fixes, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, profile overlay fix, employer spinner fix, LOA conversion fix, pill transition fix)
