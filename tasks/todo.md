# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 111: GDPR Export + Type System + Audit Completeness

**Goal:** Complete the GDPR data export, fix EventType union gaps, add projection handlers for admin canonical events, fix clearAll availability to use ledger, fix experience overlap for open-ended roles.

**Will NOT touch:** UI components, discovery, engagement lifecycle, notifications.

**Done condition:** GDPR export includes all user data. All emitted event types exist in the TypeScript union. All appended events have projection handlers. clearAll goes through the ledger. Future experiences can be added alongside open-ended current roles.

---

#### 1. GDPR export completeness — `apps/web/src/app/api/account/export/route.ts`

- [ ] Add query for `crew_experiences` where `person_id = user.id`
- [ ] Add query for `applications` where `crew_person_id = user.id`
- [ ] Add query for `daywork_invitations` where `crew_person_id = user.id`
- [ ] Add query for `engagement_ratings` where `person_id = user.id` (check column name)
- [ ] Add query for `device_tokens` where `person_id = user.id`
- [ ] Add query for `advisor_conversations` + `advisor_messages` where `person_id = user.id`
- [ ] Include all new data in the exported JSON
- [ ] Add test verifying export includes experiences and applications

---

#### 2. EventType union — `packages/types/src/events.ts`

- [ ] Add `'DAYWORK.EXTENDED'` to the `EventType` union
- [ ] Add `'ADMIN.ENGAGEMENT_COMPLETED'` to the `EventType` union
- [ ] Add `'ADMIN.CANONICAL_ADDED'` to the `EventType` union
- [ ] Add `'ADMIN.CANONICAL_UPDATED'` to the `EventType` union
- [ ] Verify `AggregateType` union includes `'admin'`
- [ ] Run `tsc --noEmit` — zero errors

---

#### 3. Admin canonical projection handlers

- [ ] New migration: add handlers to `apply_projection` for `ADMIN.CANONICAL_ADDED` and `ADMIN.CANONICAL_UPDATED`
  - These are audit-only events — the canonical data is written directly by the admin route
  - Handler should be a no-op with a RAISE NOTICE confirming the event was processed (not silently dropped by the else branch)
  - Alternatively: if there's an admin audit log table planned, write to it here
- [ ] Corresponding rollback file

---

#### 4. clearAll availability through ledger — `apps/web/src/app/api/availability/route.ts`

- [ ] Replace the direct DELETE path for `clearAll`:
  ```typescript
  // Instead of: serviceClient.from('availability_windows').delete().eq('person_id', user.id)
  // Use: append AVAILABILITY.SET with not_available flag, which expires existing windows via projection
  ```
  The projection handler in migration 00024 already handles this: when `not_available = true`, it expires all existing windows. So `clearAll` should append an `AVAILABILITY.SET` event with `not_available: true`, then immediately append another with no dates to clear the not-available marker — OR define a new clear semantic.
- [ ] **Decided:** Clearing = "not available." Append a single `AVAILABILITY.SET` event with `not_available: true` and `city_id` from the user's current city (or last known). The projection expires all existing windows and writes a not-available marker. No new event type needed. The three-state model remains: available (opt-in dates) / not available (explicit or cleared) / not set (never declared — new users only).
- [ ] Add test verifying clearAll creates an event in the ledger

---

#### 5. Experience overlap — open-ended roles

- [ ] In `apps/web/src/app/api/experiences/route.ts` (POST) and `experiences/[id]/route.ts` (PATCH):
  - Fix the overlap check for NULL `end_date` (current role):
    ```typescript
    // Current: NULL end_date treated as "extends forever" — blocks all future entries
    // Fix: NULL end_date should only overlap with dates that start BEFORE today
    // A future-dated experience (start_date > today) does not overlap with a current open-ended role
    ```
  - If new experience `start_date > today` and existing experience has `end_date = NULL`, allow it (crew is planning a future role transition)
  - If new experience `start_date <= today` and existing experience has `end_date = NULL`, block it (two concurrent current roles)
- [ ] Add test: current role (no end date) + future experience (start_date next month) → 201 OK
- [ ] Add test: current role (no end date) + overlapping experience (start_date last month) → 400

---

#### 6. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 111] GDPR export completeness, EventType union fix, admin canonical projection handlers, clearAll availability via ledger, experience open-ended overlap fix`
  - Update schema version if migration added
  - Add migration to migration table
