# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

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
