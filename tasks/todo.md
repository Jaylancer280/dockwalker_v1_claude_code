# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### URGENT — Public job page still crashing ("Something went wrong")

> Self-fetch was replaced with direct `getPublicJob()` query. Both commits are on `origin/main` and deployed. The page still crashes — "Something went wrong" is a React error boundary, meaning the server component throws during rendering.
>
> **Most likely cause:** `SUPABASE_SERVICE_ROLE_KEY` is not set in Vercel env vars. The `createServiceClient()` function uses `process.env.SUPABASE_SERVICE_ROLE_KEY!` — if the env var is missing, it creates a client with `undefined` key, which crashes on the first query.

- [x] USER confirmed: `SUPABASE_SERVICE_ROLE_KEY` IS set in Vercel. Not the cause.
- [x] Add `apps/web/src/app/jobs/[jobNumber]/error.tsx` — client error boundary that logs `console.error('Public job page error:', error)` and shows a user-friendly message. This will surface the actual crash reason in Vercel runtime logs.
- [ ] Push, open the share link, read the error in Vercel logs.

---

### Date format inconsistency — native date inputs show mixed dd/mm and mm/dd

> `<input type="date">` uses browser locale for display format. Start date shows dd/mm/yyyy, end date shows mm/dd/yyyy on some browsers — inconsistent and confusing. Affects all posting forms (daywork post, permanent post, experience add/edit).
>
> **Fix:** Replace all `<input type="date">` with a custom date input component that enforces dd/mm/yyyy display. The internal value stays `YYYY-MM-DD` (ISO) — only the display changes.

- [x] Create `apps/web/src/components/ui/date-input.tsx` — a controlled text input that:
  - Displays in `dd/mm/yyyy` format
  - Accepts keyboard input with auto-formatting (e.g., typing "14" auto-inserts "/")
  - Opens a native date picker on mobile via a hidden `<input type="date">` companion (for tap-to-pick UX)
  - Value prop/onChange use ISO `YYYY-MM-DD` format (no API changes needed)
- [x] **NOTE:** Working days counter miscalculation is likely caused by this same issue — user sets wrong date due to confusing mm/dd display, working days calculates from the wrong date. Verify after the date input fix: set start=14 Apr, end=16 Apr → should show 3 working days.
- [x] Replace all `<Input type="date">` across:
  - `apps/web/src/app/(app)/daywork/post/page.tsx` (start date, end date ~lines 483, 493)
  - `apps/web/src/app/(app)/daywork/post/_components/permanent-form-sections.tsx` (start date ~line 97)
  - `apps/web/src/app/(app)/profile/add-experience/page.tsx` (start date, end date) — uses shared `experience-details-section.tsx`
  - `apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx` (start date, end date) — uses shared `experience-details-section.tsx`
  - `apps/web/src/app/onboarding/_components/vessel-experience-step.tsx` (start date, end date)
  - `apps/web/src/app/(app)/discover/_components/daywork-browse.tsx` (filter dates)
  - `apps/web/src/app/(app)/messages/[engagementId]/_components/postponement-form-overlay.tsx` (postponement dates)

---

### Permanent job card height mismatch in 2-column grid

> Cards with many certs are taller than cards with few. The `lg:grid lg:grid-cols-2` layout doesn't equalise row heights. Cards in the same row look mismatched.

- [x] In `apps/web/src/app/(app)/discover/_components/permanent-job-card.tsx`: truncate required certs to max 3 pills. If more exist, show a "+X more" badge after the 3rd. Same for required languages (max 2 + "+X more").
- [x] In `apps/web/src/app/(app)/discover/_components/permanent-job-feed.tsx` (~line 366): add `items-start` to the grid container so shorter cards align to the top (not stretch). Or use `grid-auto-rows: 1fr` if equal-height rows look better.
- [x] Check daywork mine cards and applied cards for the same pattern — truncate consistently everywhere.

---

### Agent profile overlay is bare compared to employer overlay

