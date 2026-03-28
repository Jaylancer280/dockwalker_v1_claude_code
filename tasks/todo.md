# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 3: Employer Flows — post jobs, my jobs, review applicants, templates

---

## Queue

### 0. Remaining audit fix

#### 0e. Person type cast masks missing columns

`apps/mobile/src/lib/auth-context.tsx:58` — `setPerson(data as Person)` casts a 3-column query result to the full `Person` type (5 fields). `created_at` and `deactivated_at` are `undefined` at runtime but TypeScript thinks they're `string` and `string | null`. If future code accesses `person.created_at`, no type error — just a runtime crash.

- [x] Changed `person` state type to `Pick<Person, 'id' | 'current_hat' | 'identity_type'> | null` in auth-context.tsx. Update `AuthContextValue.person` to match. Remove the `as Person` cast on line 58 (the query return type should now satisfy the Pick).

---

### 1. Vessel selector + shared form components

**Context:** Both post forms and review screens need a vessel selector and form pickers. Build these first. All writes go through Vercel API routes.

#### 1a. Vessel selector

- [x] Created `use-vessels.ts`` — TanStack Query hook, direct Supabase read of `vessels`table where`owner_person_id = user.id`. Returns list of user's vessels with name, type, size band, NDA flag.
- [x] Created `vessel-selector.tsx`` — bottom sheet listing user's vessels as selectable cards (M/Y or S/Y prefix, name, size band). "Add vessel" button at bottom opens inline vessel creation form (name, IMO, vessel type motor/sail, LOA). Vessel creation calls `apiPost('/api/vessels')`.

#### 1b. Form picker components

Mobile-native versions of the web's form pickers. Reuse canonical data hooks from Phase 2.

- [x] Created `form-role-picker.tsx`.tsx`— bottom sheet with hierarchical department → role selection. Uses`useRoles()`canonical hook +`rolesToGroups()`from`@dockwalker/shared`. Single-select, returns role ID.
- [x] Created `form-location-picker.tsx`.tsx`— bottom sheet with region → city → port drill-down. Uses`usePorts()` canonical hook. Returns port ID.
- [x] Created `form-cert-picker.tsx`.tsx`— bottom sheet with multi-select cert pills grouped by category. Uses`useCertifications()`. Returns array of cert IDs.
- [x] Created `form-language-picker.tsx`.tsx`— bottom sheet with multi-select language pills. Uses`LANGUAGES`from`@dockwalker/shared`. Returns array of language codes.

---

### 2. Tab navigator update (hat-conditional)

**Context:** Employer/agent hat needs the My Jobs tab visible before anything else in Phase 3 can be navigated to. This is a prerequisite for all employer screens.

- [x] Tab layout conditionally show "Discover" tab for crew hat, "My Jobs" tab for employer/agent hat. Both tabs exist in the file system but only the relevant one shows in the tab bar based on `person.current_hat`. Crew sees: Discover, Messages, Profile, Notifications, More. Employer/agent sees: My Jobs, Messages, Profile, Notifications, More.

---

### 3. My Jobs screen

**Context:** Employer's job management hub. Everything else in Phase 3 navigates from here. Reads via Vercel API (mine routes have complex aggregation). Reference: web's `apps/web/src/app/(app)/daywork/mine/page.tsx`.

#### 3a. API utility + My Jobs data hooks

- [x] Added `apiGet`<T>(path: string): Promise<ApiResult<T>>`to`apps/mobile/src/lib/api.ts`— same auth pattern as`apiPost` (Bearer token, 15s timeout, safe JSON parsing). Multiple hooks in Phase 3 depend on this.
- [x] Created `use-my-dayworks`.ts`— TanStack Query hook calling`apiGet('/api/daywork/mine')`. Returns daywork postings with status, positions_available, positions_filled, role/port/vessel joins.
- [x] Created `use-my-permanent`.ts`— TanStack Query hook calling`apiGet('/api/permanent/mine')`. Returns permanent postings with status, applicant_count, shortlist_count, selected_crew_name, role/port/vessel joins.

#### 3b. My Jobs screen with tabs

- [x] Created `my-jobs.tsx`` — replaces the placeholder. Tab layout with segments: Active, In Progress, Done, Templates
- [x] **Active tab:** FlashList of active daywork + permanent postings. Each card shows: job reference, role, vessel, dates/salary, positions, applicant count badge. Tap navigates to review screen. Filter: daywork `status === 'active'` with `positions_filled < positions_available`; permanent `status === 'active'`.
- [x] **In Progress tab:** Daywork postings where `positions_filled > 0` (crew accepted, engagements running). Permanent postings where `status === 'in_negotiation'` (candidate selected). Card shows "Go to chat" linking to messages.
- [x] **Done tab:** Daywork with `status === 'closed'`. Permanent with `status === 'closed'`. Reduced opacity. Read-only.
- [x] **Templates tab:** Placeholder list for now — template CRUD wired in item 9.
- [x] Pull-to-refresh on all tabs
- [x] "Post" header button action button or header button — navigates to post type selector (item 4)

