# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 144: User testing fixes (batch 2 — UX polish)

---

## Queue

---

### Stage 144: User testing fixes (batch 2 — UX polish)

#### 144a — Career status takes too much space on profile

Currently a full card with header, checkbox, conditional radio buttons, and number input. For most crew it's a simple toggle.

- [x] Collapse career status into the crew info section rather than a standalone card
- [x] When "not looking" / toggled off: show single line "Not open to permanent roles" with edit pencil
- [x] When toggled on: show compact summary "Available immediately" or "After X days notice" with edit pencil
- [x] Editing opens inline or small expandable — not a full card taking permanent vertical space

#### 144b — "Find daywork" button copy and size

Currently `w-full` with "Find daywork" text. Too prominent and doesn't cover permanent.

- [x] Change copy to "Browse jobs" (covers both daywork and permanent)
- [x] Reduce width: remove `w-full`, use `w-fit` or auto-width
- [x] Keep the Compass icon

#### 144c — Sign out should redirect to splash page

Currently `router.push('/auth/login')` after `supabase.auth.signOut()`.

- [x] Change redirect to `router.push('/')` — the landing/splash page
- [x] Verify middleware doesn't intercept unauthenticated `/` and redirect back to `/auth/login`

#### 144d — Splash page copy update

Current copy is daywork-only: "Superyacht daywork, simplified". Doesn't mention permanent hiring, Docky, invitations, or checklists.

- [x] Update hero headline to "Superyacht hiring, simplified"
- [x] Update subheading to mention both daywork and permanent
- [x] Update value prop cards (daywork cover, permanent pipeline, smart features)
- [x] Update how-it-works steps to be mode-neutral
- [x] Update footer tagline

#### 144e — IMO fuzzy search auto-trigger at 4 digits

Currently requires exactly 7 digits + explicit button click. User wants auto-search after 4+ digits for better UX.

- [x] Modify `/api/vessels/lookup` to accept 4-7 digit input with prefix search, return up to 5 results
- [x] In add-experience page: debounced auto-search at 4+ digits with selectable dropdown
- [x] Search button enabled at 4+ digits
- [x] Edit-experience page: no IMO lookup needed (vessel pre-filled)
- [x] 5 new vessel lookup tests for partial match behavior (819 total)

#### 144f — Crew hat needs "My Vessels" button on profile

Currently the Ship icon button on the profile header is gated behind `!isCrewHat` (line 415 of profile/page.tsx). Crew create vessels for experience entries but can't navigate to view them.

- [x] Remove the `!isCrewHat` gate on the vessels button — show it for all hats
- [x] The vessels API (`GET /api/vessels`) already returns vessels filtered by `owner_person_id` regardless of hat — no backend change needed
- [x] The vessels page already works for any authenticated user — no page change needed

#### 144g — Vessel size display: bands on profile, exact LOA on cards

User wants: profile page shows auto-derived size band exposure (non-editable summary). Cards and detail views show exact LOA everywhere.

Current state: discover cards show size band only, not LOA. Profile experience cards show LOA. Vessels page shows LOA with band fallback.

- [x] **Discover daywork cards:** add LOA display alongside vessel name — added `loa_meters` to discover API + card interface, shows "· 65m" when available, falls back to size band
- [x] **Discover permanent cards:** same — shows LOA from `vessel_loa`, falls back to size band
- [x] **Application cards (crew Applied tab):** added `vessel_loa` to applications API response + card display
- [x] **Review applicant cards:** if vessel context is available, show LOA — SKIPPED: review cards show crew profile, not vessel context
- [x] **Profile page — vessel size exposure section:** confirmed non-editable in view mode, auto-derived from experiences
- [x] **Vessels page:** already shows name + LOA/band + NDA badge — sufficient detail

#### 144h — Experience private intelligence fields (salary + verified sea time)

A new "Private intelligence" section on the experience form for optional data that enhances Docky's career advice accuracy but is never shown to other users. Two fields: salary and verified sea time.

**Salary** — schema already supports `salary_amount`, `salary_currency`, `salary_period` on `crew_experiences` (migration 00028). API POST/PATCH routes already accept and store. GET strips them. Only UI is missing.

**Verified sea time** — no schema support yet. Needs migration. Engineering Officer routes require sea time in **days**, Deck Officer routes require sea time in **nautical miles**. Both can apply to a single experience (e.g., a dual-role crew member), so both fields should be available simultaneously.

##### Schema + API (sea time)

- [x] Migration 00063: add `sea_time_days INTEGER` (nullable) and `sea_time_nautical_miles INTEGER` (nullable) to `crew_experiences` + supplementary trigger
- [x] Rollback 00063: drop trigger + both columns
- [x] Update projection: supplementary trigger `apply_sea_time_from_event` patches values after apply_projection
- [x] Update POST `/api/experiences` to accept optional `seaTimeDays` and `seaTimeNauticalMiles`
- [x] Update PATCH `/api/experiences/[id]` to accept same
- [x] GET `/api/experiences` confirmed NOT returning sea time fields
- [x] Update `EventPayloadMap` in `packages/types/src/events.ts`
- [x] Onboarding POST passes through to experiences route — inherits sea time support automatically

