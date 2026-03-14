# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Never delete completed items — move to Done section at session end.

## Current Task

(none)

## Queue

### Stage 60: Experience Bracket + Vessel Size Exposure Auto-Derivation

Auto-derive `experience_bracket_id` and `vessel_size_exposure_ids` on the profile from `crew_experiences` data, so experienced crew don't need manual selection after onboarding.

**60a. Migration 00031 — `apply_projection` update:**

- [ ] In `EXPERIENCE.ADDED` handler: after inserting experience, call a new helper function `derive_experience_profile(p_person_id)`
- [ ] In `EXPERIENCE.UPDATED` handler: after updating experience, call `derive_experience_profile(p_person_id)`
- [ ] In `EXPERIENCE.REMOVED` handler: after deleting experience, call `derive_experience_profile(p_person_id)`
- [ ] `derive_experience_profile(p_person_id)` function logic:
  - Sum total days across all `crew_experiences` for person: `SUM(COALESCE(end_date, CURRENT_DATE) - start_date)` (use today's date for `is_current` entries)
  - Convert to months: `total_days / 30.44`
  - Find matching `experience_bracket`: `WHERE min_months <= total_months AND (max_months IS NULL OR max_months >= total_months)` ordered by `sort_order DESC LIMIT 1`
  - Collect distinct `size_band_id` values from vessels linked to experiences: `SELECT DISTINCT v.size_band_id FROM crew_experiences ce JOIN vessels v ON ce.vessel_id = v.id WHERE ce.person_id = p_person_id AND v.size_band_id IS NOT NULL`
  - `UPDATE profiles SET experience_bracket_id = derived_bracket, vessel_size_exposure_ids = derived_bands WHERE person_id = p_person_id`
- [ ] Rollback `00031_rollback.sql`: revert `apply_projection` to v30 state (remove `derive_experience_profile` calls)

**60b. Tests:**

- [ ] Integration test: adding experience auto-updates profile `experience_bracket_id`
- [ ] Integration test: adding second experience recalculates bracket from total days
- [ ] Integration test: removing experience recalculates bracket downward
- [ ] Integration test: `is_current` experience uses today's date for day calculation
- [ ] Integration test: vessel size exposure IDs collected from experience vessels
- [ ] Unit test: verify `derive_experience_profile` handles zero experiences (clears bracket)

**60c. Cleanup:**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 60, schema version v31, migration 00031 entry
- [ ] Update `supabase/README.md`: migration 00031 entry
- [ ] Remove "Auto-derivation of experience_bracket_id and vessel_size_exposure_ids" from `BUILD_STATE.md` Deferred Decisions

---

### Stage 61: NDA Reveal-After-Acceptance + Immutability Guard

Crew who are engaged (accepted) on an NDA vessel should see full vessel details. NDA flag cannot be downgraded from `true` to `false`.

**61a. `get_vessel_public` RPC update — migration 00032:**

- [ ] Current logic: nulls `imo_number` when `nda_flag=true` AND caller is not owner
- [ ] New logic: also reveal full details (including IMO and name) when caller has an `active` engagement on a daywork linked to this vessel
- [ ] Add join: check `active_engagements ae JOIN dayworks d ON ae.daywork_id = d.id WHERE ae.crew_person_id = auth.uid() AND ae.status = 'active' AND d.vessel_id = p_vessel_id`
- [ ] If crew is engaged: return full vessel data regardless of NDA flag
- [ ] Rollback `00032_rollback.sql`: revert `get_vessel_public` to v31 state

**61b. NDA immutability — `VESSEL.UPDATED` handler:**

- [ ] In `apply_projection` `VESSEL.UPDATED` handler: if `nda_flag` is being set to `false` and current vessel has `nda_flag = true`, skip the update (silently ignore the downgrade)
- [ ] Alternative: API layer validation in `PATCH /api/vessels/[id]` — return 400 if trying to set `nda_flag: false` when current value is `true`, with message `{ error: 'NDA flag cannot be removed once set' }`
- [ ] Prefer API layer validation (explicit error) over silent projection skip

**61c. Tests:**

- [ ] Integration test: engaged crew sees full vessel details for NDA vessel
- [ ] Integration test: non-engaged crew sees masked vessel details for NDA vessel (existing behavior)
- [ ] Unit test: PATCH vessel returns 400 when trying to remove NDA flag
- [ ] Unit test: PATCH vessel succeeds when setting NDA flag from false to true

**61d. Cleanup:**

- [ ] Run full test suite — all tests pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 61, schema version v32, migration 00032 entry
- [ ] Update `supabase/README.md`: migration 00032 entry

---

### Stage 62: Integration Test Expansion

Fill gaps in the integration test suite. All tests hit real local Supabase.

**62a. Engagement lifecycle tests — `__tests__/integration/event-roundtrip.test.ts`:**

- [ ] Test: `DAYWORK.COMPLETED` — employer marks complete, daywork status becomes `completed`, engagement status becomes `completed`
- [ ] Test: `ENGAGEMENT.COMPLETION_CONFIRMED` — crew confirms completion, `crew_completion_status` set to `confirmed`
- [ ] Test: `ENGAGEMENT.COMPLETION_DISPUTED` — crew disputes, `crew_completion_status` set to `disputed`
- [ ] Test: `ENGAGEMENT.RATED_BY_CREW` — crew rating persisted to `engagement_ratings`
- [ ] Test: `ENGAGEMENT.RATED_BY_EMPLOYER` — employer rating persisted to `engagement_ratings`

**62b. Cancellation tests:**

- [ ] Test: `DAYWORK.CANCELLED_BY_EMPLOYER` — daywork status becomes `cancelled`, active engagement cancelled, pending apps rejected
- [ ] Test: `ENGAGEMENT.CANCELLED_BY_CREW` — engagement cancelled, `cancelled_by` set to `crew`
- [ ] Test: `ENGAGEMENT.CANCELLED_BY_EMPLOYER` — engagement cancelled, `cancelled_by` set to `employer`

**62c. Work started + postponement tests:**

- [ ] Test: `ENGAGEMENT.WORK_STARTED` — initiator's side recorded
- [ ] Test: `ENGAGEMENT.WORK_STARTED_CONFIRMED` — both sides confirmed, `work_started_at` timestamped
- [ ] Test: `DAYWORK.POSTPONED` — new dates recorded on engagement
- [ ] Test: `DAYWORK.POSTPONEMENT_APPROVED` — dates applied to daywork
- [ ] Test: `DAYWORK.POSTPONEMENT_REJECTED` — engagement cancelled

**62d. Checklist tests:**

- [ ] Test: `CHECKLIST.SET` — checklist created in `engagement_checklists`
- [ ] Test: `CHECKLIST.ITEM_TOGGLED` — item ID added to/removed from `acknowledged_item_ids`

**62e. Experience CRUD tests:**

- [ ] Test: `EXPERIENCE.ADDED` — experience row created in `crew_experiences`
- [ ] Test: `EXPERIENCE.UPDATED` — experience row updated
- [ ] Test: `EXPERIENCE.REMOVED` — experience row deleted
- [ ] Test: experience date overlap rejected (if Stage 59d adds DB-level enforcement)

**62f. Application supersede test:**

- [ ] Test: `APPLICATION.SUPERSEDED` — accepting one application auto-supersedes overlapping pending applications

**62g. Auto-derivation tests (depends on Stage 60):**

- [ ] Test: adding experience auto-derives profile `experience_bracket_id`
- [ ] Test: adding experience auto-populates `vessel_size_exposure_ids`

**62h. Cleanup:**

- [ ] Run full integration test suite: `cd apps/web && npm run test:integration`
- [ ] Run full unit test suite — all pass
- [ ] Update `BUILD_STATE.md`: stage 62

---

### Stage 63: Push Token Infrastructure

Device token storage + management API. No delivery yet.

**63a. Migration 00033 — `device_tokens` table:**

- [ ] Create `device_tokens` table: `id uuid PK, person_id uuid FK(persons) NOT NULL, token text NOT NULL, platform text NOT NULL CHECK (platform IN ('apns', 'fcm', 'web')), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()`
- [ ] Unique constraint on `(person_id, token)` — same device, same person = upsert
- [ ] Index on `person_id` for lookup
- [ ] RLS: users can read/write their own tokens only (`person_id = auth.uid()`)
- [ ] Rollback `00033_rollback.sql`: drop `device_tokens` table

**63b. API routes:**

- [ ] `POST /api/push-tokens` — upsert device token: auth required, accepts `{ token: string, platform: 'apns' | 'fcm' | 'web' }`, inserts or updates on conflict `(person_id, token)`, returns 201
- [ ] `DELETE /api/push-tokens` — remove token: auth required, accepts `{ token: string }`, deletes matching row for authenticated user, returns 200
- [ ] Input validation: token non-empty string, platform enum check

**63c. Client-side token persistence — `apps/web/src/lib/push-notifications.ts`:**

- [ ] In registration listener: when token received, POST to `/api/push-tokens` with token and platform (`ios` → `apns`, `android` → `fcm`)
- [ ] Store token in localStorage to detect changes (only re-POST if token changed)
- [ ] On sign-out: DELETE `/api/push-tokens` with current token to clean up

**63d. Tests:**

- [ ] Test: POST push-tokens creates token, returns 201
- [ ] Test: POST push-tokens upserts on duplicate (person_id, token)
- [ ] Test: POST push-tokens returns 400 on missing/invalid platform
- [ ] Test: POST push-tokens returns 401 when unauthenticated
- [ ] Test: DELETE push-tokens removes matching token
- [ ] Test: DELETE push-tokens returns 401 when unauthenticated

**63e. Cleanup:**

- [ ] Run full test suite — all pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 63, schema version v33, migration 00033 entry
- [ ] Update `supabase/README.md`: migration 00033 entry
- [ ] Update `apps/web/README.md`: new push-tokens API routes
- [ ] Remove push notifications from `BUILD_STATE.md` Deferred Decisions (infrastructure now exists)

---

### Stage 64: Push Targeted Notifications

Server-side delivery for 1:1 notifications triggered by events.

**64a. Push delivery service — `apps/web/src/lib/push-delivery.ts`:**

- [ ] Create push delivery helper: `sendPushToUser(personId: string, title: string, body: string, data?: Record<string, string>)`
- [ ] Queries `device_tokens` for person, sends to each token
- [ ] APNs delivery via `@parse/node-apns` or HTTP/2 direct (evaluate dependency)
- [ ] FCM delivery via `firebase-admin` SDK or FCM HTTP v1 API
- [ ] Handle token invalidation: if delivery returns invalid/expired token error, delete the token row
- [ ] Env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_PATH`, `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_KEY`

**64b. Post-event notification triggers — `apps/web/src/lib/push-triggers.ts`:**

- [ ] `notifyOnEvent(eventType: string, payload: object)` — called after `appendEvent` / `appendEvents` in API routes
- [ ] Event → notification mapping:
  - `DAYWORK.APPLIED` → notify employer: "New applicant for DW-{job_number}" (priority: normal)
  - `DAYWORK.ACCEPTED` → notify crew: "You've been accepted for DW-{job_number}!" (priority: high)
  - `DAYWORK.REJECTED` → notify crew: "Update on your application for DW-{job_number}" (priority: normal)
  - `DAYWORK.SHORTLISTED` → notify crew: "You've been shortlisted for DW-{job_number}" (priority: normal)
  - `DAYWORK.INVITED` → notify crew: "You've been invited to DW-{job_number}" (priority: high)
  - `MESSAGE.SENT` → notify other party: "{sender_name}: {preview}" (priority: normal)
  - `ENGAGEMENT.WORK_STARTED` → notify other party: "Work started confirmation requested for DW-{job_number}" (priority: normal)
  - `ENGAGEMENT.CANCELLED_BY_CREW` / `ENGAGEMENT.CANCELLED_BY_EMPLOYER` → notify other party: "Engagement cancelled for DW-{job_number}" (priority: high)
  - `DAYWORK.COMPLETED` → notify crew: "DW-{job_number} marked complete — please confirm" (priority: normal)
  - `DAYWORK.POSTPONED` → notify crew: "Date change proposed for DW-{job_number}" (priority: normal)
  - `CHECKLIST.SET` → notify crew: "Pre-arrival checklist updated for DW-{job_number}" (priority: normal)
- [ ] Each notification carries `data: { screen: 'chat', engagementId: '...' }` (or `screen: 'discover'` for invitations) for deep linking

**64c. Wire triggers into API routes:**

- [ ] Add `notifyOnEvent()` call after each `appendEvent` / `appendEvents` in the relevant routes
- [ ] Notifications are fire-and-forget (don't await, don't fail the request on notification error)
- [ ] Wrap in try/catch so push failures never break the API response

**64d. Tests:**

- [ ] Test: `sendPushToUser` queries device_tokens and calls delivery (mock delivery layer)
- [ ] Test: `sendPushToUser` removes invalid tokens on delivery failure
- [ ] Test: `notifyOnEvent` maps each event type to correct recipient and message
- [ ] Test: notification failure does not propagate to caller

**64e. Cleanup:**

- [ ] Run full test suite — all pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 64
- [ ] Update `apps/web/README.md`: new env vars for APNs/FCM, push delivery architecture

---

### Stage 65: Push Broadcast Notifications

`DAYWORK.POSTED` → notify matching available crew in same city+role, with batching.

**65a. Broadcast delivery — extend `push-triggers.ts`:**

- [ ] `DAYWORK.POSTED` handler: query `availability_windows` for crew in same city with `not_available = false` and `expires_at > now()`
- [ ] Default: filter by matching `role_id` (crew's profile role matches daywork role)
- [ ] Collect all matching crew `person_id`s, look up their device tokens
- [ ] Send notification: "New {role} daywork in {port_name} — DW-{job_number}" (priority: normal)
- [ ] Data payload: `{ screen: 'discover', dayworkId: '...' }`

**65b. Batching/collapsing for multiple postings:**

- [ ] If multiple `DAYWORK.POSTED` events fire within a 60-second window for the same city, collapse into a single notification per recipient
- [ ] Implementation: use a lightweight in-memory debounce queue (Map of `city_id → { timer, dayworkIds }`)
- [ ] After 60-second window, send collapsed notification: "X new daywork opportunities in {city_name}"
- [ ] Single posting (no collapse): send specific notification as in 65a
- [ ] Note: this is best-effort — server restarts clear the queue, which is acceptable

**65c. Tests:**

- [ ] Test: DAYWORK.POSTED triggers notifications to matching crew in same city
- [ ] Test: crew in different city NOT notified
- [ ] Test: crew with `not_available = true` NOT notified
- [ ] Test: multiple postings within 60s collapsed into single notification
- [ ] Test: single posting after 60s sends specific notification

**65d. Cleanup:**

- [ ] Run full test suite — all pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 65

---

### Stage 66: Push In-App Handling

Foreground display, deep linking on tap, badge management.

**66a. Foreground notification display — `push-notifications.ts`:**

- [ ] In foreground push received listener: show a toast/banner notification (not native alert)
- [ ] Use a simple in-app toast component (new `PushToast` component or use existing UI primitives)
- [ ] Toast shows title + body, tappable to navigate
- [ ] Auto-dismiss after 5 seconds
- [ ] Don't show toast if user is already on the relevant screen (compare `data.screen` + `data.engagementId` with current route)

**66b. Deep linking on tap — `push-notifications.ts`:**

- [ ] In push action performed listener: read `data.screen` and navigate accordingly
- [ ] `screen: 'chat'` + `engagementId` → navigate to `/messages/{engagementId}`
- [ ] `screen: 'discover'` → navigate to `/discover` (Invitations tab if `type: invitation`)
- [ ] `screen: 'review'` + `dayworkId` → navigate to `/daywork/{dayworkId}/review`
- [ ] Use Next.js `router.push()` (or Capacitor-aware navigation if needed)

**66c. Badge management:**

- [ ] On notification received: increment app badge count (Capacitor Badge plugin)
- [ ] On app foreground: clear badge count
- [ ] On navigating to relevant screen: clear badge count

**66d. Tests:**

- [ ] Component test: PushToast renders with title and body, auto-dismisses
- [ ] Test: deep link navigation maps screen types to correct routes

**66e. Cleanup:**

- [ ] Run full test suite — all pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Update `BUILD_STATE.md`: stage 66
- [ ] Update `apps/web/README.md`: push notification architecture, toast component

---

### Documentation Tasks (implementation agent — during Close of final stage)

- [ ] Update `BUILD_STATE.md` Deferred Decisions: remove "Push notifications" entry (now implemented), remove "Auto-derivation of experience_bracket_id..." entry (now implemented in Stage 60)
- [ ] Verify all README files are current

### Stage 57: Documentation + Edge Case Hardening

Final pass: documentation updates, edge case testing, and cleanup.

- [x] Update `BUILD_STATE.md`: stages 51-56, schema version v30, migration table entry for 00030
- [x] Update `packages/types/README.md`: new event types, DayworkInvitation model (already current from Stage 53)
- [x] Update `packages/db/README.md`: appendEvents already documented (Stage 35)
- [x] Update `apps/web/README.md`: new API routes (available-crew, invite, invitations, respond)
- [x] Update `supabase/README.md`: migration 00030 entry (already current from Stage 53)
- [x] Verify: invitation revocation fires correctly when employer accepts crew (integration test exists)
- [x] Verify: crew applying via Browse to a job they were invited to auto-accepts the invitation (integration test exists)
- [x] Verify: daywork cancellation revokes pending invitations (integration test exists)
- [x] Verify: daywork relist revokes pending invitations (added integration test)
- [x] Verify: invitation limit is enforced at API layer (unit test in invite.test.ts)
- [x] Run full test suite: `cd apps/web && npx vitest run` — 431 tests pass
- [x] Run `tsc --noEmit` — zero errors
- [x] Run ESLint — zero warnings/errors

## Done

### Stage 59: Correctness Fixes — Overlap, Expiry, Experience Dates (completed)

- [x] 59a: Invitation accept calls `check_no_overlap()` RPC — returns 409 on overlap
- [x] 59b: Past-start-date invitations filtered from GET, rejected with 400 on accept
- [x] 59c: Verified declined invitations already excluded from available-crew (no change needed)
- [x] 59d: Experience POST/PATCH enforce date overlap + is_current duplicate checks; onboarding batch validates intra-batch overlaps
- [x] 59e: 436 tests pass, TSC clean, BUILD_STATE.md updated

### Stage 58: Invite confirmation dialog + polish (completed)

- [x] Invite button/swipe now opens confirmation dialog with crew name, role, and job number
- [x] Fetches daywork meta (job_number + role name) on page load
- [x] minAvailableDays API filter clamped to 0-365 (UI already had min=0)
- [x] Deferred decision added for size band post-fetch sparseness
- [x] Fixed test mock for new supabase query chain
- [x] 431 tests pass, TSC clean

### Stage 57: Documentation + Edge Case Hardening (completed)

- [x] All documentation already current from Stages 53-56
- [x] Added integration test for DAYWORK.RELISTED revoking pending invitations
- [x] All 5 invitation edge cases verified (acceptance revocation, auto-accept, cancel revocation, relist revocation, API limit)
- [x] 431 unit tests pass, TSC clean, ESLint clean

### Stage 56: Crew Invitations Tab + Accept/Decline (completed)

- [x] GET /api/daywork/invitations — crew-only, returns pending invitations with hydrated daywork, employer, and NDA-safe vessel data
- [x] POST /api/daywork/invitations/:id/respond — accept (availability check + atomic INVITATION_ACCEPTED + APPLIED) and decline (INVITATION_DECLINED)
- [x] Discover page "Invitations" tab with badge count, invitation cards, accept/decline buttons, confirmation dialogs, inline error handling
- [x] 3 invitations GET tests + 8 respond tests = 11 new tests; 431 total pass

### Stage 55: Review Page "Available" Tab (completed)

- [x] Add third tab "Available" with count badge, lazy-loaded on first activation
- [x] Swipe right = Invite (calls POST /api/daywork/:id/invite), swipe left = Pass (client-side)
- [x] Dedicated `SwipeableAvailableCrew` (horizontal drag only) and `AvailableCrewCard` (no message/date, green availability)
- [x] "INVITE" / "PASS" swipe overlay labels
- [x] Pass (X) and Invite (Send) button controls — no shortlist button
- [x] Invitation usage indicator: "X of 2 invitations used"
- [x] Invite disabled when limit reached; "Invitation limit reached" empty state
- [x] "Show all roles" checkbox toggle re-fetches API
- [x] Session-based pass tracking via component state
- [x] 3 component tests: three tabs render, crew loads with indicator, limit reached state

### Stage 54: Employer Available Crew API + Invite Route (completed)

**Available crew API — `apps/web/src/app/api/daywork/[id]/available-crew/route.ts`:**

- [x] Auth: require employer/agent hat, must own the posting
- [x] Guard: daywork must be `active` status
- [x] Query available crew: resolve port → city, find matching availability windows, exclude applied/invited/employer
- [x] Default role filter matching daywork's `role_id`, `allRoles=true` to skip
- [x] Enrich with profile data and availability overlap days
- [x] Limit 50 results, ordered by available_days DESC
- [x] Response shape: `{ crew, invitation_count, invitation_limit: 2 }`

**Invite API — `apps/web/src/app/api/daywork/[id]/invite/route.ts`:**

- [x] Auth: require employer/agent hat, must own the posting
- [x] Guard: daywork must be `active` status
- [x] Validate: crew person exists, no existing application or invitation
- [x] Enforce limit: max 2 pending invitations per daywork
- [x] Append `DAYWORK.INVITED` event
- [x] Return `{ invitation: { id, status } }` with 201

**Tests (16 new, 417 total):**

- [x] Available crew: returns crew with availability overlap in same city
- [x] Available crew: excludes crew who already applied
- [x] Available crew: excludes crew already invited
- [x] Available crew: excludes employer themselves
- [x] Available crew: default role filter matches daywork role
- [x] Available crew: `allRoles=true` returns crew of any role
- [x] Available crew: returns 403 if not posting owner
- [x] Available crew: returns empty if daywork is not active
- [x] Invite: creates invitation, returns 201
- [x] Invite: returns 400 when invitation limit (2) reached
- [x] Invite: returns 400 if crew already applied
- [x] Invite: returns 400 if crew already invited
- [x] Invite: returns 403 if not employer hat
- [x] Invite: returns 400 if daywork not active
- [x] Invite: returns 401 when unauthenticated
- [x] Invite: returns 400 if crewPersonId missing

### Stage 53: Invitation Schema + Types + Events (completed)

**Migration `00030_daywork_invitations.sql`:**

- [x] Create `daywork_invitations` table with RLS, indexes, unique constraint
- [x] `apply_projection` handlers: `DAYWORK.INVITED`, `DAYWORK.INVITATION_ACCEPTED`, `DAYWORK.INVITATION_DECLINED`
- [x] Revocation logic: `DAYWORK.ACCEPTED`, `DAYWORK.CANCELLED_BY_EMPLOYER`, `DAYWORK.RELISTED` revoke pending invitations
- [x] Auto-accept: `DAYWORK.APPLIED` auto-accepts matching pending invitation

**Rollback `00030_daywork_invitations_rollback.sql`:**

- [x] Drop table, revert `apply_projection` to v29 state

**Types — `packages/types/src/events.ts`:**

- [x] Added 3 event types, payload shapes, `DayworkInvitation` interface, `invitation` aggregate type

**Tests:**

- [x] Integration: `DAYWORK.INVITED` creates pending invitation
- [x] Integration: `DAYWORK.ACCEPTED` revokes pending invitations
- [x] Integration: `DAYWORK.APPLIED` auto-accepts matching invitation
- [x] Integration: `DAYWORK.CANCELLED_BY_EMPLOYER` revokes pending invitations

### Stage 52: Employer Review Page Filters (completed)

**API — `apps/web/src/app/api/daywork/[id]/applicants/route.ts`:**

- [x] Accept optional query param `minAvailableDays` (number) — filter applicants with `available_days >= minAvailableDays`
- [x] Accept optional query param `certificationId` (uuid) — filter applicants whose `certification_ids` array includes this cert
- [x] Apply filters server-side after enrichment (availability is computed post-fetch, so filter after enrichment loop)

**UI — `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`:**

- [x] Add collapsible filters panel (same pattern as discover page) with "Filters" toggle button
- [x] Add `filterCertId` state + `<Select>` dropdown populated from `certifications` table
- [x] Add `filterMinDays` state + `<Input type="number">` for minimum available days
- [x] Pass filters as query params when fetching applicants
- [x] Filters apply across both Applied and Shortlisted tabs (single fetch, client-side tab split happens after)
- [x] Rename page header from "Review Applicants" to "Review"

**Tests:**

- [x] Test applicants route with `certificationId` param filters correctly
- [x] Test applicants route with `minAvailableDays` param filters correctly
- [x] Test filters don't break existing tab split (Applied vs Shortlisted)

### Stage 51: Discovery Filter Expansion (completed)

**API — `apps/web/src/app/api/daywork/discover/route.ts`:**

- [x] Accept new query params: `certificationId` (uuid), `experienceBracketId` (uuid), `sizeBandId` (uuid)
- [x] `certificationId` filter: `.contains('required_certification_ids', [certificationId])` — shows only jobs requiring this cert (crew filtering by certs they hold)
- [x] `certificationId=none` filter: `.eq('required_certification_ids', '{}')` — shows only jobs with no cert requirements
- [x] `experienceBracketId` filter: `.eq('experience_bracket_id', experienceBracketId)` on the dayworks query
- [x] `sizeBandId` filter: post-fetch filter on hydrated vessel data (vessel's `size_band_id` matches)

**UI — `apps/web/src/app/(app)/discover/page.tsx`:**

- [x] Add `filterCertId` state + `<Select>` dropdown populated from `certifications` table with "No certs required" option
- [x] Add `filterExperienceBracketId` state + `<Select>` dropdown populated from `experience_brackets` table
- [x] Add `filterSizeBandId` state + `<Select>` dropdown populated from `vessel_size_bands` table (labels in user's preferred unit via `usePreferences`)
- [x] Wire all three new filters into `loadCards()` fetch URL as query params
- [x] Layout: certification + experience bracket on one row (2-col), size band on its own row below

**Tests — `apps/web/__tests__/api/daywork-discover.test.ts`:**

- [x] certificationId filter (contains)
- [x] certificationId=none filter (eq empty array)
- [x] experienceBracketId filter (eq)
- [x] sizeBandId post-fetch filter
- [x] sizeBandId excludes dayworks with no vessel
- [x] Combined filters (role + cert + bracket)
- [x] All seven filters simultaneously

**Other fixes:**

- [x] Fixed form-dropdowns component test mock (thenable query builder for chained `.order()`)
- [x] Updated existing test assertion for `size_band_id` in vessel response
