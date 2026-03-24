# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

> **Execution order:** Top-to-bottom. 151.
> **Dependencies:** 151a must land before 151b-e (agent profiles must exist).

### Stage 151: Agent identity — onboarding, profile, market feed, activity log

Agents are agency-employed job posters. They use DockWalker because their candidates are already on it — structured access to active crew beats WhatsApp and CV spam. They are users, not clients. Same terms, same tools, no special deals, no partnership leverage.

**What agents can do:** Post daywork + permanent jobs, review applicants, message hired crew, manage vessels, use templates. Identical to employer in every functional way.

**What agents cannot do:** Switch hats (permanently `employer`), apply for jobs, set daywork availability, set career status, mark experience as `is_current`, access Docky.

#### 151a — Agent onboarding conditional render

**Goal:** When identity type is `agent`, the onboarding wizard shows only agent-relevant fields. No new pages — conditional rendering within the existing wizard.

**Agent onboarding flow:** Welcome → Identity → Profile (agent fields only) → done (no experience fork, no hat selection). 3 steps.

**Identity step copy change:**

- [ ] Below the "I'm an Agency Agent" option, add subtext: _"You'll post jobs on behalf of vessels. This cannot be changed — agents cannot apply for jobs or switch to a crew profile."_ Muted text, same style as existing option hints
- [ ] "Skip for now" (Stage 149a) must NOT appear for agent identity type

**Profile step — agent field set:**

- [ ] **Display name** (required) — their real name, not the agency name
- [ ] **Agency name** (required for agents — currently optional, make it required when `identityType === 'agent'`). Label: "Agency name". This is their commercial identity
- [ ] **Nationality** (optional) — same dropdown as crew
- [ ] **Deck name** (optional) — label: "Nickname (optional)". Hint: "What people in the industry call you"
- [ ] **Avatar** (optional) — same AvatarUpload component
- [ ] **Location** (optional) — LocationPicker, port-required mode. Where they're based
- [ ] **Role specializations** (optional) — scrollable checkbox list of yacht roles. "Which departments do you typically place for?"

**Fields hidden for agents (do not render):**

- [ ] Primary role selector, experience bracket, vessel size exposure
- [ ] Certifications, languages, visas
- [ ] Bio (crew concept — agents have agency name instead)
- [ ] Desired role, career status
- [ ] Shore experience, motivation, available to start (green crew fields)
- [ ] Experience fork (green vs experienced) — skip entirely

**Hat selection:** Skipped entirely for agents. Hardcode `currentHat: 'agent'` in the onboarding submit payload. Do not show the hat selection step.

**Back button handling:** The onboarding wizard has back buttons on each step. The agent flow skips the experience fork (step 3 in crew flow). The back button on the Profile step must go to Identity (step 2), NOT to the experience fork. **Back targets must be identity-type-aware** — if `identityType === 'agent'`, Profile back → Identity. If crew, Profile back → experience fork (existing behavior).

**API changes:**

- [ ] `POST /api/onboarding`: when `identityType === 'agent'`, validate `agencyName` is non-empty (required). Currently optional — add conditional validation
- [ ] `PATCH /api/profile`: when `identity_type === 'agent'`, reject empty/null `agencyName` with 400. Agents must always have an agency name — it's their commercial identity and cannot be cleared after onboarding
- [ ] Verify `currentHat: 'agent'` is accepted by the API (it already should be — check the hat/identity validation logic)

**Tests:**

- [ ] Add onboarding test: agent with required fields (displayName, agencyName) succeeds
- [ ] Add onboarding test: agent without agencyName returns 400
- [ ] Add profile PATCH test: agent clearing agencyName returns 400
- [ ] Existing crew onboarding tests unaffected

#### 151b — Agent profile page

**Goal:** When `identityType === 'agent'`, the profile page shows agent-relevant sections only. The employer profile view (Stage 146) already exists — this stage refines it for agent identity specifically.

**Read the existing employer/agent profile view first.** The profile page already branches on identity type. This stage ensures the agent view has the right sections and labels.

**Agent profile sections:**

