# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

## Queue

### Stage 68: UX Quick Fixes

Six independent UI/API fixes. No migrations required.

**68a: Hat switch instant refresh (item #1)**

- [x] In `apps/web/src/components/hat-switcher.tsx`: after successful POST to `/api/hat`, call `window.location.reload()` instead of `router.refresh()`
- [x] Test manually: switch hat on profile → navbar and routing should reflect new hat immediately

**68b: Clear availability without location (item #2)**

- [x] In `apps/web/src/components/availability-overlay.tsx`: added explicit "Clear all availability" button visible when user has existing availability
- [x] Ensure the overlay shows a clear UX path: "Clear all availability" link above the not-available toggle, triggers isClearingAll state without needing date/city interaction
- [x] Test: open overlay with existing availability → tap "Clear all availability" → confirm clears without requiring city selection

**68c: Availability today is not past (item #6)**

- [x] In `apps/web/src/app/api/availability/route.ts`: replaced Date object comparison with UTC string comparison (lexicographic YYYY-MM-DD)
- [x] In `apps/web/src/components/availability-overlay.tsx`: 14-day grid now uses UTC dates (Date.UTC, getUTCDay, getUTCDate, setUTCDate) to match server
- [x] Month label shown in calendar header — single month or "Month A / Month B" if window spans two months
- [x] Test: setting availability for today should succeed regardless of timezone offset

**68d: Certifications shown as pills (item #7)**

- [x] In `apps/web/src/app/(app)/profile/page.tsx`: replaced count text with flex-wrap pill badges showing cert names
- [x] Loaded cert names via Supabase `.in()` query on profile load
- [x] Style: `rounded-full bg-muted px-2 py-0.5 text-xs`

**68e: Vessel size bands shown as bands (item #8)**

- [x] In `apps/web/src/app/(app)/profile/page.tsx`: replaced count text with flex-wrap pill badges showing size band labels
- [x] Loaded size band labels via Supabase `.in()` query on profile load
- [x] Style: same pill pattern as certifications

**68f: Shortlisted crew can withdraw (item #12)**

- [x] In `apps/web/src/app/api/daywork/[id]/withdraw/route.ts`: changed to `!['applied', 'viewed', 'shortlisted'].includes(status)`
- [x] In `apps/web/src/app/(app)/discover/page.tsx` (ApplicationCard): changed `canWithdraw` to include viewed and shortlisted
- [x] Added shortlisted warning in confirmation dialog
- [x] Test: shortlisted status → 200 success, viewed status → 200 success
- [x] Test: accepted/rejected/completed statuses still return 400

**68g: Verification**

- [x] Run full test suite — 487 tests pass (4 new)
- [x] Run `tsc --noEmit` — zero errors
- [x] Run ESLint — zero warnings/errors

---

### Stage 69: Vessel Soft Data Separation + Templates Cleanup

Items #10 and #13. Migration required.

**Design rationale:** Vessel entities should store only immutable physical facts (IMO, name, LOA, vessel_type motor/sail). Soft data like `vessel_operation` (charter/private) and `flag_state` evolve over time and are recorded per-experience, not per-vessel. Multiple crew members listing the same vessel may record different operations for different time periods. Templates store job details only — vessel selection is per-posting.

**69a: Migration 00034 — remove vessel_operation from vessels**

- [x] Migration 00034: DROP vessel_operation from vessels, DROP vessel_id from templates, update apply_projection + get_vessel_public
- [x] Rollback 00034: restores both columns + functions

**69b: Update types**

- [x] Removed vessel_operation from VESSEL.CREATED and VESSEL.UPDATED event payloads

**69c: Update vessel API routes**

- [x] POST /api/vessels: removed vessel_operation from validation and payload
- [x] PATCH /api/vessels/[id]: removed vessel_operation from payload
- [x] GET /api/vessels + lookup: removed vessel_operation from select

**69d: Update vessel forms**

- [x] add-experience page: removed vessel-level operation dropdown, kept experience-level
- [x] onboarding page: removed vessel-level operation from interface, default, lookup autofill, submit payload, and UI dropdown
- [x] Daywork posting: vessel_operation was never on the dayworks table — no change needed
- [x] Experiences route: removed vessel_operation from vessel join select

**69e: Update templates**

- [x] Template POST: removed vessel_id from insert
- [x] Template GET (list + single): removed vessel_id and vessel join from select

**69f: Update all tests**

- [x] Vessel creation tests: removed vessel_operation from validBody and removed invalid operation test
- [x] Vessel PATCH tests: removed invalid operation test
- [x] Integration tests: removed vessel_operation from VESSEL.CREATED payload
- [x] Experiences tests: removed vessel_operation from vessel join mock
- [x] Onboarding/template/form-dropdown tests: no changes needed

**69g: Verification**

- [x] 485 tests pass (2 removed: vessel operation validation tests)
- [x] TSC clean — zero errors

---

### Stage 70: Experience Edit + IMO Auto-Populate

Items #3 and #9. No migration — uses existing PATCH /api/experiences/[id].

**70a: Edit experience page**

- [x] Created `apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx`
- [x] On mount: fetches all experiences from GET /api/experiences, finds by ID, pre-populates all fields
- [x] On submit: PATCH /api/experiences/[id] with updated fields, inline error display
- [x] Same form layout as add-experience (vessel info read-only header, all experience fields editable)

**70b: Profile page edit button**

- [x] Pencil "Edit" button alongside existing "Remove" on each experience card
- [x] Navigates to `/profile/edit-experience/[id]`

**70c: IMO auto-populate UX improvement**

- [x] Found vessel shown as green card/banner with "M/Y Name — 45m — IMO 1234567" and "Enter manually" dismissal button
- [x] Manual entry mode shows all vessel fields; card mode hides them (vessel data is immutable)
- [x] Experience-specific fields (operation, flag_state, etc.) always editable

**70d: Tests**

- [x] PATCH /api/experiences/[id] tests already cover the edit flow (16 experience tests)
- [x] No component test for add-experience exists — skipping per plan

**70e: Verification**

- [x] 485 tests pass, TSC clean

---

### Stage 71: Contract Type Structured Inputs

Item #11. Possible migration for canonical rotation patterns lookup table, or client-side canonical lists.

**71a-c: Contract type structured inputs**

- [x] Rotational: quick-select pills (2:2, 3:3, 3:1, 4:2, 5:1, 6:2, 10:10) + two number inputs (on:off) + weeks/months dropdown
- [x] Permanent: "Days leave per year" number input, serialized as "X days leave/year"
- [x] Seasonal: free text for season period (unchanged)
- [x] Crossing/delivery/temporary: contract_details hidden
- [x] Applied to both add-experience and edit-experience pages
- [x] Existing free-text contract_details parsed via regex — unmatched patterns fall through gracefully

**71d: Verification**

- [x] 485 tests pass, TSC clean

---

### Stage 72: Job Detail Vessel Visibility

Item #4. No migration — purely UI changes.

**72a-d: Vessel visibility across all card types**

- [x] Discover swipeable cards: M/Y or S/Y prefix before vessel name
- [x] Application cards: M/Y or S/Y prefix before vessel name
- [x] Invitation cards: M/Y or S/Y prefix before vessel name
- [x] Daywork summary card (chat): M/Y/S/Y prefix + size band label + LOA
- [x] Context API extended: vessels select includes vessel_type, loa_meters, vessel_size_bands(label)
- [x] Types updated for extended vessel data in chat context

**72e: Verification**

- [x] 485 tests pass, TSC clean

---

### Stage 73: Working Days Calendar Selection

Item #14. No migration — `working_days` column becomes a JSONB array of date strings OR remains an int with a new `working_day_dates` column. Design decision needed.

**73a-c: Working day dates — migration + API**

- [x] Option B implemented: `working_day_dates date[]` nullable column added to dayworks and templates (migration 00035)
- [x] Post-projection trigger `apply_working_day_dates` writes dates from event payload
- [x] API accepts optional `workingDayDates` array, validates dates within range and no duplicates
- [x] When provided, `working_days` derived from array length; backward compat preserved
- [x] Event payload extended with optional `working_day_dates`

**73d: Display**

- [x] Calendar UI for post-daywork form deferred to UI pass (data layer complete)

**73e: Verification**

- [x] 3 new tests: accepts dates + derives count, rejects out-of-range, rejects duplicates
- [x] 488 tests pass, TSC clean

---

### Stage 74: Job Expiry + Stale Engagement Cleanup

Item #5. Design confirmed by user.

**74a: Active jobs past end_date — extend route**

- [x] Mine API: added computed `is_overdue` field (active postings past end_date)
- [x] New `POST /api/daywork/:id/extend` route with ownership/status/date validation
- [x] `DAYWORK.EXTENDED` event type + migration 00036 trigger handler
- [x] UI banners for mine page deferred to UI pass (data layer complete)

**74b: Conversations API — overdue + rating timeout**

- [x] Conversations API: `is_overdue` computed (active engagement, end_date + 3 days < today)
- [x] Conversations API: `rating_expires_at` and `rating_expired` computed (14 days after completion)
- [x] `updated_at` added to engagement select for completion timestamp
- [x] Chat UI banners deferred to UI pass (data layer complete)

**74c-d: Query-time enforcement**

- [x] All expiry checks at query time — no background jobs, no DB state changes
- [x] Mine API: is_overdue is additive UI hint
- [x] Conversations API: rating timeout computed from updated_at

**74e: Tests**

- [x] 5 extend route tests (401, 403 crew, 400 not active, 400 past date, 200 success)
- [x] Mine test updated for is_overdue field
- [x] 493 tests pass, TSC clean

---

### Documentation Tasks (implementation agent — during Close of final stage)

- [x] Update `BUILD_STATE.md`: stages 68-74, schema v36, migration table entries for 00034-00036
- [x] Update `apps/web/README.md`: new API routes (extend)
- [x] Update `supabase/README.md`: new migrations 00034-00036
- [x] Update `packages/types/README.md`: changed types (vessel_operation removed, DAYWORK.EXTENDED added)

## Done

(See git history for completed stages 51-67)
