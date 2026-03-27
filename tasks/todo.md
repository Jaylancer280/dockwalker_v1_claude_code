# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Playwright accepted fixes — SUG-004, SUG-011, SUG-016

**Problem:** 3 real bugs found by the testing agent, accepted but never fixed. SUG-001 was fixed in the previous session.

**Files changed:** 1 migration (SUG-004 RLS), 1 page component, 1 middleware check.

#### Checklist

- [x] **SUG-004: Employer message thread — vessels RLS too restrictive** — verified fixed by migration 00074 (3 SELECT policies: non-NDA public, engaged users, experience vessels)
- [x] **SUG-011: Daywork cancel needs confirmation dialog** — verified fixed: `setCancelId` opens dialog, `handleCancel` only called from dialog confirm button
- [x] **SUG-016: Employer not redirected from `/discover`** — verified fixed: middleware line 92-96 (employer hat check) + discover page line 169-174 (client-side `window.location.href` redirect)

- [x] **Tests** — SUG-004: integration tests already exist in `__tests__/integration/vessels-rls.test.ts` (6 tests cover all 3 RLS policies from migration 00074); SUG-011: cancel dialog verified by code inspection (handleCancel only callable from dialog confirm button); SUG-016: middleware + client-side redirect verified by code inspection

**Done condition:** All three verified as already implemented and tested.

---

### UI Consistency 1/3 — Shared components + posting forms

**Problem:** Posting forms use flat dropdowns for role and experience bracket while the rest of the app uses richer components. Daywork and permanent posting forms have inconsistent notes fields, template save UX, and currency preference sources. Permanent form has a bug: experience bracket dropdown is empty (queries wrong DB column).

**Principle:** Pills over dropdowns. Shared components over inline implementations. Same data = same UI.

**Files changed:** No migrations. No API changes. Pure frontend.

**What will NOT be touched:** API routes, database schema, RLS, event handling, middleware.

#### Checklist

- [x] **Fix: Permanent form experience bracket queries wrong column** (`apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx`)
  - Change `.select('id, name')` to `.select('id, label')` on the `experience_brackets` query
  - Map result to `{ ...b, name: b.label }` to match `LookupItem` shape (same as daywork form)
  - This is why the permanent form shows an empty experience bracket dropdown

- [x] **Extract `ExperienceBracketPills` shared component** (`apps/web/src/components/experience-bracket-pills.tsx`)
  - New shared component: renders experience brackets as pill toggle buttons
  - Props: `brackets: LookupItem[]`, `value: string`, `onValueChange: (id: string) => void`, `optional?: boolean`
  - If `optional`, include an "Any" pill that maps to empty string
  - Active pill: `bg-[var(--accent)] text-white`; inactive: `bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]`
  - Same styling as existing cert/language pills

- [x] **Extract `DepartmentRolePills` shared component** (`apps/web/src/components/department-role-pills.tsx`)
  - New shared component: renders roles grouped by department as collapsible sections with pill buttons
  - Props: `roles: RoleItem[]`, `value: string`, `onValueChange: (id: string) => void`
  - Each department is a collapsible header (tappable to expand/collapse)
  - Roles within each department rendered as pill buttons
  - Selected pill highlighted with accent styling
  - All departments collapsed by default; department containing selected role auto-expanded
  - Hybrid roles (e.g. `deck_engineering`) appear under both parent departments (same logic as existing `RolePicker`)
  - Searchable: text input at top filters roles and auto-expands matching departments

- [x] **Replace flat role Select with `DepartmentRolePills` on daywork post form** (`apps/web/src/app/(app)/daywork/post/page.tsx`)
  - Remove the `Select` dropdown for role
  - Replace with `DepartmentRolePills` component
  - Keep `EpauletteBadge` display alongside or within the selected pill

- [x] **Replace flat role Select with `DepartmentRolePills` on permanent post form** (`apps/web/src/app/(app)/daywork/post/_components/permanent-form-sections.tsx`)
  - Same change in the `RoleLocationSection`
  - Keep `EpauletteBadge` display

- [x] **Replace experience bracket Select with `ExperienceBracketPills` on both forms**
  - Daywork: `apps/web/src/app/(app)/daywork/post/page.tsx` — remove Select, use `ExperienceBracketPills` with `optional` prop
  - Permanent: `apps/web/src/app/(app)/daywork/post/_components/permanent-form-sections.tsx` — same in `RequirementsSection`, remove hardcoded `<SelectItem value="any">Any</SelectItem>`

- [x] **Daywork notes field — change Input to Textarea** (`apps/web/src/app/(app)/daywork/post/page.tsx`)
  - Replace `<Input>` with `<textarea>` (or Textarea component if one exists)
  - Add `maxLength={500}`, `rows={3}`, character counter — match permanent form exactly
  - Update placeholder to match permanent: "Job description, requirements, benefits..."

