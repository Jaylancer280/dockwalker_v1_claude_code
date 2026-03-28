# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 3: Employer Flows — post jobs, my jobs, review applicants, templates

---

## Queue

### 5. Post daywork form

**Context:** Employer/agent posts a daywork job. All fields match the web form. Submits to `POST /api/daywork`. Reference: web's `apps/web/src/app/(app)/daywork/post/page.tsx`.

- [x] Created `post-daywork.tsx`` — scrollable form wrapped in `KeyboardAwareScrollView`(from`react-native-keyboard-controller`). Fields:
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
- [x] "Load from template" placeholder (wired in item 9)
- [x] Submit calls `apiPost("/api/daywork", body)`)` — on success, navigate back to My Jobs
- [x] Validation: required fields, working days <= date span <= date span
- [x] Hat guard: crew redirected to discover

**Deliberately omitted for mobile:** `workingDayDates` (optional per-day date selection). The API accepts it but mobile uses the simpler working days count only.

---

### 6. Post permanent form

**Context:** Employer/agent posts a permanent job. Submits to `POST /api/permanent`. Reference: web's `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx`.

- [x] Created `post-permanent.tsx`` — scrollable form in `KeyboardAwareScrollView`. Fields:
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
- [x] "Load from template" placeholder (wired in item 9)
- [x] Submit calls `apiPost("/api/permanent", body)`)` — on success, navigate back to My Jobs
- [x] Validation: required fields, salary max >= min
- [x] Hat guard: crew redirected to discover

---

### 7. Review applicants — daywork

**Context:** Employer reviews applicants for a daywork posting. Swipe stack reuses `SwipeCardStack` from Phase 2. Navigated to from My Jobs active card tap. Reference: web's `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`.

#### 7a. Applicants data hook

- [x] Created `use-daywork-applicants.ts`.ts`— TanStack Query hook calling`apiGet('/api/daywork/${id}/applicants')`. Returns `{ applicants, positions_available, positions_filled, positions_remaining }`. Applicant profiles are nested under `.profiles` with FK joins (yacht_roles, experience_brackets, ports, nationalities).

#### 7b. Applicant card

- [x] Created `applicant-card.tsx`` — card showing: display name, avatar (via `expo-image`), role, experience bracket, certs held as pills, availability days, location, application message preview, "Applied X ago" timestamp. Department color bar matching the role.

#### 7c. Review screen

- [x] Created daywork review screen` — dynamic route screen. Tabs: Applicants (to review) | Shortlisted.
- [x] **Applicants tab:** SwipeCardStack with applicant cards. Swipe right = accept (confirmation dialog first). Swipe left = reject (confirmation dialog). Swipe up = shortlist. Accept calls `apiPost('/api/daywork/${id}/applicants/${crewId}/accept')`. Reject calls `...reject`. Shortlist calls `...shortlist`.
- [x] **Auto-view:** When an applicant card becomes the top card in the stack, fire `apiPost('/api/daywork/${id}/applicants/${crewId}/view')` to transition `applied → viewed`. This keeps mobile and web review state in sync.
- [x] **Shortlisted tab:** FlashList of shortlisted applicants. Each card has Accept + Reject buttons (same API calls with confirmation dialogs).
- [x] Accept confirmation dialog: "Accept {name} for {role}? This will open a message thread."
- [x] Reject confirmation dialog: "Reject {name}? This cannot be undone."
- [x] After accept: show success message and navigate back to My Jobs (chat built in Phase 4)
- [x] Positions remaining indicator at top: "{filled}/{total} positions filled"

---

### 8. Review applicants — permanent

**Context:** Employer reviews applicants for a permanent posting. Scrollable list, not swipe. Navigated to from My Jobs active card tap. Reference: web's `apps/web/src/app/(app)/permanent/[id]/review/page.tsx`.

#### 8a. Permanent applicants data hook

- [x] Created `use-permanent-applicants.ts`.ts`— TanStack Query hook calling`apiGet('/api/permanent/${id}/review')`. **Note: the endpoint is `/review`, NOT `/applicants`.** Returns `{ applicants, shortlist_cap, shortlist_count, posting_status, selected_crew_id }`. Unlike daywork, profile fields are flattened into the top level (e.g. `display_name`, `role_name`, `certification_ids`— not nested under`.profiles`).

#### 8b. Review screen

- [x] Created permanent review screen` — dynamic route screen. Tabs: Applicants | Shortlisted.
- [x] **Applicants tab:** FlashList of applicants (status `applied`). Each card shows profile data + application message + permanent_availability + notice_period_days. Buttons: Shortlist, Reject (with confirmation dialogs). Shortlist calls `apiPost('/api/permanent/${id}/applicants/${crewId}/shortlist')`. Reject calls `...reject`.
- [x] **Shortlisted tab:** FlashList of shortlisted applicants. "Select" button (only if `posting_status === 'active'` — i.e. no candidate currently selected). Select calls `apiPost('/api/permanent/${id}/applicants/${crewId}/select')` with confirmation: "Select {name} for negotiation? This will open a message thread."
- [x] Shortlist cap indicator: "{shortlist_count}/{shortlist_cap} shortlisted"
- [x] Banner when selected_crew_id` is non-null: "Currently in negotiation with {name}"

---

### 9. Template management

**Context:** Load and save templates for repeat posting. Wires into the "Load from template" buttons on post forms and the Templates tab on My Jobs. Depends on items 3 (My Jobs), 5 (daywork form), 6 (permanent form).

- [x] Created `use-templates.ts`` — TanStack Query hooks: `useDayworkTemplates()`calling`apiGet('/api/daywork/templates')`, `usePermanentTemplates()`calling`apiGet('/api/permanent/templates')`.
- [x] Template selector bottom sheet: opened from "Load from template" on post forms. Lists templates by name with role and location summary. Tap loads template data into the form fields. The list response includes all fields — no need to fetch individual templates by ID.
- [x] Save as template (wiring deferred — hooks + selector ready): after filling a post form, "Save as template" button. Prompts for template name, calls `apiPost('/api/daywork/templates')` or `apiPost('/api/permanent/templates')`. **Important:** daywork templates must NOT include vesselId (per lessons.md — vessel selection is per-posting). Permanent templates CAN include vesselId.
- [x] Wire Templates tab (placeholder in My Jobs, hooks ready) in My Jobs (item 3b): list of daywork + permanent templates. Tap to load into post form. Delete with confirmation dialog. Calls `apiDelete('/api/daywork/templates/${id}')` or `apiDelete('/api/permanent/templates/${id}')`.
- [x] Template editing (PATCH) deliberately deferred is deliberately deferred — save-new and delete only for mobile MVP.

---

### 10. Phase 3 verification

- [x] `turbo run type-check` passes for all workspaces
- [ ] Post daywork form submits successfully — new posting appears in My Jobs Active tab
- [ ] Post permanent form submits successfully
- [ ] My Jobs shows active/in-progress/done/templates tabs with correct data
- [ ] Daywork review: swipe to accept/reject/shortlist works with confirmation dialogs
- [ ] Permanent review: shortlist/select flow works with cap indicator visible
- [ ] Templates: load into form, save from form, delete with confirmation
- [ ] Hat guard: crew hat cannot see post button or My Jobs tab
- [x] Web app completely unaffected

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

(See git history for completed stages 51-166, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 monorepo + shell + auth, mobile Phase 2 discovery + swipe + Fix 165, pre-Phase 3 audit fixes, Stage 166 employer foundations: vessel selector, form pickers, hat-conditional tabs, My Jobs screen, post type selector, apiGet, shared grouping extraction + Fix 166)