---

### 4. Post type selector

**Context:** Entry point to posting — user chooses daywork or permanent. Navigated to from the "Post" button on My Jobs.

- [x] Created `post.tsx` choice screen with two large cards: "Daywork — Short-term cover, 1-14 days" and "Permanent — Long-term position, structured hiring". Tapping navigates to the respective form.
- [x] Hat guard: crew redirected to discover

---

### 5. Post daywork form

**Context:** Employer/agent posts a daywork job. All fields match the web form. Submits to `POST /api/daywork`. Reference: web's `apps/web/src/app/(app)/daywork/post/page.tsx`.

- [ ] Create `apps/mobile/app/(app)/post-daywork.tsx` — scrollable form wrapped in `KeyboardAwareScrollView` (from `react-native-keyboard-controller`). Fields:
  - Vessel selector (required)
  - Role picker (required)
  - Location picker (required)
  - Start date + end date (date pickers)
  - Working days (numeric input)
  - Day rate (numeric input) + currency selector (EUR/USD/GBP/AED)
  - Required certs (multi-select picker)
  - Required languages (multi-select picker)
  - Experience bracket (single-select)
  - Meals (checkboxes: breakfast, lunch, dinner)
  - Notes (textarea)
  - Positions available (numeric input, 1-20)
  - Permanent opportunity toggle
- [ ] "Load from template" button at top — opens template selector bottom sheet (wired in item 9)
- [ ] Submit calls `apiPost('/api/daywork', body)` — on success, navigate back to My Jobs
- [ ] Validation: required fields enforced before submit, working days <= date span
- [ ] Hat guard: only employer/agent hat can access

**Deliberately omitted for mobile:** `workingDayDates` (optional per-day date selection). The API accepts it but mobile uses the simpler working days count only.

---

### 6. Post permanent form

**Context:** Employer/agent posts a permanent job. Submits to `POST /api/permanent`. Reference: web's `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx`.

- [ ] Create `apps/mobile/app/(app)/post-permanent.tsx` — scrollable form in `KeyboardAwareScrollView`. Fields:
  - Vessel selector (required)
  - Role picker (required)
  - Location picker (required)
  - Start date
  - Salary min + max (numeric inputs) + currency + period (monthly/annual)
  - Live aboard toggle
  - Required certs (multi-select)
  - Required languages (multi-select)
  - Experience bracket (single-select)
  - Shortlist cap (numeric, default 5)
  - Contract type selector (permanent/rotational/seasonal/crossing/delivery/temporary)
  - Contract details (textarea, shown for non-permanent types)
  - Description (textarea)
  - Meals (checkboxes)
  - Positions available (numeric, 1-20)
  - Notes (textarea)
- [ ] "Load from template" button at top (wired in item 9)
- [ ] Submit calls `apiPost('/api/permanent', body)` — on success, navigate back to My Jobs
- [ ] Validation: required fields enforced, salary max >= salary min
- [ ] Hat guard: only employer/agent hat can access

---

### 7. Review applicants — daywork

**Context:** Employer reviews applicants for a daywork posting. Swipe stack reuses `SwipeCardStack` from Phase 2. Navigated to from My Jobs active card tap. Reference: web's `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`.

#### 7a. Applicants data hook

- [ ] Create `apps/mobile/src/hooks/use-daywork-applicants.ts` — TanStack Query hook calling `apiGet('/api/daywork/${id}/applicants')`. Returns `{ applicants, positions_available, positions_filled, positions_remaining }`. Applicant profiles are nested under `.profiles` with FK joins (yacht_roles, experience_brackets, ports, nationalities).

#### 7b. Applicant card

- [ ] Create `apps/mobile/src/components/applicant-card.tsx` — card showing: display name, avatar (via `expo-image`), role, experience bracket, certs held as pills, availability days, location, application message preview, "Applied X ago" timestamp. Department color bar matching the role.

#### 7c. Review screen