- [ ] **Header:** Avatar, display name, nationality flag (if set), deck name in quotes (if set), agency name badge, "Agent" identity badge
- [ ] **"How candidates see you" button:** Same ProfileOverlay mechanic as crew's "How employers see you", but relabelled. Calls `GET /api/profile/[personId]` with the agent's own person_id. Opens the agent overlay view (see below)
- [ ] **Agency Info section** (collapsible): agency name, location (port + city + region), role specializations as pills. Edit button opens edit mode for these fields. Empty-state prompts for missing fields: "Add your location — helps crew know where you're based", "Add role specializations — shows which departments you place for"
- [ ] **Maritime Background section** (collapsible, initially empty): same experience card layout as crew, but with header "Maritime Background" instead of "Experience". Subtext: "Share your maritime history — helps candidates know you understand their world." Cards show vessel name, role, date range, flag state, LOA, contract type. "Add maritime background" CTA button links to `/profile/add-experience`. All entries must have end date (see 151c for `is_current` enforcement)
- [ ] **My Vessels section** (collapsible): vessel list with M/Y S/Y prefix, LOA, size band. "My Vessels" ship icon button in header (same as employer). Links to `/vessels`
- [ ] **Active Postings row:** count of active daywork + permanent postings. Tappable — links to `/daywork/mine`. Not a full section, just an info row. Fetch via existing mine APIs (count from response arrays) or add to profile GET response

**Sections NOT shown for agents:**

- [ ] Summary (crew: role, bracket, size exposure — not relevant)
- [ ] Looking For (crew: desired role, availability, career status — not relevant)
- [ ] About (crew: bio, certs, visas — not relevant)
- [ ] Experience section with crew framing (replaced by Maritime Background)

**Edit mode for agents:**

- [ ] Display name, deck name, nationality, agency name, location, role specializations — same PATCH `/api/profile` endpoint, same fields
- [ ] No career status, no desired role, no certs, no visas, no languages, no bio

**View-only profile API fix (`GET /api/profile/[personId]`):**

- [ ] Currently agents fall through to `buildEmployerProfile()` which does NOT return experiences. Agent maritime background entries will be invisible in the overlay and "How candidates see you" preview. **Fix:** When `identity_type === 'agent'`, include `crew_experiences` (with vessel joins) in the response — same query as `buildCrewProfile()` uses for experiences, but framed as maritime background. Alternatively, add an explicit `buildAgentProfile()` branch that includes experiences alongside employer fields (agency name, vessels, active count)
- [ ] Verify the profile overlay component handles the agent response shape and renders Maritime Background entries

**Profile overlay (what crew see when tapping "Posted by {agent name}"):**

- [ ] Avatar, display name, nationality flag, deck name
- [ ] Agency name
- [ ] Location
- [ ] Role specializations (pills)
- [ ] Maritime Background entries (if any) — credibility signal. Label as "Maritime Background", not "Experience"
- [ ] Active posting count
- [ ] No placement metrics, no success rates, no verified badge

**Tests:**

- [ ] Verify profile page renders agent view when `identityType === 'agent'`
- [ ] Verify crew-specific sections are not rendered for agents
- [ ] Verify view-only profile API returns experiences for agent identity type
- [ ] Verify "How candidates see you" opens overlay with correct agent view

#### 151c — Agent maritime background (`is_current` enforcement)

**Goal:** Agents can add experience entries to show their maritime history, but cannot mark any as `is_current` — their current role is "agent", not an onboard position. All agent experience entries are past tense by definition.

**Implementation:**

