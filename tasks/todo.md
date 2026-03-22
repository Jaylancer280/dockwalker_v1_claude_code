# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix 144-batch: Bugs found during user testing of Stage 144

---

## Queue

### Fix 144-batch: Bugs found during user testing of Stage 144 + cert match feature

**Implementation order:** Fix-1 through Fix-6 first (UI/form bugs), then Fix-8 (cert coloring feature), then Fix-7 (reseed) last. The reseed should be the final step so all UI fixes are in place to verify the seed data produces correct visual results.

**Cross-cutting concern (Fix-4 + Fix-5 + Fix-8):** Three fixes need crew profile data to stay fresh after mutations. Rather than solving freshness three times, create a single shared pattern — either a `visibilitychange` listener that re-fetches profile data (certs, experiences) when the tab regains focus, or a lightweight `useProfileRefresh` hook. Apply it to: (a) experience pill on profile page, (b) cert IDs on permanent feed, (c) cert IDs on daywork feed.

#### Fix-8 — Cert match/mismatch coloring on all job cards

Show each required cert as a colored pill on job cards. Green = crew holds this cert. Amber = crew is missing this cert. This gives immediate visual feedback on why an application might be blocked (permanent) or what's missing (daywork, advisory).

**Permanent cards (minor — data already available):**

Permanent cards already have `crewCertIds`, `required_certification_ids`, and `cert_names`. Currently all certs render as identical outline badges with no color distinction.

- [ ] In `permanent-job-card.tsx`: replace the uniform outline Badge with colored pills:
  - For each cert, check if `crewCertIds` contains the matching `required_certification_ids[i]`
  - **Held:** green background pill (`bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400` or similar)
  - **Missing:** amber background pill (`bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400`)
  - If `crewCertIds` is undefined/null (not loaded yet), fall back to current outline style (no color)
- [ ] In `permanent-job-detail.tsx`: same coloring in the "Required certifications" section
- [ ] Keep the existing "Missing certifications" text below the disabled Apply button — the pills give at-a-glance context, the text gives explicit messaging

**Daywork cards (larger — need to wire cert data through):**

Daywork cards currently don't show required certs at all. The API returns `required_certification_ids` but not resolved cert names.

- [ ] In `daywork/discover/route.ts`: resolve cert names from `required_certification_ids` (same pattern as permanent discover route — bulk fetch cert IDs, build name map, return `cert_names` array parallel to IDs)
- [ ] In `discover/page.tsx`: fetch crew's `certification_ids` from profile on mount (same as permanent feed does) — store in state, pass to daywork card rendering
- [ ] In the daywork card JSX (the `JobCard` function in discover/page.tsx): render cert pills below the existing experience bracket line, using the same green/amber coloring logic
- [ ] Daywork certs are advisory (soft gate) — do NOT disable the Apply button for missing certs. Just show amber pills as informational. Add no blocking logic.
- [ ] If a daywork posting has no required certs (`required_certification_ids` is empty), show nothing (no cert section)

**Application cards (crew Applied tab):**

- [ ] In the daywork application cards: show cert pills if `cert_names` is available in the API response (check if `/api/daywork/applications` returns cert data — if not, add it)
- [ ] In permanent application cards: already have cert data, add same coloring

**No schema/migration changes needed.** The daywork discover API route needs a minor change to resolve cert names (same pattern as permanent discover). The cert comparison logic already exists in permanent cards, just needs visual treatment and replication to daywork.

#### Fix-1 — Vessel creation form missing motor/sail + wrong field label

The standalone vessels page form (`/vessels`) shows "Private or Charter" as `vessel_type`, but `vessel_type` should be motor/sail (the API already validates `['motor', 'sail']` and rejects private/charter). The form is actually broken — submitting with "private" or "charter" returns a validation error.

Additionally, the form is missing fields that exist on the add-experience vessel creation flow. The standalone form should be consistent.

- [x] In `vessels/page.tsx`: changed vessel type selector from "Private"/"Charter" to "Motor (M/Y)"/"Sail (S/Y)"
- [x] No vessel_operation field present in form — already clean
- [x] Form has: vessel name, IMO, LOA, vessel type (motor/sail), NDA flag
- [x] Motor/sail values match POST /api/vessels validation

#### Fix-2 — Salary period missing "per day" option

The private intelligence salary section on add/edit experience only has "per month" / "per year". The DB schema already supports `daily` in the `salary_period` CHECK constraint.

- [x] In add-experience page: added "per day" option (value `daily`)
- [x] In edit-experience page: same
- [x] No API or schema change needed

#### Fix-3 — Remove vessel size band from experience card header