- [ ] Create `apps/mobile/app/(app)/daywork/[id]/review.tsx` — dynamic route screen. Tabs: Applicants (to review) | Shortlisted.
- [ ] **Applicants tab:** `SwipeCardStack` with applicant cards. Swipe right = accept (confirmation dialog first). Swipe left = reject (confirmation dialog). Swipe up = shortlist. Accept calls `apiPost('/api/daywork/${id}/applicants/${crewId}/accept')`. Reject calls `...reject`. Shortlist calls `...shortlist`.
- [ ] **Auto-view:** When an applicant card becomes the top card in the stack, fire `apiPost('/api/daywork/${id}/applicants/${crewId}/view')` to transition `applied → viewed`. This keeps mobile and web review state in sync.
- [ ] **Shortlisted tab:** FlashList of shortlisted applicants. Each card has Accept + Reject buttons (same API calls with confirmation dialogs).
- [ ] Accept confirmation dialog: "Accept {name} for {role}? This will open a message thread."
- [ ] Reject confirmation dialog: "Reject {name}? This cannot be undone."
- [ ] After accept: show success message and navigate back to My Jobs (chat built in Phase 4)
- [ ] Positions remaining indicator at top: "{filled}/{total} positions filled"

---

### 8. Review applicants — permanent

**Context:** Employer reviews applicants for a permanent posting. Scrollable list, not swipe. Navigated to from My Jobs active card tap. Reference: web's `apps/web/src/app/(app)/permanent/[id]/review/page.tsx`.

#### 8a. Permanent applicants data hook

- [ ] Create `apps/mobile/src/hooks/use-permanent-applicants.ts` — TanStack Query hook calling `apiGet('/api/permanent/${id}/review')`. **Note: the endpoint is `/review`, NOT `/applicants`.** Returns `{ applicants, shortlist_cap, shortlist_count, posting_status, selected_crew_id }`. Unlike daywork, profile fields are flattened into the top level (e.g. `display_name`, `role_name`, `certification_ids` — not nested under `.profiles`).

#### 8b. Review screen

- [ ] Create `apps/mobile/app/(app)/permanent/[id]/review.tsx` — dynamic route screen. Tabs: Applicants | Shortlisted.
- [ ] **Applicants tab:** FlashList of applicants (status `applied`). Each card shows profile data + application message + permanent_availability + notice_period_days. Buttons: Shortlist, Reject (with confirmation dialogs). Shortlist calls `apiPost('/api/permanent/${id}/applicants/${crewId}/shortlist')`. Reject calls `...reject`.
- [ ] **Shortlisted tab:** FlashList of shortlisted applicants. "Select" button (only if `posting_status === 'active'` — i.e. no candidate currently selected). Select calls `apiPost('/api/permanent/${id}/applicants/${crewId}/select')` with confirmation: "Select {name} for negotiation? This will open a message thread."
- [ ] Shortlist cap indicator: "{shortlist_count}/{shortlist_cap} shortlisted"
- [ ] Banner when `selected_crew_id` is non-null: "Currently in negotiation with {name}"

---

### 9. Template management

**Context:** Load and save templates for repeat posting. Wires into the "Load from template" buttons on post forms and the Templates tab on My Jobs. Depends on items 3 (My Jobs), 5 (daywork form), 6 (permanent form).

- [ ] Create `apps/mobile/src/hooks/use-templates.ts` — TanStack Query hooks: `useDayworkTemplates()` calling `apiGet('/api/daywork/templates')`, `usePermanentTemplates()` calling `apiGet('/api/permanent/templates')`.
- [ ] Template selector bottom sheet: opened from "Load from template" on post forms. Lists templates by name with role and location summary. Tap loads template data into the form fields. The list response includes all fields — no need to fetch individual templates by ID.
- [ ] Save as template: after filling a post form, "Save as template" button. Prompts for template name, calls `apiPost('/api/daywork/templates')` or `apiPost('/api/permanent/templates')`. **Important:** daywork templates must NOT include vesselId (per lessons.md — vessel selection is per-posting). Permanent templates CAN include vesselId.
- [ ] Wire Templates tab in My Jobs (item 3b): list of daywork + permanent templates. Tap to load into post form. Delete with confirmation dialog. Calls `apiDelete('/api/daywork/templates/${id}')` or `apiDelete('/api/permanent/templates/${id}')`.
- [ ] Template editing (PATCH) is deliberately deferred — save-new and delete only for mobile MVP.

---

### 10. Phase 3 verification

- [ ] `turbo run type-check` passes for all workspaces
- [ ] Post daywork form submits successfully — new posting appears in My Jobs Active tab
- [ ] Post permanent form submits successfully
- [ ] My Jobs shows active/in-progress/done/templates tabs with correct data
- [ ] Daywork review: swipe to accept/reject/shortlist works with confirmation dialogs
- [ ] Permanent review: shortlist/select flow works with cap indicator visible
- [ ] Templates: load into form, save from form, delete with confirmation
- [ ] Hat guard: crew hat cannot see post button or My Jobs tab
- [ ] Web app completely unaffected

---

### 11. Quick wins — production deploy (user action)

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

(See git history for completed stages 51-165, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 monorepo + shell + auth, mobile Phase 2 discovery + swipe + Fix 165)
