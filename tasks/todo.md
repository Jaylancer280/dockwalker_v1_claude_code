# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 144: User testing fixes (batch 2 — UX polish)

#### 144a — Career status takes too much space on profile

Currently a full card with header, checkbox, conditional radio buttons, and number input. For most crew it's a simple toggle.

- [ ] Collapse career status into the crew info section rather than a standalone card
- [ ] When "not looking" / toggled off: show single line "Not open to permanent roles" with edit pencil
- [ ] When toggled on: show compact summary "Available immediately" or "After X days notice" with edit pencil
- [ ] Editing opens inline or small expandable — not a full card taking permanent vertical space

#### 144b — "Find daywork" button copy and size

Currently `w-full` with "Find daywork" text. Too prominent and doesn't cover permanent.

- [ ] Change copy to "Browse jobs" (covers both daywork and permanent)
- [ ] Reduce width: remove `w-full`, use `w-fit` or auto-width
- [ ] Keep the Compass icon

#### 144c — Sign out should redirect to splash page

Currently `router.push('/auth/login')` after `supabase.auth.signOut()`.

- [ ] Change redirect to `router.push('/')` — the landing/splash page
- [ ] Verify middleware doesn't intercept unauthenticated `/` and redirect back to `/auth/login`

#### 144d — Splash page copy update

Current copy is daywork-only: "Superyacht daywork, simplified". Doesn't mention permanent hiring, Docky, invitations, or checklists.

- [ ] Update hero headline to cover both modes (e.g., "Superyacht hiring, simplified" or "Your superyacht career starts here")
- [ ] Update subheading to mention both daywork and permanent
- [ ] Update value prop cards:
  - Card 1: keep daywork focus but mention permanent too
  - Card 2: mention structured hiring pipeline (shortlist → select → place)
  - Card 3: hint at smart features — "AI career advisor, crew invitations, pre-arrival checklists"
- [ ] Update how-it-works steps to be mode-neutral
- [ ] Update footer tagline

#### 144e — IMO fuzzy search auto-trigger at 4 digits

Currently requires exactly 7 digits + explicit button click. User wants auto-search after 4+ digits for better UX.

- [ ] Modify `/api/vessels/lookup` to accept 4-7 digit input: use `LIKE '{imo}%'` for partial matches (prefix search, not full fuzzy), return up to 5 results
- [ ] In add-experience page: add `useEffect` watching `imoNumber` — when length >= 4, debounce 500ms then auto-call lookup
- [ ] Show results as a selectable dropdown list below the input (multiple matches possible with partial IMO)
- [ ] Keep the Search button as a manual fallback but make it enabled at 4+ digits
- [ ] Same change on edit-experience page
- [ ] Update vessel lookup tests for partial match behavior

#### 144f — Crew hat needs "My Vessels" button on profile

Currently the Ship icon button on the profile header is gated behind `!isCrewHat` (line 415 of profile/page.tsx). Crew create vessels for experience entries but can't navigate to view them.

- [ ] Remove the `!isCrewHat` gate on the vessels button — show it for all hats
- [ ] The vessels API (`GET /api/vessels`) already returns vessels filtered by `owner_person_id` regardless of hat — no backend change needed
- [ ] The vessels page already works for any authenticated user — no page change needed

#### 144g — Vessel size display: bands on profile, exact LOA on cards

User wants: profile page shows auto-derived size band exposure (non-editable summary). Cards and detail views show exact LOA everywhere.

Current state: discover cards show size band only, not LOA. Profile experience cards show LOA. Vessels page shows LOA with band fallback.

- [ ] **Discover daywork cards:** add LOA display alongside vessel name (e.g., "M/Y Serenity · 65m") — the discover API already joins `get_vessel_public` which returns `loa_meters`, just wire it to the card
- [ ] **Discover permanent cards:** same — show LOA from `vessel_loa` field already in the API response
- [ ] **Application cards (crew Applied tab):** show LOA alongside vessel info
- [ ] **Review applicant cards:** if vessel context is available, show LOA
- [ ] **Profile page — vessel size exposure section:** ensure it shows bands only (already does), confirm it's non-editable in view mode (already is), remove the editable checkbox version if it exists in edit mode — this is auto-derived from experiences, user should not manually override
- [ ] **Vessels page:** add more detail per vessel — show vessel type (motor/sail), LOA, size band, IMO (if not NDA), NDA badge, created date. Currently shows name + LOA/band + NDA badge — verify and enhance if sparse

#### 144h — Experience private intelligence fields (salary + verified sea time)

A new "Private intelligence" section on the experience form for optional data that enhances Docky's career advice accuracy but is never shown to other users. Two fields: salary and verified sea time.

**Salary** — schema already supports `salary_amount`, `salary_currency`, `salary_period` on `crew_experiences` (migration 00028). API POST/PATCH routes already accept and store. GET strips them. Only UI is missing.