Profile page experience card header shows size band inline with role and date range (line ~965: `{sizeBandLabel && ` · ${sizeBandLabel}`}`). User wants it removed from the header.

- [x] Removed `· ${sizeBandLabel}` from experience card header line
- [x] Size band kept in expanded card body
- [x] No change needed in profile overlay

#### Fix-4 — Total experience pill not updating after add/delete

Root cause: after adding an experience at `/profile/add-experience`, navigation back to `/profile` doesn't re-fetch experiences. The `useEffect` dependency is `person?.identity_type` which doesn't change on navigation. After delete, local state updates but the experience bracket label from the profile object is stale.

- [x] Added `visibilitychange` listener on profile page to re-fetch profile + experiences when tab regains focus
- [x] After delete: re-fetches profile so auto-derived bracket/role/size exposure update from server
- [x] Verify: deferred to manual smoke test

#### Fix-5 — Cert checker: diagnose why it's not blocking

The server-side cert gate is correctly implemented (POST /api/permanent/[id]/apply checks cert superset, returns 403). The client-side gate loads `crewCertIds` from profile on mount and disables the Apply button when certs are missing. Tests pass.

Possible causes of user-observed failure:

1. **Stale cert data on client:** cert feed loads certs once on mount — if user updated profile certs and didn't refresh the permanent feed, old cert set is used for the UI gate (server still blocks)
2. **Permanent feed not loading certs at all:** if the Supabase profile query fails silently, `crewCertIds` stays undefined and the card treats it as "no data to compare" → button enabled
3. **No required certs on test postings:** seed permanent postings may have empty `required_certification_ids` — check seed data

- [x] Seed permanent postings already have required_certification_ids — PM-07 in reseed will be the definitive cert-gate test case
- [x] Added `.catch()` error handling on cert fetch + `Promise.resolve()` wrapper
- [x] Added `visibilitychange` listener to re-fetch crew cert IDs when tab regains focus
- [x] Manual test: deferred to post-reseed verification

#### Fix-6 — Vessel size exposure should be auto-derived, not editable

`vessel_size_exposure_ids` is already auto-derived by `derive_experience_profile()` (migration 00031) from crew experiences. But the profile edit mode still shows editable checkboxes. Manual edits get silently overwritten whenever experience events fire. Same pattern as experience bracket — should be read-only.

- [x] Removed vessel size exposure checkboxes from edit mode; replaced with "Auto-derived" note
- [x] Removed `vesselSizeExposureIds` from profile PATCH payload
- [x] View mode display unchanged (already correct)
- [x] API still accepts field but auto-derivation overwrites — no API change needed

#### Fix-7 — Comprehensive database reseed

Current seed data has accumulated issues: wrong vessel IDs, overlapping daywork dates, missing cert-gated test cases, no proper crew experience auto-derivation. Rewrite `003_advanced_scenarios.sql` from scratch with two guiding principles: (1) minimal 1-day daywork durations to avoid date overlap blocks, (2) proper vessel experience entries that drive auto-derivation.

Keep `001_canonical_data.sql` and `002_test_profiles.sql` unchanged (2 auth users, 3 vessels). Rewrite `003_advanced_scenarios.sql` entirely.

##### Profile Two (crew c@1) — Previous vessel experience

Add 4 experience entries that trigger `derive_experience_profile()` to auto-set `primary_role_id`, `experience_bracket_id`, and `vessel_size_exposure_ids`. Most recent experience determines current role.

- [ ] **Exp 1:** Deckhand on S/Y Wanderer (35m sail), 8 months ago → 5 months ago (3 months), seasonal, charter, flag GBR, "Med charter season — washing, varnishing, tender ops"
- [ ] **Exp 2:** Deckhand on M/Y Serenity (65m motor), 4 months ago → 2 months ago (2 months), rotational, charter, flag CYM, "Western Med rotation — Antibes, Cannes, Monaco"
- [ ] **Exp 3:** Lead Deckhand on M/Y Serenity (65m motor), 2 months ago → 1 month ago (1 month), rotational, charter, flag CYM, "Promoted to Lead Deckhand for St Tropez charter"
- [ ] **Exp 4 (most recent):** Bosun on M/Y Phantom (45m motor), 3 weeks ago → 1 week ago (2 weeks), temporary, private, flag MHL, "Temp Bosun cover during owner trip"
- [ ] After all 4 entries: `derive_experience_profile()` should auto-set:
  - `primary_role_id` → Bosun (d004) — most recent experience
  - `experience_bracket_id` → 6-12 months (f002) — ~6.5 months total
  - `vessel_size_exposure_ids` → [30-40m, 40-50m, 60-80m] — from 35m, 45m, 65m vessels
