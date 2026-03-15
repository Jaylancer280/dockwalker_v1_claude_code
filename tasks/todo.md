# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

## Queue

### Stage 68: UX Quick Fixes

Six independent UI/API fixes. No migrations required.

**68a: Hat switch instant refresh (item #1)**

- [ ] In `apps/web/src/components/hat-switcher.tsx`: after successful POST to `/api/hat`, call `window.location.reload()` instead of `router.refresh()` — `router.refresh()` only re-renders the current page's server components but does NOT update layout-level state (bottom navbar icons, routing guards). A full page reload forces the layout to re-read the hat from the server. Alternatively, if a lighter approach is preferred: emit a custom event `dw:hat-changed` and have the layout/navbar listen for it to re-fetch the user's hat — but full reload is simpler and hat switches are infrequent
- [ ] Test manually: switch hat on profile → navbar and routing should reflect new hat immediately

**68b: Clear availability without location (item #2)**

- [ ] In `apps/web/src/components/availability-overlay.tsx`: verify the confirm button disabled logic. Current code: `isValid = isClearingAll || (locationValue?.cityId && ...)`. The `isClearingAll` flag should short-circuit the city requirement. If the bug is that users can't easily reach the "clear" state (must manually deselect all dates), add an explicit "Clear availability" button/action that doesn't require interacting with the date grid or city picker at all — a direct path to the DELETE `{ clearAll: true }` call
- [ ] Ensure the overlay shows a clear UX path: if user has existing availability, show a prominent "Clear availability" link/button separate from the date grid, so they don't need to deselect dates one-by-one and don't need to set a location
- [ ] Test: open overlay with existing availability → tap "Clear availability" → should clear without requiring city selection

**68c: Availability today is not past (item #6)**

- [ ] In `apps/web/src/app/api/availability/route.ts`: the `startDay < today` check uses `new Date()` which on the server (Vercel/UTC) may be a different calendar day than the client's local time. Investigate: if a crew member in UTC+2 sets availability for "today" (March 15 in their timezone) but the server in UTC still has March 14 at 23:00, the server's `today` would be March 14, so `startDay (March 15) < today (March 14)` passes. The reverse issue: if the client is in UTC-5 and it's still March 14 evening, but the server (UTC) already has March 15 — the client sends "March 14" which the server sees as `< today (March 15)` → rejected
- [ ] Fix: use the date string comparison directly (lexicographic `YYYY-MM-DD`) instead of `Date` object comparison to avoid timezone issues. Compute `todayStr` as `new Date().toISOString().slice(0, 10)` (UTC date) and compare strings. Or better: accept today's date from the client as a reference and validate within ±1 day tolerance. Simplest fix: compute today in UTC consistently on both client and server
- [ ] In `apps/web/src/components/availability-overlay.tsx`: ensure the 14-day grid starts from today in UTC (not local time) to match the server
- [ ] **Month label must be shown** in the availability calendar header (e.g., "March 2026") — if the 14-day window spans two months, show both month headers
- [ ] Test: setting availability for today should succeed regardless of timezone offset

**68d: Certifications shown as pills (item #7)**

- [ ] In `apps/web/src/app/(app)/profile/page.tsx`: replace the "X certification(s)" count text (view mode, ~lines 451-458) with a flex-wrap row of pill badges showing each certification's actual name
- [ ] Load certification names by joining `certification_ids` against the `certifications` lookup table (already fetched for edit mode — reuse the same `certs` array)
- [ ] Style: small rounded pills (`px-2 py-0.5 text-xs rounded-full bg-muted`) with cert name text

**68e: Vessel size bands shown as bands (item #8)**

- [ ] In `apps/web/src/app/(app)/profile/page.tsx`: replace the "X size band(s)" count text (view mode, ~lines 459-466) with a flex-wrap row of pill badges showing each size band's label (e.g., "24m - 35m")
- [ ] Load size band labels from the `vessel_size_bands` lookup (already fetched for edit mode — reuse the same `sizeBands` array). Convert labels using user's preferred unit (m/ft) via `usePreferences`
- [ ] Style: same pill pattern as certifications

**68f: Shortlisted crew can withdraw (item #12)**

- [ ] In `apps/web/src/app/api/daywork/[id]/withdraw/route.ts`: change the status check from `status !== 'applied'` to `!['applied', 'viewed', 'shortlisted'].includes(status)` — the SQL projection already supports withdrawal from these statuses
- [ ] In `apps/web/src/app/(app)/discover/page.tsx` (ApplicationCard): change `canWithdraw` from `status === 'applied'` to `['applied', 'viewed', 'shortlisted'].includes(status)` so the Withdraw button appears for shortlisted applications too
- [ ] Add a confirmation dialog for shortlisted withdrawals: "You've been shortlisted for this position. Are you sure you want to withdraw?"
- [ ] Test: add test case in withdraw tests for shortlisted status → 200 success
- [ ] Test: verify accepted/rejected/completed statuses still return 400

**68g: Verification**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Run ESLint — zero warnings/errors

---

### Stage 69: Vessel Soft Data Separation + Templates Cleanup

Items #10 and #13. Migration required.

**Design rationale:** Vessel entities should store only immutable physical facts (IMO, name, LOA, vessel_type motor/sail). Soft data like `vessel_operation` (charter/private) and `flag_state` evolve over time and are recorded per-experience, not per-vessel. Multiple crew members listing the same vessel may record different operations for different time periods. Templates store job details only — vessel selection is per-posting.

**69a: Migration 00034 — remove vessel_operation from vessels**

- [ ] Create `supabase/migrations/00034_vessel_soft_data_separation.sql`:
  - DROP `vessel_operation` column from `vessels` table
  - Update `apply_projection` `VESSEL.CREATED` handler: remove `vessel_operation` from INSERT
  - Update `apply_projection` `VESSEL.UPDATED` handler: remove `vessel_operation` from UPDATE
  - Update `get_vessel_public` RPC: remove `vessel_operation` from returned fields
  - DROP `vessel_id` column from `daywork_templates` table
- [ ] Create `supabase/rollbacks/00034_vessel_soft_data_separation.down.sql`:
  - ADD `vessel_operation` column back to `vessels` (varchar, default 'private')
  - ADD `vessel_id` column back to `daywork_templates` (uuid FK to vessels)
  - Restore previous `apply_projection` and `get_vessel_public`

**69b: Update types**

- [ ] In `packages/types/`: remove `vessel_operation` from `Vessel` interface; remove `vessel_id` from `DayworkTemplate` interface (if exists)
- [ ] In `VESSEL.CREATED` and `VESSEL.UPDATED` event payloads: remove `vessel_operation`

**69c: Update vessel API routes**

- [ ] In `POST /api/vessels`: remove `vessel_operation` from request validation and event payload. Vessel creation now accepts: `imoNumber`, `name`, `vesselType` (motor/sail), `loaMeters`, `ndaFlag`
- [ ] In `PATCH /api/vessels/[id]`: remove `vessel_operation` from update payload
- [ ] In `GET /api/vessels`: remove `vessel_operation` from response (or let DB handle — column won't exist)

**69d: Update vessel forms**

- [ ] In `apps/web/src/app/(app)/profile/add-experience/page.tsx`: when creating a new vessel via IMO not-found, remove the vessel-level "Operation" dropdown (charter/private). The experience-level `expVesselOperation` field already captures this. Remove the confusing duplication — the form label should read "Vessel operation during your time" (not "Vessel operation")
- [ ] In onboarding vessel creation: same change — remove vessel-level operation, keep experience-level only
- [ ] In `apps/web/src/components/vessels/vessel-selector.tsx` (employer vessel management): if this shows vessel_operation, remove it
- [ ] **Keep `vessel_operation` on daywork postings:** The daywork table should retain its own `vessel_operation` field for information density — employers set it per-posting. This is NOT inherited from the vessel entity. If `vessel_operation` is currently read from the vessel join at posting time, change it to a standalone field on the daywork form (charter/private dropdown). This is informational, not a vessel fact

**69e: Update templates**

- [ ] In template POST/PUT API routes: remove `vessel_id` / `vesselId` from accepted fields
- [ ] In template GET API: remove vessel join from select
- [ ] In post-daywork form: when loading a template, do not pre-fill vessel — vessel selector starts empty
- [ ] In save-template flow: do not include current vesselId in saved template data

**69f: Update all tests**

- [ ] Update vessel creation tests to not send `vessel_operation`
- [ ] Update vessel PATCH tests
- [ ] Update template tests if they reference vessel_id
- [ ] Update onboarding tests if they send vessel_operation on vessel creation
- [ ] Update form-dropdowns component test if it mocks vessel_operation

**69g: Verification**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors

---

### Stage 70: Experience Edit + IMO Auto-Populate

Items #3 and #9. No migration — uses existing PATCH /api/experiences/[id].

**70a: Edit experience page**

- [ ] Create `apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx` (or reuse add-experience with an `?edit=ID` query param — pick whichever is cleaner)
- [ ] On mount: `GET /api/experiences` and find the entry by ID, pre-populate all form fields (vessel name from lookup, role, dates, vessel_operation, flag_state, contract_type, contract_details, description, isCurrent)
- [ ] On submit: `PATCH /api/experiences/[id]` with updated fields
- [ ] Reuse the same form layout as add-experience (DRY — extract a shared `ExperienceForm` component if the duplication is significant)

**70b: Profile page edit button**

- [ ] In `apps/web/src/app/(app)/profile/page.tsx`: add an "Edit" button (pencil icon) on each experience card alongside the existing "Remove" button
- [ ] Edit button navigates to `/profile/edit-experience/[id]`

**70c: IMO auto-populate UX improvement**

- [ ] In the vessel section of the experience form (both add and edit): when IMO lookup returns a found vessel, display it as a selectable card/banner: "M/Y Sunrise — 45m — Motor" with a "Use this vessel" button that auto-fills vessel name, LOA, vessel_type
- [ ] If the user dismisses the suggestion, they can enter vessel details manually (new vessel with same IMO for their account)
- [ ] Make it clear that selecting an existing vessel reuses the vessel record (the form fields become read-only for immutable data: name, LOA, vessel_type) but the experience-specific fields (operation, flag_state, etc.) remain editable

**70d: Tests**

- [ ] Test PATCH /api/experiences/[id] already exists — verify it covers the edit flow
- [ ] Add component test for edit-experience page if the project has component tests for add-experience

**70e: Verification**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors

---

### Stage 71: Contract Type Structured Inputs

Item #11. Possible migration for canonical rotation patterns lookup table, or client-side canonical lists.

**71a: Design the canonical lists**

- [ ] Rotation patterns for `rotational` contract type: canonical options like `2:2`, `3:3`, `3:1`, `4:2`, `5:1`, `6:2`, `2:1`, `10:10`, `other` (free text) — each with a "weeks" or "months" unit selector
- [ ] Display format: "X on : Y off" with unit, stored as structured string in `contract_details` (e.g., "2:2 months", "3:1 weeks")
- [ ] For `permanent` contract type: "Days leave per year" — positive integer free text input (e.g., 28, 30, 45)
- [ ] For `seasonal`: free text for season description (e.g., "March — October") — keep as-is
- [ ] For `crossing`, `delivery`, `temporary`: no additional details needed — hide contract_details

**71b: UI components**

- [ ] In the experience form (add + edit): when `contractType` changes, show/hide the appropriate sub-fields:
  - `rotational` → show ratio picker (two number inputs "X on : Y off") + unit dropdown (weeks/months)
  - `permanent` → show "Days leave per year" number input
  - `seasonal` → show free text "Season period" input (existing behavior)
  - `crossing` / `delivery` / `temporary` → hide contract_details entirely
- [ ] Rotation ratio picker: two small number inputs side-by-side with ":" separator, plus "weeks"/"months" dropdown. Pre-fill with common patterns as quick-select buttons (2:2, 3:3, 3:1, 5:1) that populate the inputs

**71c: Data storage**

- [ ] `contract_details` remains a text field (max 100 chars) — no migration needed
- [ ] Serialize rotation as `"X:Y weeks"` or `"X:Y months"` (e.g., "2:2 months")
- [ ] Serialize permanent leave as `"X days leave/year"` (e.g., "28 days leave/year")
- [ ] Parse existing free-text `contract_details` gracefully on edit — if it doesn't match the pattern, show in free-text fallback mode

**71d: Verification**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors

---

### Stage 72: Job Detail Vessel Visibility

Item #4. No migration — purely UI changes.

**72a: Discover page job cards**

- [ ] Ensure vessel name is prominent on every card (already shown — verify it's not easy to miss)
- [ ] For non-NDA vessels: after acceptance (crew has engagement), show IMO on the card if `imo_number` is returned by `get_vessel_public`
- [ ] Add vessel type prefix (M/Y or S/Y) before vessel name on discover cards, consistent with profile display

**72b: Message thread daywork-summary-card**

- [ ] In `daywork-summary-card.tsx`: add vessel type prefix (M/Y or S/Y), size band, and vessel LOA to the summary
- [ ] After acceptance (crew is in an engagement), if the vessel is NDA and `imo_number` is revealed via `get_vessel_public`, show `IMO: XXXXXXX` in the summary card. The context API already returns vessel data — verify it includes `imo_number` for engaged crew

**72c: Invitation cards on discover page**

- [ ] Verify invitation cards show vessel name prominently with M/Y/S/Y prefix
- [ ] Add size band to invitation cards if not already present

**72d: Application cards on discover page**

- [ ] Verify application cards show vessel name with prefix and size band

**72e: Verification**

- [ ] Visual review: vessel info is immediately visible (not hidden behind a tap) across all job display contexts
- [ ] Run `tsc --noEmit` — zero errors

---

### Stage 73: Working Days Calendar Selection

Item #14. No migration — `working_days` column becomes a JSONB array of date strings OR remains an int with a new `working_day_dates` column. Design decision needed.

**73a: Design decision — data model**

- [ ] Option A: Add `working_day_dates date[]` column to `dayworks` — stores the specific selected dates. `working_days` (int) becomes derived as `array_length(working_day_dates, 1)`. Migration required
- [ ] Option B: Keep `working_days` as int only, add `working_day_dates` as optional. If dates provided, `working_days = length(dates)`. If not provided (backward compat), `working_days` is the manual number
- [ ] **Recommended: Option B** — backward compatible, existing postings keep working, new postings get specific dates
- [ ] Migration 00035: add `working_day_dates date[]` column to `dayworks` and `daywork_templates`, update `apply_projection` DAYWORK.POSTED handler

**73b: Post-daywork form calendar UI**

- [ ] Replace the working days number input with a visual calendar grid
- [ ] Calendar shows only dates within the selected start_date — end_date range
- [ ] All dates in range are selectable — employer picks any subset as working days (start/end dates are NOT auto-included, employer chooses freely)
- [ ] Dates outside the range are disabled/not shown
- [ ] Selected dates highlighted (e.g., solid primary color). Unselected dates within range shown as available but muted
- [ ] Show count: "X of Y days selected" below the calendar
- [ ] **Month label must be shown** in the calendar header (e.g., "March 2026") — if the range spans two months, show both month headers
- [ ] Calendar only appears after start_date and end_date are both set
- [ ] If start/end date changes, reset the selected working days that fall outside the new range

**73c: API validation**

- [ ] In `POST /api/daywork`: accept optional `workingDayDates` array of `YYYY-MM-DD` strings
- [ ] Validate: all dates must be within [start_date, end_date] range inclusive
- [ ] Validate: no duplicates
- [ ] If `workingDayDates` provided: derive `working_days = workingDayDates.length`; store both
- [ ] If not provided: use `workingDays` int as before (backward compat)
- [ ] `DAYWORK.POSTED` event payload extended with optional `working_day_dates`

**73d: Display**

- [ ] On discover cards and summary cards: if `working_day_dates` is populated, show the specific dates (or at minimum show "X days" with tooltip/expandable showing which days). If only `working_days` int, show "X days" as before
- [ ] On templates: save `working_day_dates` if available, but dates are relative to a date range that changes per posting — consider only saving `working_days` count on templates, not specific dates

**73e: Verification**

- [ ] Tests for new API validation (dates within range, no duplicates, backward compat)
- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors

---

### Stage 74: Job Expiry + Stale Engagement Cleanup

Item #5. Design confirmed by user.

**74a: Active jobs past end_date — prompt to extend or close**

- [ ] In mine page API (`GET /api/daywork/mine`): add computed `is_overdue: boolean` field — true when `status === 'active' && end_date < today`
- [ ] In mine page UI (Active tab): overdue postings show a warning banner: "This job ended on {end_date}. Extend or close?"
- [ ] "Extend" button opens a date-extension overlay: new end_date picker (must be >= today), optionally update working days/calendar. Submits to new `POST /api/daywork/:id/extend`
- [ ] "Close" button cancels the posting (calls existing cancel endpoint)
- [ ] New `POST /api/daywork/:id/extend` route: validates employer ownership, `active` status, new end_date >= today; appends `DAYWORK.EXTENDED` event with `{ end_date, working_days?, working_day_dates? }`
- [ ] New event type `DAYWORK.EXTENDED` in types + `apply_projection`: updates `end_date` (and optionally `working_days`/`working_day_dates`) on the daywork row
- [ ] Migration 00036: add `DAYWORK.EXTENDED` handler to `apply_projection`

**74b: In-progress engagements past end_date — 3 day grace then prompt**

- [ ] In conversations API: add computed `is_overdue: boolean` — true when engagement `status === 'active'` and daywork `end_date + 3 days < today`
- [ ] In chat page: overdue engagement shows a banner for employer: "This engagement ended {X} days ago. Mark complete or extend dates?"
- [ ] Crew sees: "This engagement has ended. Waiting for employer to mark complete."
- [ ] Reuse the extend flow from 74a for the "Extend dates" option

**74c: Rating timeout — 14 days after completion**

- [ ] In conversations API: add computed `rating_expires_at: ISO8601` — `completed_at + 14 days` for completed engagements
- [ ] When `rating_expires_at < now()`: rating window is closed. Thread auto-moves to History tab regardless of rating status
- [ ] Chat page: if rating window expired and user hasn't rated, show "Rating period has ended" instead of rating prompt
- [ ] No event needed — this is query-time logic only. Existing `has_rated` flag still works; we just add the time gate

**74d: Query-time enforcement (no background jobs)**

- [ ] All expiry checks run at API query time — computed fields on responses, not DB state changes
- [ ] Discovery API: already excludes `active` jobs past start_date from crew browse (verify)
- [ ] Mine API: overdue flag is additive (UI prompt only, does not change DB status)
- [ ] Conversations API: rating timeout computed from `completed_at` timestamp on engagement

**74e: Tests**

- [ ] Test extend route: 200 success, 400 if end_date in past, 403 if not owner, 400 if not active
- [ ] Test mine API: `is_overdue` true when end_date < today
- [ ] Test conversations API: `rating_expires_at` computed correctly, expired threads flagged
- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors

---

### Documentation Tasks (implementation agent — during Close of final stage)

- [ ] Update `BUILD_STATE.md`: new stages, schema version, migration table
- [ ] Update `apps/web/README.md`: new/changed API routes
- [ ] Update `supabase/README.md`: new migrations
- [ ] Update `packages/types/README.md`: changed types

## Done

(See git history for completed stages 51-67)
