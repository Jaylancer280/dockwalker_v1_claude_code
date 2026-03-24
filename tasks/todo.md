# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 152: Bug fixes (151a-d) + architectural cleanup

---

## Queue

### Stage 152: Bug fixes (151a-d) + architectural cleanup

**Implementation order:** Fix 151a-d first (bugs), then 152e-h (architectural).

#### Fix 151a — Agent activity log RLS admin policy uses nonexistent identity_type

**Bug:** Migration `00070_agent_activity_log.sql` line 22 checks `p.identity_type = 'admin'`, but the `persons` table CHECK constraint (migration 00003, line 8) only allows `'crew'` or `'agent'`. There is no `'admin'` identity type. The admin SELECT policy will **never match** — admins cannot read any activity logs.

**Additionally:** The INSERT policy `agent_insert_own` (line 15-16) only checks `person_id = auth.uid()` — it allows ANY authenticated user to insert, not just agents. The API route validates `identity_type === 'agent'` server-side, so this isn't exploitable via the app, but the RLS should be defence-in-depth.

**Fix — new migration (00071):**

- [x] Drop and recreate both RLS policies on `agent_activity_log`:
  - `agent_insert_own` INSERT policy: `person_id = auth.uid() AND exists (select 1 from public.persons p where p.id = auth.uid() and p.identity_type = 'agent')` — only agents can insert
  - `admin_select_all` SELECT policy: `exists (select 1 from public.persons p where p.id = auth.uid() and p.is_admin = true)` — uses the `is_admin` boolean column from migration 00050, which is the correct admin check pattern
- [x] Rollback for 00071
- [x] 00070 rollback unchanged

### Fix 151b — Notification count doesn't handle agent role_context

**Bug:** `GET /api/notifications/count` (`apps/web/src/app/api/notifications/count/route.ts`) assumes a binary crew/employer hat split. Line 19: `const altHat = currentHat === 'crew' ? 'employer' : 'crew'`. When an agent's `current_hat` is `'agent'`:

