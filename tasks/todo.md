# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Never delete completed items — move to Done section at session end.

## Current Task

(none)

## Queue

### Stage 54: Employer Available Crew API + Invite Route

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

### Stage 55: Review Page "Available" Tab

Employer-facing UI for browsing and inviting available crew.

**UI — `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`:**

- [ ] Add third tab: "Available" with count badge (from API response)
- [ ] Fetch available crew from `GET /api/daywork/:id/available-crew` on tab select (lazy load — don't fetch until tab is active)
- [ ] Reuse existing card stack + swipe mechanic:
  - Right swipe = Invite (calls `POST /api/daywork/:id/invite`)
  - Left swipe = Pass (client-side only — remove from stack, no API call)
  - NO upward swipe / shortlist on Available tab (only applied crew can be shortlisted)
- [ ] Card content: same layout as applicant cards but without application message and applied date; show availability overlap days prominently
- [ ] Swipe overlay labels: "INVITE" (green, right), "PASS" (red, left)
- [ ] Button controls: Pass (left, red X) and Invite (right, green envelope/send icon). No center shortlist button.
- [ ] Show invitation usage: "1 of 2 invitations used" indicator above the card stack
- [ ] When invitation limit reached: disable invite swipe/button, show "Invitation limit reached" message
- [ ] "Show all roles" toggle above cards (sends `allRoles=true` to API, re-fetches)
- [ ] Empty states: "No available crew nearby" / "Invitation limit reached"
- [ ] After successful invite: remove crew from stack, increment invitation count display
- [ ] Session-based pass tracking: track passed crew IDs in component state so they don't reappear until page reload

**Tests:**

- [ ] Component renders three tabs with correct counts
- [ ] Available tab shows invite/pass buttons (no shortlist)
- [ ] Invitation limit indicator displays correctly

---

### Stage 56: Crew Invitations Tab + Accept/Decline

Crew-facing UI and API for receiving and responding to employer invitations.

**Invitations API — `apps/web/src/app/api/daywork/invitations/route.ts` (new GET):**

- [ ] Auth: require crew hat
- [ ] Query `daywork_invitations` WHERE crew_person_id = user, status = 'pending'
- [ ] Hydrate each invitation with: daywork details (role, vessel, location, dates, rate, meals, notes, job_number), employer display_name, vessel public data (via `get_vessel_public`)
- [ ] Response shape: `{ invitations: Array<hydrated invitation> }`

**Respond API — `apps/web/src/app/api/daywork/invitations/[id]/respond/route.ts` (new POST):**

- [ ] Auth: require crew hat, must be the invited crew
- [ ] Body: `{ action: 'accept' | 'decline' }`
- [ ] Guard: invitation must be 'pending' status
- [ ] Guard: daywork must still be 'active' status (if not, return 400 "This job is no longer available")
- [ ] **Accept flow:**
  1. Check crew has availability (reuse existing availability gate logic)
  2. Append `DAYWORK.INVITATION_ACCEPTED` event (updates invitation to 'accepted')
  3. Append `DAYWORK.APPLIED` event (creates application — same as normal apply)
  4. Use `appendEvents` batch for atomicity
  5. Return `{ application: { id, status } }`
- [ ] **Decline flow:**
  1. Append `DAYWORK.INVITATION_DECLINED` event
  2. Return `{ success: true }`

**UI — `apps/web/src/app/(app)/discover/page.tsx`:**

- [ ] Add "Invitations" tab between Browse and Applied
- [ ] Badge count: fetch pending invitation count on mount (alongside applied count)
- [ ] Invitation cards: show job details (same fields as discover cards: role, vessel, location, dates, rate, job reference) + "Invited by {employer name}" header
- [ ] Each card has two buttons: "Accept" (green) and "Decline" (red) — NOT swipe-based (deliberate decisions, not rapid browsing)
- [ ] Accept confirmation dialog: "Accept this invitation? You'll be added as an applicant for this job."
- [ ] On accept success: remove from Invitations list, increment Applied badge count, show brief success toast/message
- [ ] On decline: remove from Invitations list
- [ ] Decline confirmation: "Decline this invitation? The employer won't be notified." (simple confirm)
- [ ] Empty state: "No pending invitations"
- [ ] Handle edge case: if crew taps Accept but daywork is no longer active, show error inline "This job is no longer available"

**Tests:**

- [ ] GET invitations returns only pending invitations for authenticated crew
- [ ] GET invitations returns empty for non-crew hat
- [ ] Respond accept: creates application, updates invitation status
- [ ] Respond accept: returns 400 if daywork no longer active
- [ ] Respond accept: returns 400 if crew has no availability
- [ ] Respond decline: updates invitation status to declined
- [ ] Respond: returns 403 if not the invited crew
- [ ] Respond: returns 400 if invitation not pending

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