> The profile overlay uses `CrewProfileView` for agents. It shows crew-specific fields (certs, vessel exposure, availability) but is missing agent-specific fields. The employer overlay has a dedicated `EmployerProfileView` with agency, vessels, postings. Agents need similar treatment.

- [ ] In `apps/web/src/components/profile-overlay.tsx`: add an `AgentProfileView` component (or extend `EmployerProfileView` for agents). Should show:
  - Agency name
  - Nickname
  - Placement locations (cities)
  - Role specializations (department-grouped pills)
  - Active posting count
  - Bio
  - Maritime background count (e.g., "3 years maritime experience")
- [ ] The view-only profile API (`/api/profile/[personId]`) already returns these fields for agents — verify and extend if any are missing.
- [ ] The profile overlay's `identity_type` check must route agents to `AgentProfileView` (not `CrewProfileView`).

---

### Agent placement locations — drill-down Region → City pills

> Migration 00086 created `agent_placement_cities` table. Current UI (if any) is flat. The full list of all cities is too long for a flat select. Needs a drill-down: Region → Cities within that region. Same UX pattern as `HierarchicalPills` + `rolesToGroups()` but for geography.

- [x] Create `citiesToGroups()` helper (in `@dockwalker/shared` or `apps/web/src/lib/`) — groups cities by region. Input: cities with `region_id` join. Output: `{ groupId, groupLabel (region name), items: [{ id: city.id, label: city.name }] }[]`
- [x] Use `HierarchicalPills` with `citiesToGroups()` in multi-select mode for placement locations on:
  - Profile edit form (agent branch)
  - Onboarding (agent placement step)
- [x] Agent profile section + overlay: display selected placement cities as pills grouped by region

---

### Rename agent "Role specialisations" → "Department specialisations" + show pills not count

> Two issues: (a) Label says "Role specialisations" but should be "Department specialisations" — agents place across departments, not individual roles. (b) The agent profile page shows only `"X specialization(s)"` count (lines 82-83, 121-125 of `agent-profile-section.tsx`) instead of the actual department pills. The roles are stored as IDs but the display should resolve them to department names and show as pills.

- [x] Rename all agent-facing labels from "Role specialisations" to "Department specialisations" across:
  - Profile page (`agent-profile-section.tsx`)
  - Profile edit form (`profile-edit-form.tsx`)
  - Onboarding (`profile-step.tsx`)
  - Profile overlay (`profile-overlay.tsx` — when adding agent view)
- [x] In `agent-profile-section.tsx`: replace the count text (`"X specialization(s)"`) with actual department pills. Resolve `role_specialization_ids` → role objects → extract unique department names → render as pills. Use the `LookupsProvider` roles data to resolve IDs to names/departments. Show department-level pills (e.g., "Deck", "Engineering"), not individual role names.

---

### Add department filter to agent market feed

> The market filter panel (`apps/web/src/app/(app)/discover/market/_components/market-filter-panel.tsx`) has role, location, and certification filters. No department filter. Since roles have a `department` field, add a department dropdown that filters the roles shown (cascading filter).

- [ ] In `market-filter-panel.tsx`: add a "Department" dropdown above the "Role" dropdown. Options: All departments, Deck, Interior, Engineering, Galley, Bridge (from the 5 canonical departments).
- [ ] When a department is selected, filter the roles dropdown to only show roles in that department. When "All departments" is selected, show all roles.
- [ ] Pass `filterDepartment` + `setFilterDepartment` props from the parent `market-feed.tsx`. The API query should also filter by department if set (or filter client-side since roles already have department).

---

### Permanent mine tabs misaligned — use shadcn Tabs component

> The permanent mine section (`apps/web/src/app/(app)/daywork/mine/_components/permanent-mine-section.tsx` lines 159-173) uses custom inline `<button>` elements for tabs — left-aligned with `flex overflow-x-auto shrink-0`. The daywork mine tabs use shadcn `Tabs`/`TabsList`/`TabsTrigger` (page.tsx lines 536-555) with `w-full` and `flex-1` — evenly stretched. The permanent tabs should match.

