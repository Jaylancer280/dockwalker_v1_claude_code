# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Never delete completed items — move to Done section at session end.

## Current Task

Stage 57: Documentation + Edge Case Hardening

## Queue

### ~~Stage 54: Employer Available Crew API + Invite Route~~ (moved to Done)

API endpoints for browsing available crew and sending invitations.

**Available crew API — `apps/web/src/app/api/daywork/[id]/available-crew/route.ts` (new GET):**

- [ ] Auth: require employer/agent hat, must own the posting
- [ ] Guard: daywork must be `active` status (not in_progress/completed/cancelled)
- [ ] Query available crew:
  1. Get daywork's start_date, end_date, location_port_id → resolve city_id from port
  2. Find crew with `availability_windows` where: date BETWEEN start_date AND end_date, expires_at > now, not_available = false, city_id matches daywork's city
  3. Exclude: crew who already applied (check `applications` table), crew already invited (check `daywork_invitations`), the employer themselves
  4. Default: filter by daywork's `role_id` matching crew's `primary_role_id`
  5. Accept optional query param `allRoles=true` to skip role filter
- [ ] Enrich each crew member with: profile data (display_name, role, certs, experience bracket, bio, location), availability overlap days count, availability city
- [ ] Limit: 50 results, ordered by available_days DESC (most available first)
- [ ] Response shape: `{ crew: Array<enriched crew>, invitation_count: number, invitation_limit: 2 }`

**Invite API — `apps/web/src/app/api/daywork/[id]/invite/route.ts` (new POST):**

- [ ] Auth: require employer/agent hat, must own the posting
- [ ] Guard: daywork must be `active` status
- [ ] Body: `{ crewPersonId: string }`
- [ ] Validate: crew person exists and has crew profile
- [ ] Validate: no existing application or invitation for this crew+daywork
- [ ] Enforce limit: count pending invitations for this daywork, reject with 400 if >= 2
- [ ] Append `DAYWORK.INVITED` event via `appendEvent`
- [ ] Return `{ invitation: { id, status } }`

**Tests:**

- [ ] Available crew: returns crew with availability overlap in same city
- [ ] Available crew: excludes crew who already applied
- [ ] Available crew: excludes crew already invited
- [ ] Available crew: excludes employer themselves
- [ ] Available crew: default role filter matches daywork role
- [ ] Available crew: `allRoles=true` returns crew of any role
- [ ] Available crew: returns 403 if not posting owner
- [ ] Available crew: returns empty if daywork is not active
- [ ] Invite: creates invitation, returns 201
- [ ] Invite: returns 400 when invitation limit (2) reached
- [ ] Invite: returns 400 if crew already applied
- [ ] Invite: returns 400 if crew already invited

---

### ~~Stage 55: Review Page "Available" Tab~~ (moved to Done)

---

### Stage 57: Documentation + Edge Case Hardening

Final pass: documentation updates, edge case testing, and cleanup.

- [ ] Update `BUILD_STATE.md`: stages 51-56, schema version v30, migration table entry for 00030
- [ ] Update `packages/types/README.md`: new event types, DayworkInvitation model
- [ ] Update `packages/db/README.md`: if appendEvent types were extended
- [ ] Update `apps/web/README.md`: new API routes (available-crew, invite, invitations, respond)
- [ ] Update `supabase/README.md`: migration 00030 entry
- [ ] Verify: invitation revocation fires correctly when employer accepts crew (all pending invitations → revoked)
- [ ] Verify: crew applying via Browse to a job they were invited to auto-accepts the invitation
- [ ] Verify: daywork cancellation revokes pending invitations
- [ ] Verify: daywork relist revokes pending invitations
- [ ] Verify: invitation limit is enforced at API layer (not just UI)
- [ ] Run full test suite: `cd apps/web && npx vitest run` — all tests pass
- [ ] Run `tsc --noEmit` — zero errors
- [ ] Run ESLint — zero warnings/errors

## Done

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