- [x] **Daywork template save — switch to inline checkbox pattern** (`apps/web/src/app/(app)/daywork/post/page.tsx`)
  - Remove the separate "Save template" button and its modal dialog
  - Add inline checkbox + conditional template name input below the form (same as permanent form)
  - Wire to existing template save API

- [x] **Currency preference — unify source** (`apps/web/src/app/(app)/daywork/post/page.tsx`)
  - Replace direct `localStorage.getItem('dw-currency-pref')` with `usePreferences()` hook
  - Both daywork and permanent forms now use the same source for default currency

- [x] **Tests for new shared components**
  - `ExperienceBracketPills`: renders all brackets as pills, toggles selection, "Any" pill works when optional
  - `DepartmentRolePills`: renders departments collapsed, expands on click, selects role, search filters correctly
  - Update existing form-dropdowns and daywork post form tests for changed component patterns (textarea, pills, template checkbox)

**Done condition:** Both posting forms use `DepartmentRolePills` for role and `ExperienceBracketPills` for experience bracket. Permanent form bracket dropdown works (bug fixed). Daywork notes is a textarea with counter. Template save is an inline checkbox on both forms. Currency defaults come from `usePreferences()` on both.

---

### UI Consistency 2/3 — Vessel creation consistency

**Problem:** Vessel creation exists in 3 places (Vessels page, Add Experience, Onboarding) with different capabilities. The Vessels page — the dedicated vessel management page — has no IMO lookup. Experience forms hardcode LOA in metres while the Vessels page respects user preference. Size band preview is missing from experience forms.