**Verified sea time** — no schema support yet. Needs migration. Engineering Officer routes require sea time in **days**, Deck Officer routes require sea time in **nautical miles**. Both can apply to a single experience (e.g., a dual-role crew member), so both fields should be available simultaneously.

##### Schema + API (sea time)

- [ ] Migration 00063: add `sea_time_days INTEGER` (nullable) and `sea_time_nautical_miles INTEGER` (nullable) to `crew_experiences`
- [ ] Rollback 00063: drop both columns
- [ ] Update `apply_projection` handlers for `EXPERIENCE.ADDED` and `EXPERIENCE.UPDATED` to write `sea_time_days` and `sea_time_nautical_miles`
- [ ] Update POST `/api/experiences` to accept optional `seaTimeDays` (integer, >= 0) and `seaTimeNauticalMiles` (integer, >= 0)
- [ ] Update PATCH `/api/experiences/[id]` to accept same
- [ ] GET `/api/experiences` must NOT return sea time fields (same treatment as salary — internal intelligence only)
- [ ] Update `EventPayloadMap` in `packages/types/src/events.ts` for `EXPERIENCE.ADDED` and `EXPERIENCE.UPDATED` payloads
- [ ] Update onboarding POST if it accepts experience fields (check if it passes through salary/sea time — it should accept but not require them)

##### UI (both fields in shared section)

- [ ] In add-experience page: add a visually separated section after existing fields with header: **"Private intelligence (optional)"**
- [ ] Add section copy: "This data is never shown to anyone. It enhances Docky's career advice accuracy for you."
- [ ] **Salary sub-section:**
  - [ ] Salary amount input (numeric, optional)
  - [ ] Period toggle: "per month" / "per year" (maps to `monthly` / `annually`)
  - [ ] Currency selector defaulting to user preference (EUR/USD/GBP/AED)
- [ ] **Verified sea time sub-section:**
  - [ ] Label: "Verified Sea Time"
  - [ ] Copy: "Engineering Officer routes require days. Deck Officer routes require nautical miles."
  - [ ] Days input (integer, optional, label "Days at sea")
  - [ ] Nautical miles input (integer, optional, label "Nautical miles")
  - [ ] Both fields visible simultaneously — crew can fill one or both
- [ ] Wire all fields into submit payload (`salaryAmount`, `salaryCurrency`, `salaryPeriod`, `seaTimeDays`, `seaTimeNauticalMiles`)
- [ ] Same section on edit-experience page — since GET never returns salary or sea time, fields appear empty on edit. Add helper text: "Previously entered data is stored securely and cannot be retrieved"
- [ ] No display anywhere — profile page, profile overlay, review cards must never show salary or sea time data (verify with grep)

#### 144i — Total experience pill calculation bug

The badge uses day-count division (`totalDays / 30` for months, `totalDays / 365` for years) which produces inaccurate results for real date ranges. Example: a Feb 1 – Apr 30 experience is 89 days → shows "2m" instead of "3m".

- [ ] Replace the day-count arithmetic with calendar month diffing: `(endYear - startYear) * 12 + (endMonth - startMonth)` summed across all experiences, then convert to years+months
- [ ] Ensure year rollover works: 16 months → "1y 4m", not "16m"
- [ ] Handle `is_current` experiences using today's date (already does this, keep it)
- [ ] Partial months: if remaining days after month calc >= 15, round up the month count
- [ ] Format: `<30 days` → "Xd", `1-11 months` → "Xm", `≥12 months` → "Xy Xm" (drop "0m")
- [ ] Same logic if it appears in profile overlay (currently doesn't — no change needed there)

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

- [ ] In `VesselSelector`: when the selected vessel has `nda_flag: true`, show an info callout below the selector: "Vessel details are hidden from crew until they accept this position (daywork) or are selected (permanent). Crew will see vessel name, type, and size — but not IMO — until then."
- [ ] In the daywork post confirmation dialog: if selected vessel is NDA, add a line: "This is an NDA vessel — details will be revealed to crew on acceptance"
- [ ] In the permanent post form submit confirmation: same NDA line if applicable
- [ ] Pass `nda_flag` through the vessel selector's `onChange` or track it in form state so the confirmation dialog can read it

---

### Stage 145: Web vs mobile layout optimization (separate track)

This is a larger UX workstream. Needs design direction from user before implementation.

- [ ] **Planning needed:** Which pages need web-specific layouts? (discover, profile, post form, review, chat, settings, billing)
- [ ] **Pattern decision:** responsive breakpoints (Tailwind `md:` / `lg:`) vs separate layout components?
- [ ] **Priority pages for web billing flow:** billing/page.tsx and settings (since Apple payment avoidance is the driver)
- [ ] **Max-width container:** add `max-w-lg mx-auto` or similar wrapper to prevent full-width stretch on desktop
- [ ] **Navigation:** bottom nav works on mobile but may need sidebar or top nav on desktop

> Defer detailed implementation until user provides specific layout preferences or screenshots.

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