##### UI (both fields in shared section)

- [x] In add-experience page: add a visually separated section after existing fields with header: **"Private intelligence (optional)"**
- [x] Add section copy: "This data is never shown to anyone. It enhances Docky's career advice accuracy for you."
- [x] **Salary sub-section:** amount input + period toggle + currency selector
- [x] **Verified sea time sub-section:** days at sea + nautical miles, both visible simultaneously
- [x] Wire all fields into submit payload
- [x] Same section on edit-experience page with helper text about stored data
- [x] No display anywhere — GET strips salary + sea time; no UI reads them

#### 144i — Total experience pill calculation bug

The badge uses day-count division (`totalDays / 30` for months, `totalDays / 365` for years) which produces inaccurate results for real date ranges. Example: a Feb 1 – Apr 30 experience is 89 days → shows "2m" instead of "3m".

- [x] Replace the day-count arithmetic with calendar month diffing: `(endYear - startYear) * 12 + (endMonth - startMonth)` summed across all experiences, then convert to years+months
- [x] Ensure year rollover works: 16 months → "1y 4m", not "16m"
- [x] Handle `is_current` experiences using today's date (already does this, keep it)
- [x] Partial months: if remaining days after month calc >= 15, round up the month count
- [x] Format: `<30 days` → "Xd", `1-11 months` → "Xm", `≥12 months` → "Xy Xm" (drop "0m")
- [x] Same logic if it appears in profile overlay (currently doesn't — no change needed there)

#### 144j — Auto-derived primary role + new "desired role" field

Currently `primary_role_id` is manually set during onboarding and profile edit. User wants it auto-derived from the latest experience entry, making it non-editable. A new `desired_role_id` field gives crew a separate place to express career aspiration.

`experience_bracket_id` is already auto-derived by `derive_experience_profile()` (migration 00031), but the profile summary doesn't show the computed total alongside the band label. User wants: "6-12 months (10 months)".

##### Schema + API

- [ ] Migration 00064: add `desired_role_id uuid REFERENCES yacht_roles(id)` to `profiles` table
- [ ] Rollback 00064: drop column
- [ ] Update `apply_projection` for `PROFILE.CREATED` and `PROFILE.UPDATED` to write `desired_role_id`
- [ ] Update `derive_experience_profile()` to also auto-derive `primary_role_id` from the **most recent** crew experience (by `end_date` DESC, or `start_date` DESC for `is_current` entries). If no experiences exist, leave `primary_role_id` unchanged
- [ ] Update `EventPayloadMap` in `packages/types/src/events.ts`: add optional `desired_role_id` to `PROFILE.CREATED` and `PROFILE.UPDATED`
- [ ] Update profile PATCH API: accept `desiredRoleId`, stop accepting `primaryRoleId` (no longer manually editable — or keep accepting it but only for onboarding initial set before experiences exist)
- [ ] Update onboarding: keep `primaryRoleId` for initial setup (crew with no experiences yet). Once first experience is added, auto-derivation takes over

##### Profile page display

- [ ] **Primary Role** in summary: show auto-derived role from latest experience, non-editable. Label: "Current Role"
- [ ] **Desired Role** in summary: show next to Current Role. Label: "Desired Role". If not set, show "Not set" with edit pencil
- [ ] In edit mode: remove Primary Role selector (auto-derived). Add Desired Role selector using `RolePicker`
- [ ] **Experience bracket** in summary: show band label with computed total in brackets. Format: `"6-12 months (10m)"` or `"2-5 years (3y 2m)"`. Use the same calendar-month calculation from 144i for the parenthetical total
- [ ] Experience bracket in edit mode: remove the selector — it's fully auto-derived, user should not override. (Note: `derive_experience_profile` already overwrites manual edits whenever experience events fire)

##### Other surfaces

- [ ] Profile overlay: show both Current Role and Desired Role if set
- [ ] Review cards: no change needed (already show role from profile)
- [ ] View-only profile API (`GET /api/profile/[personId]`): include `desired_role_id` with resolved role name in response

#### 144k — NDA vessel posting: signal reveal-on-acceptance to employer

When an employer selects an NDA vessel for a posting, no messaging explains that crew will see vessel details after acceptance (daywork) or selection (permanent). The technical mechanism works — the gap is employer awareness.

- [x] In `VesselSelector`: when the selected vessel has `nda_flag: true`, show an info callout below the selector
- [x] In the daywork post confirmation dialog: if selected vessel is NDA, add a line: "This is an NDA vessel — details will be revealed to crew on acceptance"
- [x] In the permanent post form submit confirmation: no confirmation dialog exists — VesselSelector inline callout is sufficient
- [x] Pass `nda_flag` through the vessel selector's `onNdaChange` callback to form state

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

(See git history for completed stages 51-139, 141a, 142, 143, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g, template name cap, messages test cleanup)