- [x] In `permanent-mine-section.tsx`: replace the custom tab buttons (lines 159-173) with shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` components. Use `<TabsList className="w-full">` and `<TabsTrigger className="flex-1">` — same pattern as the daywork mine page.
- [x] Check employer hat AND agent hat — both should show the same tab UI.

---

### Agent profile fixes — remaining diagnostics

**Issue — Agent maritime history cards are bare + not expandable:**

> The agent profile renders experience entries as plain `<div>` cards showing only vessel name + role + date. The crew profile uses `ProfileExperienceSection` with expandable cards, M/Y/S/Y prefix, operation badge, epaulette badge, expand/collapse, detail section, edit/delete buttons. Agent should reuse the same component.

- [ ] In `apps/web/src/app/(app)/profile/_components/agent-profile-section.tsx`: replace the inline experience rendering (lines 242-256) with the shared `ProfileExperienceSection` component. Pass the same props: `experiences`, `expandedSections`, `toggleSection`, `expandedExpId`, `setExpandedExpId`, `onAddExperience`, `onEditExperience`, `confirmDeleteExpId`, `setConfirmDeleteExpId`, `handleDeleteExperience`, `deletingExpId`.
- [ ] The `AgentProfileSection` needs to accept and forward these props from the parent `profile/page.tsx`. Check what the crew profile passes to `ProfileExperienceSection` (~line 654-666) and replicate for the agent branch.
- [ ] Remove the inline maritime history section from `AgentProfileSection` (the custom button + bare cards + empty state). Let `ProfileExperienceSection` handle it — it already has the empty state CTA.

---

**Issue 1 — Vessel creation not saving (needs debugging):**

> The vessel POST API has no hat restriction — agents can create vessels. The route accepts agent requests. Problem is likely in the downstream event append or RLS. Needs console.error diagnostic.

- [ ] Add `console.error` to `apps/web/src/app/api/vessels/route.ts` POST handler — log the full error from `appendEvent` and the supabase insert. Deploy, reproduce the issue as an agent, read Vercel logs.
- [ ] Check: does the `events` CHECK constraint include the aggregate type used for vessel creation? (`vessel` should be in the CHECK)
- [ ] Check: does `vessels` RLS allow agent inserts? (Agents are authenticated, but the INSERT policy may restrict to specific identity types)

**Issue 1 revised — Vessel fuzzy search doesn't save (manual entry works):**

> Selecting an existing vessel from the IMO fuzzy search doesn't save. Manually entering a new vessel works. The bug is likely in the "select existing vessel" code path — the vessel ID from the search result may not be passed correctly to the form/API.

- [ ] In the vessel form (on profile vessels page + post-job form): trace the "select from search results" flow. When a user picks an existing vessel from the IMO lookup, what value is submitted? Is the `vessel_id` being sent to the API, or is it trying to create a new vessel with the searched data?
- [ ] Add `console.error` to the vessel POST route to see what payload arrives for search-selected vs manual entry
- [ ] Check: does the vessel selector distinguish between "use existing vessel by ID" vs "create new vessel with these fields"?

---

### Admin identity type change (deferred — medium-high effort)

> `identity_type` is immutable by design. Changing it requires: new event type (`PERSON.IDENTITY_TYPE_CHANGED`), projection handler, hat correction, agent data validation, JWT cache invalidation. 24+ routes check identity_type. NOT a self-service feature — admin-only to prevent abuse.
>
> **Scope when built:**
>
> - Admin API route: `POST /api/admin/users/[personId]/change-identity` — validates preconditions (agency_name for crew→agent), appends event, forces hat to valid value
> - Migration: new event handler in `apply_projection` — updates persons + profiles identity_type, corrects current_hat
> - Settings page: "Wrong account type? Contact support" text — NOT a self-service button
> - Cleanup: delete/archive agent_placement_cities when agent→crew, require agency_name when crew→agent

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-200. Stages 185-200: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard, tier messaging, smoker/tattoos, Available Crew Pro gate + tests, invitation direct hire, share job to social, agent profile + UX fixes.)