- [ ] Include salary on 2 entries (private intelligence, never displayed): Exp 2: €250/day, Exp 3: €300/day. Payload keys: `salary_amount`, `salary_currency`, `salary_period` — these are written by `apply_projection` EXPERIENCE.ADDED handler
- [ ] Include sea time on 1 entry: Exp 2: 45 sea days. Payload keys: `sea_time_days`, `sea_time_nautical_miles` — these are written by the separate `apply_sea_time_from_event` trigger (migration 00063), NOT by apply_projection
- [ ] **Important:** after all 4 EXPERIENCE.ADDED events, `derive_experience_profile()` runs automatically (called inside apply_projection). This overwrites `primary_role_id`, `experience_bracket_id`, and `vessel_size_exposure_ids` on the profile. The values set in `002_test_profiles.sql` (Deckhand, 2-5y, 30-40/40-50/50-60m) will be replaced by the auto-derived values. Verify this is correct by checking the profile after db reset.

##### Crew availability

- [ ] Profile Two: available from today → today+13 (14-day window), city: Antibes, port: Port Vauban, expires: today+7
- [ ] Permanent availability: `immediate`, `currently_employed: false`

##### Daywork postings — 10 scenarios using 1-day durations to avoid overlaps

All posted by Profile One (employer). Date windows carefully spaced to prevent `check_no_overlap` blocks. Use `current_date + N` offsets.

**Active postings (discoverable by crew):**

- [ ] **DW-01: Active, no applicants** — Deckhand (d006), Port Vauban Antibes, day +20, 1 working day, €250 EUR, certs: STCW Basic (e001), exp: 6-12m (f002), vessel: M/Y Serenity, meals: breakfast+lunch
- [ ] **DW-02: Active, no applicants, NDA vessel** — Head Chef (d015), Port Vauban Antibes, day +22, 1 working day, €400 EUR, certs: STCW Basic (e001) + Food Safety (e006), exp: 2-5y (f004), vessel: M/Y Phantom (NDA), meals: all
- [ ] **DW-03: Active, no applicants, different port** — Stewardess (d014), Club de Mar Mallorca, day +24, 1 working day, €200 EUR, certs: STCW Basic (e001), exp: 6-12m (f002), vessel: S/Y Wanderer

**Crew has applied (various review states):**

- [ ] **DW-04: Applied (pending review)** — Stewardess (d014), Port Vauban Antibes, day +26, 1 working day, €220 EUR, certs: STCW Basic (e001), vessel: M/Y Serenity. Crew applied with message "Available and keen"
- [ ] **DW-05: Applied → Viewed → Shortlisted** — Deckhand (d006), Port Hercules Monaco, day +28, 1 working day, €280 EUR, certs: STCW Basic (e001), vessel: M/Y Serenity. Events: POSTED → APPLIED → VIEWED → SHORTLISTED

**Past daywork with engagements (dates in the past, no overlap risk):**

- [ ] **DW-06: Accepted → In Progress (work started)** — Deckhand (d006), Vieux Port Cannes, day -30, 1 working day, €260 EUR, vessel: M/Y Serenity. Events: POSTED → APPLIED → VIEWED → ACCEPTED → WORK_STARTED (employer) → WORK_STARTED_CONFIRMED (crew). Include 2 messages + checklist (3 items). Engagement active.
- [ ] **DW-07: Completed + rated by both** — Deckhand (d006), Port de Nice, day -40, 1 working day, €250 EUR, vessel: M/Y Serenity. Events: full lifecycle through COMPLETED → COMPLETION_CONFIRMED → RATED_BY_CREW → RATED_BY_EMPLOYER. Include 2 messages.
- [ ] **DW-08: Completed + disputed by crew** — Day Worker (d020), Port de la Darse Villefranche, day -50, 1 working day, €200 EUR, vessel: M/Y Serenity. Events: through COMPLETED → COMPLETION_DISPUTED. Include 1 message.
- [ ] **DW-09: Cancelled by crew post-acceptance** — Bosun (d004), Port Gallice Antibes, day -60, 1 working day, €300 EUR, vessel: M/Y Serenity. Events: ACCEPTED → CANCELLED_BY_CREW (reason: found_other_work). Employer rated cancellation.
- [ ] **DW-10: Cancelled by employer post-acceptance + daywork cancelled** — Lead Deckhand (d005), Port Pierre Canto Cannes, day -70, 1 working day, €270 EUR, vessel: M/Y Serenity. Events: ACCEPTED → CANCELLED_BY_EMPLOYER (reason: vessel_leaving, relist: false) → DAYWORK.CANCELLED_BY_EMPLOYER.

