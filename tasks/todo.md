# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 5: Profile + Experience — profile view/edit, experience CRUD, vessel management, avatar upload, hat switch

---

## Queue

### Mobile Phase 5: Profile + Experience

**Context:** Profile tab is currently a placeholder. Crew need to view/edit their profile, manage experiences (add/edit/delete with IMO vessel lookup), manage vessels, upload avatars, and switch hats. All writes go through Vercel API routes. Profile reads use `apiGet`. Canonical data hooks from Phase 2 are reused. Form pickers from Phase 3 are reused. UI primitives from Stage 170 must be used throughout.

#### 1. Profile data hooks

- [x] Create `apps/mobile/src/hooks/use-profile.ts` — TanStack Query hook calling `apiGet('/api/profile')`. Returns `{ person, profile }` with all joined fields (roles, nationalities, ports, cities, certs, experience bracket, vessel size exposure). Export the `Profile` type.
- [x] Create `apps/mobile/src/hooks/use-experiences.ts` — TanStack Query hook calling `apiGet('/api/experiences')`. Returns `{ experiences }` with vessel and role joins. Export `Experience` type. Include `invalidate()` method.

#### 2. Profile view screen

- [x] Rebuild `apps/mobile/app/(app)/(tabs)/profile.tsx` — replace placeholder. Sections (collapsible, matching web structure):
  - **Header:** Avatar (with tap-to-upload placeholder), display name, deck name, nationality flag, hat badge
  - **Summary:** Primary role (auto-derived, read-only), experience bracket (auto-derived, read-only), vessel size exposure pills (auto-derived, read-only), location (city + port)
  - **Looking For:** Desired role, permanent availability status, notice period, currently employed
  - **About:** Bio, certifications pills, languages pills, visa pills
  - **Experience:** List of experience cards (expand/collapse, most recent auto-expanded). Each shows: vessel name (M/Y or S/Y prefix), role, date range, flag state, contract type, LOA, size band. Delete button per entry with confirmation dialog.
  - **Agent section** (agent hat only): Agency name, role specializations
- [x] "Edit" button in header opens profile edit screen (item 3)
- [x] "Add Experience" button at bottom of Experience section navigates to add-experience screen (item 5)
- [x] Hat switcher: crew identity can toggle between crew/employer. Calls `apiPost('/api/hat', { hat })`. On success, update auth context person and reload tabs. Agents see hat badge but no toggle.
- [x] Pull-to-refresh on entire profile

#### 3. Profile edit screen

- [x] Create `apps/mobile/app/(app)/profile-edit.tsx` — full-screen edit form using UI primitives. Fields (all optional, partial update):
  - Display name (`FormInput`, max 100 chars)
  - Deck name (`FormInput`, max 50 chars)
  - Bio (`FormInput` multiline, max 250 chars)
  - Desired role (tap opens `FormRolePicker`, single-select)
  - Location city (tap opens city picker from `usePorts()` canonical hook)
  - Location port (tap opens port picker, filtered by selected city)
  - Nationality (tap opens nationality picker — need new picker or searchable list from `GET /api/profile` nationalities data)
  - Visas (tap opens visa picker — multi-select)
  - Certifications (tap opens `FormCertPicker`, multi-select)
  - Languages (tap opens `FormLanguagePicker`, multi-select)
  - Permanent availability (3-way picker: immediate, after_notice, not_looking)
  - Notice period days (numeric input, shown when after_notice selected)
  - Currently employed (boolean toggle)
  - Agent-only: Agency name (`FormInput`)
  - Agent-only: Role specializations (tap opens `FormRolePicker`, multi-select)
- [x] Submit calls `apiPatch('/api/profile', body)`. On success, invalidate profile query and navigate back.
- [x] `ScreenHeader` with Cancel/Save header

#### 4. Nationality + visa pickers

The profile edit needs nationality (single-select from 40 entries) and visa (multi-select from 10 entries) pickers. These don't exist yet.

