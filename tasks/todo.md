# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Fix batch: Profile overlay, employer spinner, LOA conversion, pill transition

**Problem:** 4 issues — 2 user-reported bugs from device testing, 2 from planning agent code review.

1. **Profile unavailable on discover cards (user-reported):** Tapping "Posted by Hein" on a discover card opens ProfileOverlay which shows "Profile unavailable". Root cause: `GET /api/profile/[personId]` (`apps/web/src/app/api/profile/[personId]/route.ts` lines 28-36) requires a pre-existing relationship (engagement, application, or invitation) via `checkRelationshipContext()`. A crew member browsing discover has no relationship with the poster yet, so the API returns 403. The poster chose to publish a job with their name — their profile should be viewable.
2. **Employer infinite spinner on discover (user-reported):** Employer navigating to `/discover` sees a spinner forever. The middleware should redirect employers away from discover, but if client-side navigation bypasses it, `loadCrewCerts()` (`apps/web/src/app/(app)/discover/page.tsx` lines 169-174) does `window.location.href = '/daywork/mine'` — but the page already rendered with `loading = true` and if the redirect is slow or fails (Capacitor webview), the spinner stays with no fallback.
3. **LOA display bug (code review):** IMO lookup on add-experience and onboarding passes raw metres to display without converting to user's preferred units.
4. **Missing CSS transition (code review):** Department toggle buttons missing `transition-colors`.

**Files changed:** 1 API route, 1 page component, 2 experience form files, 1 shared component. No migrations.

**What will NOT be touched:** Database schema, RLS, event handling, middleware (client-side fix only for the redirect).

#### Checklist

- [x] **Fix: Profile viewable from discover — add "active poster" context** (`apps/web/src/app/api/profile/[personId]/route.ts`)
  - In `checkRelationshipContext()`, add a 5th check after the permanent application check (around line 133)
  - Check if the target person has any active daywork OR permanent posting: query `dayworks` with `poster_person_id = targetId, status = 'active'` (limit 1), then `permanent_postings` with `employer_person_id = targetId, status = 'active'` (limit 1)
  - If either returns a row, return `true` — the target is a public poster, anyone authenticated can view their profile
  - This is safe: the poster already published their name on public job cards. No new data is exposed.
  - Test: crew with no applications can view employer profile from discover card

- [x] **Fix: Employer discover redirect — early return before loading UI** (`apps/web/src/app/(app)/discover/page.tsx`)
  - The `loadCrewCerts()` function (line 141) fetches `/api/profile` then conditionally redirects at lines 169-174
  - Problem: the page renders `DayworkBrowse` with `loading={true}` while the async redirect is pending
  - Fix: move the hat check to run **before** any loading state renders. Options:
    - (a) Read `current_hat` from the Supabase client directly at the top of `loadCrewCerts()` (faster, no API wait), redirect immediately if employer
    - (b) Or: after the redirect call, add `return` and ensure loading stays true (acceptable — the redirect will complete). But also add a fallback: if still on the page after 3 seconds, set `loading = false` and show an error/redirect link
  - The middleware already handles this for full-page loads — this fix is for client-side navigation (e.g., back button, in-app link)
  - Do NOT remove the existing middleware redirect — both layers are needed

- [x] **Fix: LOA conversion after IMO lookup on add-experience** (`apps/web/src/app/(app)/profile/add-experience/page.tsx`)
  - When `ImoLookupSection` calls back with a vessel's `loa_meters`, convert to display units before setting state
  - Match the `handleLoaFromLookup` pattern from `apps/web/src/app/(app)/vessels/page.tsx` (lines ~225-232)

- [x] **Fix: LOA conversion after IMO lookup on onboarding** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Same fix as above — convert metres → display units in the `onVesselFound` callback
  - The `lengthUnit` is already available via `usePreferences()` in this file

- [x] **Fix: Add `transition-colors` to department toggle buttons** (`apps/web/src/components/department-role-pills.tsx`)
  - Add `transition-colors` class to the department header button className (around line 134)
  - Role pill buttons already have it — this makes the transition consistent

- [x] **Tests**
  - Profile view API: test that an authenticated user can view the profile of someone with an active posting (no prior relationship)
  - Profile view API: test that an authenticated user CANNOT view the profile of someone with NO active postings and no relationship (still 403)

**Done condition:** Crew can view poster profiles from discover cards. Employer hitting /discover via client-side nav is redirected cleanly (no stuck spinner). LOA displays in correct units after IMO lookup. Department toggles animate smoothly.

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Permanent crew withdrawal auto-revert — employer should decide

When crew withdraws after being selected for a permanent role, `apply_projection` automatically sets the posting back to `active`. The employer gets no notification, no prompt, no choice. Needs: migration, API route, UI banner, context API, tests. Full spec preserved in git history.

### Billing IAP bypass redesign

4-phase project: in-app billing page, email-to-web magic link, web purchase page, old flow cleanup. Full spec preserved in git history.

### Deactivated user server-side sign-out

Needs admin client to revoke auth session after deactivation. 403 guard already in place.

### OG social sharing image

Create 1200x630px branded image at `apps/web/public/images/brand/og-image.png`. Code already references it.

### Agent market as discover mode

Merge `/discover/market` into the main discover page as an agent-specific mode.

### Resilience Tests

Discover, Chat, Apply, Post form, Availability overlay error handling tests.

### Component Tests for Permanent UI

PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard.

### Component Tests for Form Pickers

LocationPicker, RolePicker, FlagStatePicker, AvailabilityOverlay, ProfileOverlay, ImageCropper.

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

Add RFC 2369 `List-Unsubscribe` header to all outgoing emails for better deliverability.

### Form validation — styled inline errors (SUG-012)

Replace browser-native validation with styled inline errors matching the design system.

### Invalid URL error pages (SUG-013)

Review page and vessel edit page should show "not found" instead of generic API error when given non-existent IDs.

### Edit experience "Unknown vessel" prefix (SUG-017 secondary)

After vessels RLS fix resolves the name lookup, verify the vessel_type prefix (M/Y vs S/Y) is correct. Currently defaults to M/Y.

---

## Done

(See git history for completed stages 51-152, UI-0 through UI-19, availability-model-overhaul, cron-trigger-fix, all fix batches, template name cap, messages test cleanup, pre-TestFlight native changes, workflow protocol, Playwright baseline, pre-TestFlight fix batch, rollback + test fixes, fix batch 153, SUG fixes 154, UI Consistency 1/3 + 2/3 + 3/3)