- `currentHat` = `'agent'`
- `altHat` = `'crew'` (wrong — agents have no alt hat)
- Notification count queries `role_context = 'agent'` (happens to work by accident — `currentHat` is `'agent'`)
- Alt notification count queries `role_context = 'crew'` (wrong — shows crew notifications that don't exist for agents)
- Message hat detection (line 62): `eng.crew_person_id === user.id ? 'crew' : 'employer'` — agents are always `employer_person_id` on engagements, so `engHat` = `'employer'`, which never equals `currentHat` (`'agent'`), so **message count is always 0 for agents**

**Fix in `apps/web/src/app/api/notifications/count/route.ts`:**

- [x] After line 18 (`const currentHat = person.current_hat;`), add an agent-specific branch:
  ```
  if (person.identity_type === 'agent') {
    // Agents have no alt hat — single-context counts only
    // Notification count: role_context = 'agent'
    // Message count: agent is always employer_person_id on engagements
    // Return alt counts as 0
  }
  ```
- [x] The agent branch should:
  1. Query notifications with `role_context = 'agent'` (single query, no alt hat query)
  2. Query engagements where `employer_person_id = user.id` (agents are always the employer side)
  3. Get unread message counts via existing `get_unread_counts` RPC
  4. Count threads with unread messages (same loop, but `engHat` check is unnecessary — all agent engagements are employer-side, all count toward `msgCurrent`)
  5. Return `{ notification_count, message_count, alt_notification_count: 0, alt_message_count: 0 }`
- [x] Verified `identity_type` available from `requireDomainUser`

**Tests:**

- [ ] Add test: agent notification count — deferred to 152f
- [ ] Add test: agent message count — deferred to 152f
- [x] Existing crew/employer tests unaffected

### Fix 151c — `/discover` agent redirect should be in middleware, not client-side

**Bug:** `apps/web/src/app/(app)/discover/page.tsx` lines 280-286 redirect agents to `/discover/market` via `window.location.href`. This is client-side only — the agent briefly sees the crew discover page shell (layout renders, API call fires and returns 403, then redirect happens). This causes a visual flash and a wasted failed API call.

**Fix in `apps/web/src/lib/supabase/middleware.ts`:**

- [x] Middleware query updated with `identity_type`
- [x] Agent redirect block added after hat-routed landing:
  ```
  // Agent cannot access crew discover — redirect to market feed
  if (person.identity_type === 'agent' && path === '/discover') {
    const url = request.nextUrl.clone();
    url.pathname = '/discover/market';
    return NextResponse.redirect(url);
  }
  ```
- [x] Second middleware query also updated with `identity_type`
- [x] Client-side redirect kept as fallback
- [x] No tests needed

### Fix 151d — Permanent review API drops languages from response

**Bug:** `GET /api/permanent/[id]/review` (`apps/web/src/app/api/permanent/[id]/review/route.ts`) selects `languages` at line 42 in the Supabase query but **does not include it in the response mapping** at lines 68-92. The field is fetched from the DB and discarded. Employers reviewing permanent applicants cannot see crew language data.

**Additionally:** The permanent review page's `Applicant` interface (`apps/web/src/app/(app)/permanent/[id]/review/page.tsx` line 23-40) has no `languages` or `certification_ids` fields. The daywork review page shows both as badges — permanent review should match.

**Fix — API route (`apps/web/src/app/api/permanent/[id]/review/route.ts`):**

- [x] In the response mapping, added `languages` after `certification_ids`:
  ```
  languages: profile?.languages ?? [],
  ```
  This passes through the already-fetched data

**Fix — permanent review page (`apps/web/src/app/(app)/permanent/[id]/review/page.tsx`):**

- [x] Added `languages` and `certification_ids` to `Applicant` interface
- [ ] In the applicant card rendering, add language count badge — same pattern as daywork review page (`apps/web/src/app/(app)/daywork/[id]/review/page.tsx` lines 1046-1051):
  ```
  {(applicant.languages?.length ?? 0) > 0 && (
    <Badge variant="secondary" className="text-xs">
      {applicant.languages.length} language{applicant.languages.length !== 1 ? 's' : ''}
    </Badge>
  )}
  ```
  Place it after any existing cert/experience badges on the applicant card
- [ ] Note: `certification_ids` is already returned by the API (line 83) but the page interface was missing it. Adding it to the interface enables future cert badge display if desired — but for this fix, only languages need the UI badge added

**Tests:**

- [ ] Add permanent review API test — deferred to 152f
- [x] Existing permanent review tests unaffected

#### 152e — Consolidate supplementary triggers into apply_projection

**Problem:** 6 supplementary triggers fire independently on `events` INSERT alongside `apply_projection`. This violates the documented lesson ("Don't split event handling architecture"). Event processing is now split across 7 places. A future `apply_projection` replacement might not know about the satellites. Debugging requires a scavenger hunt.

**Current triggers to consolidate:**

| Trigger                             | Migration | Events                          | Table                        | Columns                                                        |
| ----------------------------------- | --------- | ------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `trg_sea_time_from_event`           | 00063     | EXPERIENCE.ADDED/UPDATED        | crew_experiences             | sea_time_days, sea_time_nautical_miles                         |
| `trg_desired_role_from_event`       | 00064     | PROFILE.CREATED/UPDATED         | profiles                     | desired_role_id                                                |
| `trg_deck_name_from_event`          | 00065     | PROFILE.CREATED/UPDATED         | profiles                     | deck_name                                                      |
| `trg_career_status_from_event`      | 00067     | PROFILE.CREATED/UPDATED         | profiles                     | permanent_availability, notice_period_days, currently_employed |
| `trg_location_city_from_event`      | 00068     | PROFILE.CREATED/UPDATED         | profiles                     | location_city_id                                               |
| `trg_required_languages_from_event` | 00069     | DAYWORK.POSTED/PERMANENT.POSTED | dayworks, permanent_postings | required_languages                                             |

Note: `trg_career_status_from_event` is **redundant** — `apply_projection` in migration 00059 already writes `permanent_availability`, `notice_period_days`, `currently_employed` in the PROFILE.UPDATED handler (lines 271-273). The trigger is a duplicate write.

**Migration 00072: `CREATE OR REPLACE FUNCTION apply_projection(...)` with all 6 trigger handlers folded in:**

- [x] Start from the 00059 version of `apply_projection` (552 lines). Diff carefully
- [x] PROFILE.CREATED: added 6 new columns
- [x] PROFILE.UPDATED: added 3 new SET clauses (career status already present)
- [x] EXPERIENCE.ADDED: added sea_time_days + sea_time_nautical_miles
- [x] EXPERIENCE.UPDATED: added sea_time coalesce SET clauses
- [x] DAYWORK.POSTED: added required_languages
- [x] PERMANENT.POSTED: added required_languages
- [x] Dropped all 6 triggers and functions
- [x] Rollback 00072 restores 00059 version + recreates all 6 triggers
- [ ] **Critical verification:** after db reset, run integration tests. Every event type that was handled by a supplementary trigger must still produce the same projection result. Specifically test:
  - PROFILE.CREATED with deck_name + desired_role_id + location_city_id + career status → all columns populated
  - PROFILE.UPDATED with partial payload → only specified columns change, others preserved
  - EXPERIENCE.ADDED with sea_time_days → crew_experiences row has sea_time_days
  - DAYWORK.POSTED with required_languages → dayworks row has required_languages
  - PERMANENT.POSTED with required_languages → permanent_postings row has required_languages

#### 152f — Profile page decomposition (1,632 lines → ~6 components)

Extract the profile page into focused components. The page becomes a thin orchestrator.

- [ ] Create `apps/web/src/app/(app)/profile/_components/` directory
- [ ] Extract `profile-summary-section.tsx` — Summary section (Current Role, Experience, Vessel Size Exposure, Nationality). Props: profile, experiences, computeTotalExperience result
- [ ] Extract `profile-looking-for-section.tsx` — Looking For section (Desired Role, Location, Career Status inline edit, Daywork Availability). Props: profile, availability state, career status state + handlers, overlay trigger
- [ ] Extract `profile-about-section.tsx` — About section (Deck Name, Bio, Certs, Visas, Languages). Props: profile, language labels resolver
- [ ] Extract `profile-experience-section.tsx` — Experience section (experience cards with expand/collapse, add/edit/delete). Props: experiences, handlers (delete, expand toggle)
- [ ] Extract `profile-edit-form.tsx` — Full edit mode form (all editable fields). Props: all edit state + setters, lookup data (roles, certs, visas, nationalities, languages), save handler
- [ ] Extract `agent-profile-section.tsx` — Agent-specific section (Agency Info collapsible). Props: profile, editing state
- [ ] Page orchestrator keeps: state management, data fetching, localStorage persistence, visibilitychange listener, overlay triggers. Passes state + handlers down as props
- [ ] **No behavior changes** — pure refactor, identical rendering. Verify with visual diff before/after

#### 152g — Discover page decomposition (1,793 lines → ~5 components)

Same pattern. The discover page handles too many concerns.

- [ ] Create `apps/web/src/app/(app)/discover/_components/` directory (already exists with permanent components — add daywork ones)
- [ ] Extract `daywork-card.tsx` — Single daywork card rendering (vessel info, rate, certs, languages with green/amber). Props: card data, crew cert/lang IDs
- [ ] Extract `daywork-browse.tsx` — Swipeable card stack + filters + apply-with-message overlay. Props: cards, loading state, filter state, apply handler, swipe handler
- [ ] Extract `applied-tab.tsx` — Unified daywork + permanent applied tab. Props: applications data, withdraw handler
- [ ] Extract `invitations-tab.tsx` — Daywork invitations tab. Props: invitations data, accept/decline handlers
- [ ] Page orchestrator keeps: tab state, data fetching, crew cert/lang loading, agent redirect check. Passes state + handlers to tab components
- [ ] **No behavior changes** — pure refactor

#### 152h — Agent market feed: toggle instead of separate page

**Current:** Agents are redirected from `/discover` to `/discover/market` (a separate 612-line page). This means duplicated card rendering, separate filter logic, and the client-side redirect flash (Fix 151c).

**Suggestion:** Instead of a separate page, make the agent market view a **mode of the discover page** — same URL, different rendering based on `identity_type`. The discover page already has a Daywork/Permanent toggle for crew. For agents, this becomes a **Daywork/Permanent/All toggle** (or just show both merged by default).

**Rationale:**

- Eliminates the redirect problem entirely (Fix 151c becomes unnecessary — no redirect needed)
- Shared filter components, shared card rendering
- Activity logging wired into the shared page (agent-only, triggered by identity check)
- Agent sees the same URL as crew (`/discover`) — simpler navigation model
- The "no apply" behavior is already handled: agent hat has no apply routes, and the discover API returns 403 for agent apply attempts

**Implementation:**

- [ ] In `discover/page.tsx`: detect `identity_type === 'agent'` from the profile fetch (already done for redirect)
- [ ] If agent: render a unified feed (both daywork + permanent merged, sorted by created_at) using shared card components. No swipe — list view like permanent feed. No Apply button. No Invitations tab. No Applied tab
- [ ] If agent: add activity logging on filter change and card view (port `logAgentActivity` from market page)
- [ ] If agent: header shows "Job Market" instead of "Discover". Optional Daywork/Permanent/All toggle
- [ ] Remove `/discover/market/page.tsx` entirely after migration
- [ ] Remove the middleware redirect (Fix 151c) — no longer needed
- [ ] Remove the client-side redirect fallback in discover/page.tsx — no longer needed
- [ ] **Note:** This depends on 152g (discover decomposition) being done first so the page is manageable

**Alternative if you prefer keeping the separate page:** Keep `/discover/market` but share extracted card components from 152g. Fix 151c (middleware redirect) stays needed. Less clean but lower risk.

#### 152i — Avatar route try/catch wrap

Two minor gaps found in the audit.

- [x] Wrapped POST /api/profile/avatar in try/catch
- [x] Wrapped DELETE /api/profile/avatar in try/catch

#### 152j — Language canonical table (optional, low priority)

Languages are hardcoded in a TypeScript constant (20 entries). Every other lookup (roles, certs, ports, etc.) uses a canonical DB table. This is inconsistent and means adding a language requires a code deploy.

- [ ] If the language list is stable at 20: skip this, document the exception in CLAUDE.md
- [ ] If the list will grow: migration to create `languages` lookup table, seed with 20 entries, update profile schema to use `language_ids uuid[]` instead of `languages text[]`, update all APIs and UI. Significant scope — defer unless needed

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

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

---