- [x] Create `apps/mobile/src/hooks/use-nationalities.ts` — added `useNationalities()` to `use-canonical.ts`. Direct Supabase read of `nationalities` table. Infinite staleTime.
- [x] Create `apps/mobile/src/hooks/use-visa-types.ts` — added `useVisaTypes()` to `use-canonical.ts`. Direct Supabase read of `visa_types` table. Infinite staleTime.
- [x] Create `apps/mobile/src/components/form-nationality-picker.tsx` — bottom sheet with searchable list. Shows flag emoji + name. Single-select, returns nationality ID.
- [x] Create `apps/mobile/src/components/form-visa-picker.tsx` — bottom sheet with multi-select pills. Returns array of visa IDs.

#### 5. Add experience screen

- [x] Create `apps/mobile/app/(app)/add-experience.tsx` — full form for adding a crew experience. Flow:
  1. **IMO lookup:** Text input for IMO number. At 4+ digits, call `apiGet('/api/vessels/lookup?imo=${imo}')`. Show matching vessels as selectable cards. If exact match (7 digits), show vessel suggestion with "Use this vessel" button.
  2. **Create vessel (if no match):** Inline vessel creation form (name, IMO, type motor/sail, LOA) — reuse `VesselSelector` component's creation form pattern. Calls `apiPost('/api/vessels')`.
  3. **Experience fields:** Role picker (`FormRolePicker`), start date + end date (date pickers), is current toggle (disables end date), vessel operation (charter/private pills), flag state (searchable text input from `flag_states` table), contract type pills (permanent/rotational/seasonal/crossing/delivery/temporary), contract details (textarea, shown for non-permanent), description (textarea, max 250), sea time days (numeric), sea time nautical miles (numeric).
  4. **Salary (private intelligence):** Salary amount (numeric), currency (pill selector), period (daily/monthly/annually). Label: "Private — not shown to employers".
  5. Submit calls `apiPost('/api/experiences', body)`. On success, invalidate experiences + profile queries, navigate back to profile.
- [x] Validation: vesselId + roleId + startDate + vesselOperation required. End date >= start date. Contract details max 100. Description max 250. Agent: endDate required, isCurrent blocked.
- [x] `ScreenHeader` with "Add Experience" title

#### 6. Edit experience screen

- [x] Create `apps/mobile/app/(app)/edit-experience/[id].tsx` — same form as add-experience, pre-populated with existing data. Load experience by ID from the experiences hook.
- [x] Submit calls `apiPatch('/api/experiences/${id}', body)`. On success, invalidate experiences + profile queries, navigate back.
- [x] Delete button at bottom: confirmation dialog, then `apiDelete('/api/experiences/${id}')`. On success, invalidate and navigate back.
- [x] `ScreenHeader` with "Edit Experience" title

#### 7. Vessel management screen

- [x] Create `apps/mobile/app/(app)/vessels.tsx` — list of user's vessels. Reuse `useVessels()` hook from Phase 3. Each card shows: M/Y or S/Y prefix + name, IMO, LOA, size band, NDA badge. Tap navigates to vessel edit.
- [x] "Add Vessel" button at bottom — placeholder alert pointing to post form vessel selector.
- [x] Link from profile header (employer/agent hat) or from "More" tab — linked from profile view.

#### 8. Edit vessel screen

- [x] Create `apps/mobile/app/(app)/vessels/[id]/edit.tsx` — edit form for existing vessel. Fields: name, vessel type (motor/sail), LOA. IMO is read-only (immutable). NDA flag warning (immutable once set). Submit calls `apiPatch('/api/vessels/${id}', body)`. On success, invalidate vessels query, navigate back.

#### 9. Avatar upload

- [x] Add avatar tap handler on profile view: opens `expo-image-picker` (camera or gallery). After selection, upload to `POST /api/profile/avatar` as multipart form-data. The API returns `{ avatar_url }`. Invalidate profile query to show new avatar.
- [x] Install `expo-image-picker` — installed via `npx expo install expo-image-picker`.
- [x] Add delete avatar option (long-press): calls `apiDelete('/api/profile/avatar')` with confirmation dialog.

#### 10. Flag state picker

Experiences need a flag state selector. 39 entries in the `flag_states` table.