- [ ] Update `packages/types/README.md` if event types changed

---

### Stage 113: Epaulette Badges — Auto-Derived Rank Insignia

**Goal:** Add a visual epaulette badge component that auto-derives from a crew member's role, showing department symbol + seniority stripes. Add 3 hybrid roles (Deck/Engineer, Deck/Stew, Cook/Stew) with split-symbol badges. Wire into experience cards, discover job cards, and review applicant cards.

**Will touch:** Migration (new roles + department CHECK update), seed data, `RolePicker` grouping, new component + utility, 4 UI surfaces.

**Will NOT touch:** RLS policies, API route logic, engagement lifecycle, notification system.

**Done condition:** Every experience card shows the correct epaulette in the top-right corner. Discover job cards show the epaulette next to the role. Review applicant cards show the epaulette next to the crew name. Hybrid roles show split department symbols. Stripe counts and department symbols match the approved mapping. Tests pass.

---

#### 1. Migration — add hybrid roles + update department CHECK — `supabase/migrations/00053_hybrid_roles.sql`

- [ ] Expand the `department` CHECK constraint on `yacht_roles` to include `'deck_engineering'`, `'deck_interior'`, `'galley_interior'`
- [ ] Insert 3 new hybrid roles into `yacht_roles`:
  ```sql
  ('d0000000-0000-0000-0000-000000000021', 'Deck/Engineer', 'deck_engineering', 21),
  ('d0000000-0000-0000-0000-000000000022', 'Deck/Stew', 'deck_interior', 22),
  ('d0000000-0000-0000-0000-000000000023', 'Cook/Stew', 'galley_interior', 23);
  ```
- [ ] Corresponding rollback: `supabase/rollbacks/00053_hybrid_roles.sql` — delete the 3 rows, restore original CHECK constraint
- [ ] Update seed data `supabase/seed/001_canonical_data.sql` — add the 3 rows to the insert statement

---

#### 2. RolePicker grouping — `apps/web/src/components/role-picker.tsx`

- [ ] Hybrid roles should appear under **both** parent departments in the picker (e.g. Deck/Engineer shows under both Deck and Engineering sections)
  - Alternatively: add a "Hybrid" section at the bottom — simpler, less confusing. **Decision: list under both departments** so crew naturally find them when browsing either department
- [ ] Derive parent departments from the compound department string: `'deck_engineering'` → `['deck', 'engineering']`

---

#### 3. Stripe mapping utility — `apps/web/src/lib/epaulettes.ts`

Create a new file with the role → epaulette mapping and helper functions.

- [ ] Define `ROLE_EPAULETTE_MAP` — static lookup from role name to `{ departments, stripes }`:

  **Single-department roles:**

  | Role                 | Department  | Stripes |
  | -------------------- | ----------- | ------- |
  | Captain              | bridge      | 4       |
  | First Officer        | bridge      | 3       |
  | Second Officer       | bridge      | 2       |
  | Bosun                | deck        | 2       |
  | Lead Deckhand        | deck        | 1       |
  | Deckhand             | deck        | 1       |
  | Mate                 | deck        | 1       |
  | Day Worker (General) | deck        | 1       |
  | Chief Engineer       | engineering | 4       |
  | Second Engineer      | engineering | 3       |
  | Third Engineer       | engineering | 2       |
  | ETO                  | engineering | 3       |
  | Chief Stewardess     | interior    | 3       |
  | Second Stewardess    | interior    | 2       |
  | Third Stewardess     | interior    | 1       |
  | Stewardess           | interior    | 1       |
  | Purser               | interior    | 3       |
  | Head Chef            | galley      | 3       |
  | Sous Chef            | galley      | 2       |
  | Crew Chef            | galley      | 1       |

  **Hybrid roles (split symbol):**

  | Role          | Departments        | Stripes |
  | ------------- | ------------------ | ------- |
  | Deck/Engineer | deck + engineering | 1       |
  | Deck/Stew     | deck + interior    | 1       |
  | Cook/Stew     | galley + interior  | 1       |

- [ ] Export `getEpaulette(roleName: string): { departments: string[]; stripes: number; color: 'gold' | 'silver' | 'mixed' } | null`
  - `departments` is an array: length 1 for normal roles, length 2 for hybrids
  - Color rule: all departments gold → `'gold'`; all silver → `'silver'`; mixed (Deck/Engineer = gold+gold, Deck/Stew = gold+silver) → derive per-icon
  - Returns `null` for unknown roles