**Invitation:**

- [ ] **DW-01 also gets an invitation:** Employer invites crew to DW-01 (the active deckhand posting). Invitation status: pending. This tests the invitation tab.

##### Permanent postings — 7 scenarios covering full funnel

All posted by Profile One (employer).

- [ ] **PM-01: Active, no applicants** — Chief Engineer (d007), Port Vauban Antibes, start +30d, salary 5000-7000 EUR/month, live aboard: yes, certs: STCW Basic (e001), exp: 2-5y (f004), shortlist cap: 5, vessel: M/Y Serenity
- [ ] **PM-02: Applied (pending review)** — Deckhand (d006), Port Gallice Antibes, start +45d, salary 2800-3200 EUR/month, live aboard: yes, certs: STCW Basic (e001) + ENG1 (e005), exp: 6-12m (f002), shortlist cap: 3, vessel: M/Y Serenity. Crew applied with message.
- [ ] **PM-03: Shortlisted** — Bosun (d004), Port Hercules Monaco, start +60d, salary 4000-5000 EUR/month, live aboard: yes, certs: STCW Basic (e001) + Powerboat (e007), exp: 1-2y (f003), shortlist cap: 4, vessel: M/Y Phantom (NDA). Crew applied → shortlisted.
- [ ] **PM-04: Selected → In Negotiation (chat open)** — First Officer (d002), Port Vauban Antibes, start +14d, salary 5500-6500 EUR/month, live aboard: yes, certs: STCW Basic (e001) + ENG1 (e005), exp: 2-5y (f004), shortlist cap: 3, vessel: M/Y Serenity. Crew applied → shortlisted → selected → engagement created. Include 3 negotiation messages.
- [ ] **PM-05: Placement confirmed** — Second Stewardess (d012), Vieux Port Cannes, start -90d, salary 3000-3500 EUR/month, live aboard: yes, certs: STCW Basic (e001), exp: 6-12m (f002), shortlist cap: 5, vessel: M/Y Serenity. Full funnel → PLACEMENT_CONFIRMED. Engagement closed (successful_placement).
- [ ] **PM-06: Cancelled by employer** — Second Engineer (d008), Port de Nice, start +20d, salary 4500-5500 EUR/month, live aboard: no, certs: STCW Basic (e001), exp: 1-2y (f003), shortlist cap: 3, vessel: M/Y Phantom (NDA). Posted → CANCELLED_BY_EMPLOYER.
- [ ] **PM-07: Active, CERT-GATED** — Sous Chef (d016), Port Vauban Antibes, start -5d (ASAP), salary 4500-6000 EUR/month, live aboard: yes, certs: **STCW Basic (e001) + Food Safety (e006)**, exp: 2-5y (f004), shortlist cap: 3, vessel: M/Y Serenity. Crew user CANNOT apply — missing Food Safety cert. This is the cert checker test case.

##### Templates

- [ ] 1 daywork template: "Standard Deckhand - Antibes" — Role: Deckhand (d006), Port Vauban, 1 working day, €250 EUR, certs: STCW Basic, meals: breakfast+lunch
- [ ] 1 permanent template: "Stewardess - Season" — Role: Stewardess (d014), Port Vauban, salary 2500-3000 EUR/month, certs: STCW Basic, live aboard: yes

##### User preferences

- [ ] Both profiles: `profile_visible: true`

##### Verification after reseed

- [ ] `npx supabase db reset` passes clean — zero errors
- [ ] Log in as `c@1` crew hat → discover page shows DW-01, DW-02, DW-03 cards (not DW-04/05 which crew applied to)
- [ ] Applied tab shows DW-04 (applied) and DW-05 (shortlisted)
- [ ] Invitations tab shows 1 pending invitation for DW-01
- [ ] Messages (crew hat): active threads for DW-06 (in progress) + PM-04 (negotiation), history for DW-07/08/09/10 + PM-05
- [ ] Permanent discover: PM-01 visible, PM-07 shows cert gate (Apply disabled, "Missing: Food Safety" shown)
- [ ] Permanent applied: PM-02 (under review), PM-03 (shortlisted), PM-04 (selected)
- [ ] Profile page: Current Role = Bosun, Experience = 6-12 months (~6m total), Vessel Size Exposure = 30-40m, 40-50m, 60-80m (auto-derived)
- [ ] Log in as `e@1` employer hat → My Jobs shows all active postings with correct applicant counts

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g, template name cap, messages test cleanup)