- [x] Create `apps/mobile/src/hooks/use-flag-states.ts` — added `useFlagStates()` to `use-canonical.ts`. Direct Supabase read of `flag_states` table. Infinite staleTime.
- [x] Create `apps/mobile/src/components/form-flag-state-picker.tsx` — bottom sheet with searchable text filter. Single-select, returns flag state name (string, not ID — the experience API accepts `flagState` as a string).

#### 11. API utility: apiPatch

The profile and experience PATCH routes use HTTP PATCH. Mobile's `api.ts` only has GET, POST, DELETE.

- [x] Add `apiPatch<T>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>>` to `apps/mobile/src/lib/api.ts` — same pattern as `apiPost` but with `method: 'PATCH'`.

#### 12. Phase 5 verification

- [x] `turbo run type-check` passes
- [ ] Profile view shows all sections with real data
- [ ] Profile edit saves changes, reflected on return to profile
- [ ] Add experience with IMO lookup → vessel suggestion → experience creation works
- [ ] Edit experience pre-populates and saves
- [ ] Delete experience with confirmation works
- [ ] Vessel list shows user's vessels
- [ ] Vessel edit saves changes (name, type, LOA)
- [ ] NDA flag cannot be unset once set
- [ ] Avatar upload from gallery works, displayed on profile
- [ ] Hat switch works (crew ↔ employer), tabs update
- [ ] Agent cannot switch hats
- [ ] Auto-derived fields (primary role, experience bracket, vessel size exposure) update after experience add/edit/delete
- [ ] All new screens use UI primitives from `components/ui/` — zero inline `#2563eb`
- [ ] Web app completely unaffected

---

### Quick wins — production deploy (user action)

- [ ] Deploy migrations 00076 + 00077 to production Supabase

---

## Backlog

> Active backlog. Pick items into Queue when ready. Items tagged (web), (mobile), or (both).
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** (both) — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert. Full spec in git history.
- **Onboarding true atomicity** (both) — `onboard_person` RPC should be fully atomic; currently partial failure is possible on batch experience inserts.
- **Negotiation timeout** (both) — auto-close permanent engagements after X days of inactivity in negotiation. Server-side cron.
- **Weekly check-in cron** (both) — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** (both) — force session invalidation when `PERSON.DEACTIVATED` fires.

### Web-only UI

- **OG social sharing image** (web) — see `tasks/founder-drafts.md` § 7 for spec.
- **Agent market as discover mode** (web) — let agents browse the full market feed, not just their own postings.
- **Form validation — styled inline errors** (web) — replace browser-native validation with styled inline messages (SUG-012).
- **Invalid URL error pages** (web) — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** (web) — seed data shows "Unknown vessel" for employer-owned vessels in crew experience edit (SUG-017).
- **Applicant count badge on My Jobs** (both) — show pending applicant count on posting cards in My Jobs.
- **Discover filter chips** (both) — show active filters as dismissible pills above the feed.
- **Notifications grouping** (both) — group notifications by date or engagement instead of flat list.
- **Email: List-Unsubscribe header** (web) — add RFC 8058 header to transactional emails.

### Testing

- **Resilience tests** (web) — network failure, timeout, and retry scenarios for API routes.
- **Component tests for Permanent UI** (web) — unit tests for permanent posting components.
- **Component tests for Form Pickers** (web) — unit tests for hierarchical pills, location picker, role picker.

### Superseded by mobile split

- ~~Billing IAP bypass redesign~~ — replaced by `tasks/mobile-web-split-spec.md` Section 10.
- ~~Swipe card momentum~~ — mobile builds native swipe from scratch; web swipe stays as-is.
- ~~Haptics on toggles/filters~~ — Capacitor haptics are dead; mobile uses `expo-haptics` natively.

---

## Done

(See git history for completed stages 51-170, all fix batches. Mobile Phases 1-4 complete + UI primitives extraction + adoption across all 28 files. Fix 169: API field mismatches. Fix 165b: pre-Phase 3 audit. CLAUDE.md + BUILD_STATE.md modernisation.)