**Depends on:** Session 1 (shared `ImoLookupSection` extracted there — OR extract it here if session 1 hasn't run yet. Implementation agent: check if the component exists before extracting.)

**Files changed:** No migrations. No API changes. Pure frontend.

**What will NOT be touched:** API routes, database schema, RLS, event handling, middleware. NDA flag stays vessels-page-only (by design — crew don't set NDA on experience vessels).

#### Checklist

- [x] **Extract `ImoLookupSection` as shared component** (`apps/web/src/components/vessels/imo-lookup-section.tsx`)
  - Currently defined inline inside `apps/web/src/app/(app)/profile/add-experience/page.tsx`
  - Extract to shared location so it can be imported by vessels page and onboarding
  - Keep partial-match (4+ digits with dropdown suggestions) + exact-match (7 digits) behaviour
  - Props: `onVesselFound: (vessel) => void`, `onManualEntry: () => void`, `imoValue: string`, `onImoChange: (v: string) => void`
  - Update add-experience page to import from new shared location

- [x] **Add IMO lookup to Vessels page** (`apps/web/src/app/(app)/vessels/page.tsx`)
  - Import the shared `ImoLookupSection` component
  - Add it above the manual vessel creation form
  - When lookup finds a vessel, auto-populate name, type, and LOA fields
  - Keep NDA toggle (vessels page only — correct by design)

- [x] **LOA units — respect user preference in experience forms**
  - `apps/web/src/app/(app)/profile/add-experience/page.tsx` — `VesselDetailsSection`
  - `apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`
  - Import `usePreferences()`, show LOA label as "(feet)" or "(metres)" based on preference
  - Convert to/from metres on submit (store always in metres, display in user units)
  - Match the vessels page pattern exactly

- [x] **Show auto-derived size band in experience vessel creation**
  - `apps/web/src/app/(app)/profile/add-experience/page.tsx` — below LOA input
  - `apps/web/src/app/onboarding/_components/vessel-experience-step.tsx` — below LOA input
  - Fetch `vessel_size_bands` and match LOA to band
  - Same display pattern as vessels page: helper text showing matched band name

- [x] **Tests**
  - `ImoLookupSection`: partial match triggers dropdown, exact match returns vessel, manual entry callback fires
  - Verify add-experience still works after extraction (import path change)

**Done condition:** All 3 vessel creation surfaces (Vessels page, Add Experience, Onboarding) have IMO partial-match lookup, LOA in user-preferred units, and auto-derived size band preview. Creating a vessel feels identical regardless of entry point.

---

### UI Consistency 3/3 — Onboarding experience form alignment

**Problem:** Onboarding experience entry uses different UI patterns from Add/Edit Experience for the same fields. Contract type is a plain text input (vs rich structured inputs). IMO lookup is exact-only (vs partial match). Field order differs. Salary period labels differ. Sea time fields are missing.

**Depends on:** Session 2 (shared `ImoLookupSection` must exist). If session 2 hasn't run, extract the component here first.

**Files changed:** Primarily `apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`. No migrations. No API changes.

**What will NOT be touched:** API routes, database schema, RLS, event handling, middleware, add/edit experience pages (those are the reference — onboarding aligns to them).

#### Checklist

- [x] **Extract `ContractDetailsInput` shared component** (`apps/web/src/components/contract-details-input.tsx`)
  - Extract the structured contract type UI from `ExperienceDetailsSection` (`apps/web/src/app/(app)/profile/_components/experience-details-section.tsx`)
  - Rotational: preset ratio pills (2:2, 3:3, 3:1, 4:2, 5:1, 6:2, 10:10) + custom on/off number inputs + weeks/months unit selector
  - Permanent: "Days leave per year" number input
  - Seasonal: text input
  - Crossing/Delivery/Temporary: hide details
  - Props: `contractType`, `contractDetails`, `onContractDetailsChange`, plus rotation-specific state handlers
  - Update `ExperienceDetailsSection` to import from new shared location

- [x] **Onboarding — use `ContractDetailsInput`** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Replace the plain text input for contract details with the shared `ContractDetailsInput`
  - Wire up the rotation-specific state (on/off values, unit) per experience entry

- [x] **Onboarding — use shared `ImoLookupSection`** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Replace the current exact-only (7 digit) lookup with the shared `ImoLookupSection` component
  - Partial matching (4+ digits) with dropdown suggestions — same as add-experience page

- [x] **Onboarding — match field order to add-experience** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Current onboarding order: IMO → Type → Name → LOA → Role → Operation → Dates → Flag → Salary → Contract → Description
  - Target order: IMO → Type → Name → LOA → [divider] → Role → Operation → Flag → Dates → Currently onboard → Contract → Description → Salary
  - Salary stays last (private intelligence section)

- [x] **Onboarding — unify salary period labels** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Change "Daily" → "per day", "Monthly" → "per month", "Annually" → "per year"
  - Match the labels used in add/edit experience forms

- [x] **Onboarding — add sea time fields** (`apps/web/src/app/onboarding/_components/vessel-experience-step.tsx`)
  - Add "Days at sea" and "Nautical miles" inputs below salary
  - Same layout as `PrivateIntelligenceSection` in add/edit experience
  - Helper text: "Engineering Officer routes require days. Deck Officer routes require nautical miles."

- [x] **Tests**
  - Verify onboarding vessel experience step renders contract pills for rotational type
  - Verify field order matches add-experience
  - Verify salary labels are "per day" / "per month" / "per year"
  - Update any existing onboarding component tests affected by field reordering

**Done condition:** A user entering their first experience during onboarding sees the exact same fields in the same order with the same UI as they'd see on the Add Experience page. Contract type has rich structured inputs. IMO lookup has partial matching. Salary labels match. Sea time fields are present.

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Permanent crew withdrawal auto-revert — employer should decide

When crew withdraws after being selected for a permanent role, `apply_projection` automatically sets the posting back to `active`. The employer gets no notification, no prompt, no choice. Needs: migration, API route, UI banner, context API, tests. Full spec preserved in git history.

### Billing IAP bypass redesign

4-phase project: in-app billing page, email-to-web magic link, web purchase page, old flow cleanup. Full spec preserved in git history.

### Deactivated user server-side sign-out

Needs admin client to revoke auth session after deactivation. 403 guard already in place.

### OG social sharing image

Create 1200x630px branded image at `apps/web/public/images/brand/og-image.png`. Code already references it.

### Agent market as discover mode

Merge `/discover/market` into the main discover page as an agent-specific mode.

### Resilience Tests

Discover, Chat, Apply, Post form, Availability overlay error handling tests.

### Component Tests for Permanent UI

PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard.

### Component Tests for Form Pickers

LocationPicker, RolePicker, FlagStatePicker, AvailabilityOverlay, ProfileOverlay, ImageCropper.

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

Add RFC 2369 `List-Unsubscribe` header to all outgoing emails for better deliverability.

### Form validation — styled inline errors (SUG-012)

Replace browser-native validation with styled inline errors matching the design system.

### Invalid URL error pages (SUG-013)

Review page and vessel edit page should show "not found" instead of generic API error when given non-existent IDs.

### Edit experience "Unknown vessel" prefix (SUG-017 secondary)

After vessels RLS fix resolves the name lookup, verify the vessel_type prefix (M/Y vs S/Y) is correct. Currently defaults to M/Y.

---

## Done

(See git history for completed stages 51-152, UI-0 through UI-19, availability-model-overhaul, cron-trigger-fix, all fix batches, template name cap, messages test cleanup, pre-TestFlight native changes, workflow protocol, Playwright baseline, pre-TestFlight fix batch, rollback + test fixes, fix batch 153, SUG fixes 154)