- [ ] Export per-icon color helper: `getDepartmentColor(dept: string): 'gold' | 'silver'`
  - `deck`, `bridge`, `engineering` → `'gold'`
  - `interior`, `galley` → `'silver'`
- [ ] Fallback: if a role name isn't in the map but a `department` string is provided, parse compound departments and default to 1 stripe

---

#### 4. EpauletteBadge component — `apps/web/src/components/epaulette-badge.tsx`

- [ ] Create `EpauletteBadge` component with props: `roleName: string`, optional `department?: string`, optional `size?: 'sm' | 'md'`
- [ ] **Pill shape:** rounded-full, dark navy background (`bg-navy`)
- [ ] **Left side — department icon(s) (inline SVG):**
  - Deck + Bridge: anchor
  - Engineering: propeller
  - Interior: crescent moon / half moon
  - Galley: knife
  - **Single-department roles:** one icon
  - **Hybrid roles:** two icons side by side (e.g. anchor + propeller for Deck/Engineer), each in its own department color
  - Icons should be simple, clean, ~12-16px depending on size variant
- [ ] **Right side — vertical stripes:** render `stripes` count of thin vertical bars
  - Stripe color: use the department's color for single-dept roles; for hybrids, use gold (all hybrids include at least one gold department)
- [ ] **Color coding per icon:**
  - Gold (`#D4AF37`) for deck, bridge, engineering icons and stripes
  - Silver (`#C0C0C0`) for interior, galley icons and stripes
  - Hybrid roles: each icon gets its own department color (e.g. Deck/Stew = gold anchor + silver crescent)
- [ ] **Size variants:**
  - `sm` — for inline use next to names (height ~20px)
  - `md` — for experience card corner (height ~24px)
- [ ] Return `null` if role name has no mapping (graceful degradation)

---

#### 5. Wire into profile experience cards — `apps/web/src/app/(app)/profile/page.tsx`

- [ ] Import `EpauletteBadge`
- [ ] In the experience card header (where role name, vessel name, and date range are rendered), add `<EpauletteBadge roleName={exp.yacht_roles?.name} />` positioned top-right of the card
  - Use `absolute top-2 right-2` or similar positioning within the card's relative container
  - Size: `md`
- [ ] Verify it renders correctly on both expanded (current role) and collapsed (past roles) cards

---

#### 6. Wire into discover job cards — `apps/web/src/app/(app)/discover/page.tsx`

- [ ] Import `EpauletteBadge`
- [ ] The job card already shows the role name prominently — add epaulette badge inline next to the role name
  - The role is the job's required role (what the employer is hiring for)
  - Size: `sm`
- [ ] The role name string is available in the card data — verify it matches the canonical role names in the map
- [ ] Also add to application cards (discover Applied tab) and invitation cards (discover Invitations tab) if they show a role name

---

#### 7. Wire into review applicant cards — `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

- [ ] Import `EpauletteBadge`
- [ ] In the `ApplicantCard` component, add epaulette badge next to the crew member's name (in the flex container with the `<h3>`)
  - Role comes from `profile?.yacht_roles?.name`
  - Size: `sm`
  - Position: after the name, before the shortlist star
- [ ] Also add to the Available tab crew cards (`AvailableCrewCard`) if they show a role name

---

#### 8. Wire into profile overlay — `apps/web/src/components/profile-overlay.tsx`

- [ ] If the profile overlay shows experience cards, add `EpauletteBadge` in the same position as the profile page (top-right corner)
- [ ] If the overlay shows the crew's primary role in the header, add inline epaulette there too

---

#### 9. Tests

- [ ] Create `apps/web/__tests__/components/epaulette-badge.test.tsx`
- [ ] Test: Captain → 4 gold stripes, anchor icon
- [ ] Test: Chief Engineer → 4 gold stripes, propeller icon
- [ ] Test: Chief Stewardess → 3 silver stripes, crescent icon
- [ ] Test: Head Chef → 3 silver stripes, knife icon
- [ ] Test: Deckhand → 1 gold stripe (minimum), anchor icon
- [ ] Test: Deck/Engineer → split symbol (anchor + propeller), 1 stripe
- [ ] Test: Deck/Stew → split symbol (anchor + crescent), 1 stripe
- [ ] Test: Cook/Stew → split symbol (knife + crescent), 1 stripe
- [ ] Test: unknown role → returns null (no render)
- [ ] Test: `getEpaulette` utility returns correct mapping for all 23 roles