- [ ] `POST /api/experiences`: when the authenticated user's `identity_type === 'agent'`, reject `isCurrent: true` with 400 and message "Agents cannot mark experience as current"
- [ ] `POST /api/experiences`: when `identity_type === 'agent'`, require `endDate` (non-null). Agent maritime history is complete — every entry must have a start and end date. Return 400 with "End date is required for maritime background entries" if missing
- [ ] `PATCH /api/experiences/[id]`: same checks — reject `isCurrent: true` for agents, require `endDate` if being set to null
- [ ] On the add-experience page (`/profile/add-experience`): hide the "Currently onboard" checkbox when user is an agent. **The page needs to know identity type** — fetch from profile API on mount, or read from the person record passed via layout context. The page currently does not have this data
- [ ] On the edit-experience page (`/profile/edit-experience/[id]`): same — hide "Currently onboard" checkbox for agents. Same identity type data requirement
- [ ] Page title: when `identityType === 'agent'`, show "Add Maritime Background" / "Edit Maritime Background" instead of "Add Experience" / "Edit Experience"
- [ ] Verify: existing crew experience routes are unaffected
- [ ] `derive_experience_profile()` will still run for agents after adding experience — this is fine, it auto-derives `primary_role_id` and `experience_bracket_id` which are harmless on an agent profile (they just won't be displayed)

**Tests:**

- [ ] Experience POST test: agent with `isCurrent: true` returns 400
- [ ] Experience POST test: agent with `isCurrent: false` or omitted but no `endDate` returns 400
- [ ] Experience POST test: agent with `isCurrent: false` and valid `endDate` succeeds
- [ ] Experience PATCH test: agent cannot set `isCurrent: true`
- [ ] Experience PATCH test: agent cannot clear `endDate` to null

#### 151d — Agent read-only market feed

**Goal:** Agents cannot switch to crew hat to see the discover feed. Give them a deliberate, intentional way to view the job market — a full-page read-only feed accessible via an explicit button on My Jobs, not a nav tab.

**Button placement:**

- [ ] My Jobs page (`/daywork/mine`): add a "View job market" button in the page header area (next to or below the Daywork/Permanent toggle). Only visible when `identityType === 'agent'`. Icon: eye or compass. Muted styling — secondary button, not primary
- [ ] Tapping the button navigates to `/discover/market` (new route, agent-only)

**Redirect `/discover` for agents:**

- [ ] In middleware: if `identity_type === 'agent'` and path is `/discover`, redirect to `/discover/market`. Without this, an agent navigating to `/discover` via URL sees a broken page (discover API returns 403 for non-crew). The redirect makes the broken path unreachable

**Market feed page (`/discover/market`):**

- [ ] **Access control:** If the user is not an agent (`identity_type !== 'agent'`), redirect to `/discover` (crew) or `/daywork/mine` (employer). Agents only
- [ ] **Layout:** Same card layout as the crew discover page but read-only. Scrollable feed (no swipe mechanic). Mixed daywork + permanent postings in one stream sorted by recency. No daywork/permanent toggle — agents see everything in one list, some friction is intentional
- [ ] **Card content:** Role, vessel name (NDA respected), type, size band, LOA, location, dates, salary/rate, certs, experience bracket. Same fields as crew discover cards
- [ ] **Hidden on cards:** "Posted by {name}" — completely removed. No poster identity visible. Agents cannot tell if a posting is from an employer or another agent
- [ ] **Hidden on detail view:** Tapping a card shows expanded detail (same as crew detail view). Poster name must also be stripped from the detail view, not just the card. No apply button on detail view
- [ ] **No apply button, no swipe interaction.** Cards are tappable to expand detail view only
- [ ] **Filters:** Role, port, certification — same filter set as crew discover. Work normally
- [ ] **Pagination:** Same cursor-based pagination as crew discover feed
- [ ] **Back navigation:** Header with back arrow → returns to My Jobs. If agent tapped a card to see detail, back from detail → market feed → My Jobs (standard Next.js routing stack)

**Data source — CRITICAL:**

- [ ] The existing `GET /api/daywork/discover` rejects non-crew with 403 (`person.current_hat !== 'crew'`). `GET /api/permanent/discover` may have the same restriction. **The market feed page cannot use these endpoints as-is.** Options:
  - **Option A (recommended):** Relax the hat check on both discover endpoints to allow `identity_type === 'agent'` alongside `current_hat === 'crew'`. Add a query param `anonymous=true` or check identity type server-side to strip `poster_person_id` and `poster_name` from the response for agents. This way the data is clean at the API layer, not just hidden at the UI layer
  - **Option B:** Create a separate `GET /api/market/feed` endpoint that reuses the discover query logic but is agent-only and strips poster identity. More code but cleaner separation
  - **Choose one approach and implement consistently for both daywork and permanent**

**Mixed feed merge strategy:**

- [ ] The page fetches from two separate APIs (daywork + permanent). Client-side merge: fetch a page from each, interleave by `created_at` descending. For "load more": fetch next page from both, merge again. This is simpler than coordinated dual-cursor pagination and acceptable for a read-only informational feed — some ordering imperfection at page boundaries is fine. If one source has no more results, continue fetching only from the other

**What NOT to build:**

- No nav tab for agents — discover stays out of the agent navbar
- No saved searches or alerts
- No analytics dashboard or market summary view

#### 151e — Agent activity log (telemetry)

**Goal:** Track agent-specific actions for internal DockWalker intelligence. Not event-sourced, not state-changing. Pure append-only telemetry in its own table, cleanly separable from the domain ledger.

**Schema:**

- [ ] Migration: create `agent_activity_log` table:
  ```sql
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES persons(id),
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
  ```
  Index on `(person_id, created_at)`. RLS: agent can INSERT own rows, admin can SELECT all. No UPDATE, no DELETE
- [ ] Rollback: drop `agent_activity_log` table
- [ ] `action` values (no CHECK constraint — keep extensible): `'market_feed_opened'`, `'market_feed_filtered'`, `'market_feed_card_viewed'`

**Logging points:**

- [ ] Market feed page mount: log `market_feed_opened` with metadata `{}` (or `{ filters }` if filters are pre-set from URL params)
- [ ] Filter change on market feed: log `market_feed_filtered` with metadata `{ roleId, portId, certificationId }` (whichever filters are active). **Debounce with 2-3 second settle** — log the final filter state after the agent stops adjusting, not every individual change
- [ ] Card tap to expand detail: log `market_feed_card_viewed` with metadata `{ postingType: 'daywork' | 'permanent' }` (no posting ID — avoid creating a link between agent and specific competitor postings)

**Implementation:**

- [ ] `POST /api/agent/activity` route: accepts `{ action: string, metadata?: object }`. Validates `identity_type === 'agent'`. Inserts row. Returns 204. Fire-and-forget from client (no await, no error handling — telemetry should never block UX)
- [ ] Client helper: `logAgentActivity(action: string, metadata?: Record<string, unknown>)` — calls the API endpoint, catches and ignores errors

**Internal intelligence derived later (not built now, just noting the schema supports it):**

- Time between `market_feed_opened` and next `DAYWORK.POSTED` / `PERMANENT.POSTED` by same agent
- Filter patterns (which roles/ports agents research most)
- Market feed engagement frequency per agent

**Tests:**

- [ ] Activity POST test: agent logs action successfully (204)
- [ ] Activity POST test: non-agent returns 403
- [ ] Activity POST test: missing action field returns 400

**Verification (all sub-stages):**

- [ ] Agent onboarding: Welcome → Identity (with clear "cannot switch" copy) → Profile (agent fields, agency name required) → done. No hat selection, no experience fork
- [ ] Agent onboarding back buttons: Profile → back → Identity (NOT experience fork). Identity → back → Welcome
- [ ] Agent profile: shows agency info, maritime background (empty initially), vessels, active postings. No crew sections
- [ ] Agent profile edit: can edit all agent fields. Cannot clear agency name (400 from API)
- [ ] "How candidates see you": opens overlay with correct agent view (agency name, maritime background, active count)
- [ ] Add maritime background: agent can add experience entries via existing add-experience page. Page title says "Add Maritime Background". `is_current` checkbox hidden. End date required. All entries require end date
- [ ] Edit maritime background: same — "Edit Maritime Background" title, no `is_current`, end date required
- [ ] Profile overlay: crew tapping "Posted by" on an agent's posting see agent profile with agency name, maritime background entries, active count
- [ ] Market feed: "View job market" button on My Jobs (agent only). Opens read-only mixed feed. No poster names on cards OR detail view. No apply. Filters work. Back to My Jobs
- [ ] Market feed access control: agent navigating to `/discover` is redirected to `/discover/market`. Non-agent navigating to `/discover/market` is redirected away
- [ ] Activity log: market feed actions logged to `agent_activity_log`. Verify rows appear in table after agent browses market feed
- [ ] Notification counts: verify `GET /api/notifications/count` correctly handles `role_context = 'agent'`. Agent notifications (from applications, messages) must appear in the count. If the endpoint only checks `'crew'`/`'employer'`, add `'agent'` handling
- [ ] Employer hat: no changes. No market feed button. No new nav items
- [ ] Crew hat: no changes. Discover works as before
- [ ] All existing tests pass, db reset clean

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Resilience Tests

- [ ] Discover page: mock safeFetch error → no spinner stuck
- [ ] Chat page: mock safeFetch error → polling still sets up
- [ ] Apply action: mock error → toast shown, state clears
- [ ] Post form: mock error → toast shown, state clears
- [ ] Availability overlay: network fail → no unhandled rejection

### Component Tests for Permanent UI

- [ ] PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard

### Push-Triggers Further Decomposition

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

---

## Done

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a, template name cap, messages test cleanup)
