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

### 2. UX hardening — remaining items (E, F, G deferred)

**E. Profile section completeness hints (NOT gamification):**

- [ ] In collapsible sections, show inline "2 fields not set" in collapsed header when fields are empty
- [ ] Remove the "Complete your profile" banner on discover once section hints exist

**F. Onboarding progress indicator:**

- [ ] `onboarding/page.tsx` — add step dots or "Step 2 of 5" text

**G. Unread message indicators:**

- [ ] `messages/page.tsx` — add blue dot or bold text for unread conversations
- [ ] Wire `get_unread_counts` RPC (migration 00058) into the messages list UI

---

### 3. Capacitor static export architecture (BLOCKING — proper TF build)

The current Codemagic build loads the entire app remotely from Vercel. Correct architecture: static HTML locally, only API calls remote.

**A. Add `generateStaticParams` to all dynamic page routes:**

- [ ] `daywork/[id]/review/page.tsx`, `permanent/[id]/review/page.tsx`, `messages/[engagementId]/page.tsx`, `docky/[conversationId]/page.tsx`, `vessels/[id]/edit/page.tsx`, `profile/edit-experience/[id]/page.tsx`
- [ ] Check for any other dynamic routes

**B. Commit the safeFetch resolveUrl change:**

- [ ] Already implemented but uncommitted. Verify it works.

**C. Rewrite codemagic.yaml:**

- [ ] Remove custom `capacitor.config.ts` step
- [ ] Build: `CAPACITOR_BUILD=1 NEXT_PUBLIC_API_BASE_URL=https://dockwalker.io npm run build`
- [ ] `npx cap sync ios` AFTER build
- [ ] Remove `mkdir -p public`

**D. Verify capacitor.config.ts:**

- [ ] `webDir: 'out'`, no `server.url` in production, `allowNavigation` correct

**E. Verify build:**

- [ ] Static export builds, `out/` created, dynamic routes have fallback HTML, `cap sync` works

**Done condition:** Static `out/`, local pages, remote API calls only.

---

### 4. Permanent post form — add missing fields

Permanent posting should be richer than daywork, not thinner.

**A. Migration:**

- [ ] `contract_type text` — CHECK: `('permanent', 'rotational', 'seasonal', 'crossing', 'delivery', 'temporary')`
- [ ] `contract_details text`, `description text`, `meals text[]`
- [ ] `positions_available int NOT NULL DEFAULT 1` CHECK `(1..20)`, `positions_filled int NOT NULL DEFAULT 0`
- [ ] Same columns (minus positions_filled) to `permanent_templates`
- [ ] Update `apply_projection` PERMANENT.POSTED handler
- [ ] Self-contained rollback

**B. TypeScript types:**

- [ ] `PermanentPosting`, `PermanentTemplate` interfaces, `PERMANENT.POSTED` payload

**C. API routes:**

- [ ] POST, GET discover, GET mine, template CRUD — all accept new fields

**D. Permanent post form:**

- [ ] Wire `ContractDetailsInput`, meals, positions, description, confirmation overlay

**E. Display:**

- [ ] `permanent-job-card.tsx`, `permanent-job-detail.tsx`, chat `PermanentSummaryCard`

**F. Tests:**

- [ ] POST with new fields → 200, invalid contract_type → 400, integration projection

**Done condition:** Permanent form collects all fields. All display on cards and detail view. Templates save/load.

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