---

#### 10. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 113] Epaulette badges — auto-derived rank insignia (department symbol + seniority stripes) on profile experience cards, discover job cards, review applicant cards, profile overlay; 3 hybrid roles (Deck/Engineer, Deck/Stew, Cook/Stew) with split-symbol badges; migration 00053 for hybrid role data + department CHECK; gold (deck/bridge/engineering) and silver (interior/galley) color coding`
  - Update schema version to v53
  - Add migration 00053 to migration table
- [ ] Update seed data docs if applicable
- [ ] Update `supabase/README.md` — new migration
- [ ] Update `packages/types/README.md` if type changes needed for hybrid departments

---

### Stage 112: UI State Freshness

**Goal:** Fix stale UI state, missing guards, and optimistic update rollback across the daywork flow pages. These are UX polish issues, not data integrity — the API layer is correct, but the UI doesn't always reflect it.

**Will NOT touch:** Database, migrations, RLS, API routes, notification system.

**Done condition:** Tab counts refresh after mutations. Post form blocks double-submit. Templates load all fields. Checklist toggle rolls back on error. Availability re-checked before apply.

---

#### 1. Mine page — stale tab counts after actions

- [ ] In `apps/web/src/app/(app)/daywork/mine/page.tsx`:
  - After cancel action completes, refetch the current tab's data to update counts
  - After returning from review page (where accept may have happened), refetch on focus/visibility change — verify this already works via the existing visibility listener, or add explicit refetch
  - Ensure tab badge counts (`Active (3)`, `In Progress (2)`) update when the underlying data changes

---

#### 2. Post form — double-submit protection

- [ ] In `apps/web/src/app/(app)/daywork/post/page.tsx`:
  - Add a ref-based guard that prevents the submit handler from firing if a submission is already in flight:
    ```typescript
    const submittingRef = useRef(false);
    const handleSubmit = async () => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      try { ... } finally { submittingRef.current = false; }
    };
    ```
  - `useState` for `loading` controls the UI (button disabled/label); the ref prevents the actual API call

---

#### 3. Post form — template load populates all fields

- [ ] In the `applyTemplate` function, ensure these fields are set from the template:
  - `setPositionsAvailable(template.positions_available ?? 1)`
  - `setPermanentOpportunity(template.permanent_opportunity ?? false)`
  - Verify all other fields are populated (check the `Template` interface against the form state)

---

#### 4. Chat page — checklist toggle optimistic rollback

- [ ] In `apps/web/src/app/(app)/messages/[engagementId]/page.tsx` (or `_components/`):
  - When checklist toggle API fails, revert the optimistic state update:
    ```typescript
    const previousState = { ...checklist };
    // optimistic update
    setChecklist(updatedChecklist);
    const res = await fetch(...);
    if (!res.ok) {
      setChecklist(previousState); // rollback
      showError('Failed to update checklist');
    }
    ```

---

#### 5. Discover page — availability re-check before apply

- [ ] In `apps/web/src/app/(app)/discover/page.tsx`:
  - Before executing the apply action (swipe right or button), re-check availability if the last check was more than 5 minutes ago:

    ```typescript
    const lastAvailCheck = useRef<number>(0);
    const AVAIL_RECHECK_MS = 5 * 60 * 1000;

    const handleApply = async () => {
      if (Date.now() - lastAvailCheck.current > AVAIL_RECHECK_MS) {
        const stillAvailable = await checkAvailability();
        lastAvailCheck.current = Date.now();
        if (!stillAvailable) {
          showAvailabilityDialog();
          return;
        }
      }
      // proceed with apply
    };
    ```

  - This prevents the 403 error when availability expires during a browsing session

---

#### 6. Review page — stale applicant count after actions

- [ ] In `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`:
  - After shortlist/reject/accept actions, update the tab count badges to reflect the new state
  - The card is already removed from the stack — verify the count in the tab header updates too (it may derive from the card array length, in which case this is already correct)

---

#### 7. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 112] UI state freshness — mine page tab count refresh, post form double-submit guard, template field population, checklist toggle rollback, availability re-check, review page count sync`

---

## Done

(See git history for completed stages 51-107)
