# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 115: Experience Add/Edit Feedback + Stale Data Fix

**Goal:** Fix silent failures on add/edit experience pages, add success/error toasts, fix stale profile data after redirect, harden submit error recovery.

**Will NOT touch:** Database, migrations, RLS, API response shapes, experience API validation logic, profile page layout.

**Done condition:** Add experience shows toast on success AND on every error path (vessel fail, experience fail, overlap, network). Edit experience shows success toast and clears stale error on re-submit. Profile page refreshes experience list after redirect from add/edit. Delete shows success toast. Submit button never gets permanently stuck.

---

#### 1. Add experience — wire up error feedback on ALL failure paths

File: `apps/web/src/app/(app)/profile/add-experience/page.tsx`

Currently the submit handler silently swallows every error. The `useToast` hook is available (mounted in app layout) but not imported.

- [x] Import `useToast` hook: `const { showError, showSuccess } = useToast()`
- [x] **Vessel creation failure (line ~138):** Show error toast with API message:
  ```typescript
  if (!vesselRes.ok) {
    const data = await vesselRes.json().catch(() => ({}));
    showError(data.error ?? 'Failed to create vessel');
    setSubmitting(false);
    return;
  }
  ```
- [x] **Experience creation failure (line ~162):** Show error toast with API message:
  ```typescript
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.error ?? 'Failed to add experience');
    setSubmitting(false);
    return;
  }
  ```
  This surfaces the specific API errors: `'Experience dates overlap with an existing entry'` (409), `'You already have a current experience'` (409), validation errors (400)
- [x] **Wrap entire handler in try/catch** to catch network errors:
  ```typescript
  async function handleSubmit() {
    if (submittingRef.current) return; // or existing guard
    try {
      setSubmitting(true);
      // ... existing flow ...
    } catch {
      showError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }
  ```
  The `finally` block ensures `setSubmitting(false)` always runs, preventing the stuck button.

---

#### 2. Add experience — success toast before redirect

File: `apps/web/src/app/(app)/profile/add-experience/page.tsx`

- [x] On successful experience POST, show success toast and force a full profile reload:
  ```typescript
  if (res.ok) {
    showSuccess('Experience added');
    router.push('/profile');
    router.refresh(); // invalidates client cache, forces data refetch on profile page
  }
  ```
  `router.refresh()` after `router.push()` tells Next.js to re-run all data fetching for the target route. The toast persists across navigation since it's in the app layout.

---

#### 3. Edit experience — success toast + clear stale error

File: `apps/web/src/app/(app)/profile/edit-experience/[id]/page.tsx`

- [x] Import `useToast` if not already: `const { showSuccess } = useToast()`
- [x] On successful PATCH, show success toast and force profile reload:
  ```typescript
  if (res.ok) {
    showSuccess('Experience updated');
    router.push('/profile');
    router.refresh();
  }
  ```
- [x] Verify `setError(null)` is called at the start of `handleSubmit` (line ~107) — this clears stale error from previous attempt. If not present, add it.
- [x] Wrap handler in try/catch with `finally { setSubmitting(false) }` to prevent stuck button on network errors

---

#### 4. Verify profile page data freshness after redirect

File: `apps/web/src/app/(app)/profile/page.tsx`

The `router.refresh()` calls in sections 2 and 3 handle the stale data problem at the source — Next.js invalidates the client cache and re-runs data fetching when the profile page mounts.

- [x] Verify: after adding an experience via add-experience page, the profile page shows the new experience immediately on arrival (no manual refresh needed)
- [x] Verify: after editing an experience, the updated fields appear immediately on the profile page
- [x] If `router.refresh()` alone doesn't trigger the `useEffect` that calls `loadExperiences()`, add a fallback: check if the profile page already has a visibility listener (like mine page from Stage 112). If not, add one with a 2-second staleness threshold.

---

#### 5. Profile page — delete experience success toast

File: `apps/web/src/app/(app)/profile/page.tsx`

The delete handler (line ~328-339) has error feedback (`showError`) but no success feedback.

- [x] After successful DELETE, add: `showSuccess('Experience removed')`
- [x] Verify `showSuccess` is already imported from `useToast` (profile page already uses `showError` — check if `showSuccess` is destructured too)

---

#### 6. Tests

- [x] Verify existing experience tests pass (`apps/web/__tests__/api/experiences.test.ts`)
- [x] No new API tests needed — this is purely frontend feedback wiring
- [x] If component tests exist for the add/edit pages, verify they still pass

---

#### 7. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 115] Experience add/edit feedback — error toasts on all failure paths (vessel creation, experience creation, overlap, network), success toasts on add/edit/delete, stale data fix on profile redirect, try/catch submit hardening`

---

### Stage 116: Badge Color + Message Count Semantics + Hydration Fix

**Goal:** Change all red notification badges to DockWalker blue, fix message badge count to show threads-with-unread (not total unread messages), fix OfflineBanner hydration mismatch.

**Will NOT touch:** Database, migrations, RLS, message read cursor logic, notification API structure.

**Done condition:** All notification badges use `bg-primary` (navy blue). Messages badge shows count of threads with unread messages (not sum of individual unread messages). No hydration errors on any page.

---

#### 1. Badge color — change `bg-destructive` to `bg-primary`

Three files, one-line change each:

- [x] `apps/web/src/components/bottom-nav.tsx` (line ~80): Change `bg-destructive` to `bg-primary` and `text-destructive-foreground` to `text-primary-foreground`
- [x] `apps/web/src/components/notification-bell.tsx` (line ~37): Same change
- [x] `apps/web/src/components/hat-switcher.tsx` (line ~76): Same change

---

#### 2. Message badge count — threads with unread, not total unread

File: `apps/web/src/app/api/notifications/count/route.ts`

Currently the endpoint sums all unread messages across all engagements. If thread A has 3 unread and thread B has 2 unread, the badge shows "5". The user expects to see "2" (two threads need attention).

- [x] In the counting loop (line ~63-82), change from summing `unread` to incrementing by 1 per thread:

  ```typescript
  // BEFORE:
  if (engHat === currentHat) {
    msgCurrent += unread; // sums individual messages
  }

  // AFTER:
  if (engHat === currentHat) {
    msgCurrent += 1; // count threads, not messages
  }
  ```

  The `if (unread === 0) continue;` guard already skips threads with no unread messages, so this correctly counts only threads that have at least one unread message.

- [x] Same change for `msgAlt` (alt-hat count)
- [x] Verify the messages list page (`/messages`) still shows correct per-thread unread counts (it uses a separate calculation in `GET /api/messages`)

---

#### 3. OfflineBanner hydration fix

File: `apps/web/src/hooks/use-network-status.ts`

The hydration error occurs because `useState` initializes with `navigator.onLine` on client but `true` on server. If the user is offline, server renders `null` (online=true → no banner) but client renders the warning banner.

- [x] Change the initial state to always be `true` (matches server):

  ```typescript
  // BEFORE:
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  // AFTER:
  const [isOnline, setIsOnline] = useState(true);
  ```

- [x] Add `setIsOnline(navigator.onLine)` at the start of the existing `useEffect` to sync real status on mount:

  ```typescript
  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    // ... rest unchanged
  }, []);
  ```

  This means the banner appears after hydration (a brief flash-of-no-banner for offline users), which is the correct trade-off vs a hydration error.

---

#### 4. Tests

- [x] Verify existing notification count tests still pass
- [x] Verify no hydration errors in browser console on `/messages`, `/discover`, and `/profile`

---

#### 5. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 116] Badge polish — bg-destructive → bg-primary on 3 notification badges, message count changed from total-unread to threads-with-unread, OfflineBanner hydration fix (deferred navigator.onLine to useEffect)`

---

### Stage 117: Discover Card Scroll Containment

**Goal:** Fix job card content scrolling over tab headers on discover page.

**Will NOT touch:** Database, migrations, API routes, card content, swipe mechanics.

**Done condition:** Scrolling the discover page never causes card content to overlap the sticky tab headers. Tab headers always remain visually above card content.

---

#### 1. Fix z-index layering

File: `apps/web/src/app/(app)/discover/page.tsx`

- [x] Bump the sticky header from `z-10` to `z-20` (or `z-30`) so it always sits above scrolling card content
- [x] Add `overflow-hidden` to the card stack container (`relative h-[420px] w-full`) to clip any card overflow that might escape the container bounds
- [x] Verify on a 375px viewport that cards, swipe buttons, and tab headers all render without overlap

---

#### 2. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 117] Discover card scroll containment — header z-index bump, card stack overflow clip`

---

### Stage 118: Invitation Accept → Auto-Shortlist + Invited Badge + Multi-Crew Revocation

**Goal:** When invited crew accepts, auto-shortlist them so they stand out on the review page. Add "Invited" visual indicator. Fix multi-crew invitation revocation to only revoke when positions are full. Filter stale invitations from crew's view.

**Will touch:** Migration (new column + `apply_projection` update), invitation respond route, applicants API, review page UI, invitations GET endpoint.

**Will NOT touch:** Invitation send flow, push notifications (already working), discovery, messaging.

**Done condition:** Invited crew who accept appear in the Shortlisted tab with an "Invited" badge. Multi-crew jobs only revoke invitations when all positions are filled. Crew don't see invitations for cancelled/completed dayworks.

---

#### 1. Migration — add `source` column to `applications` + update `apply_projection`

File: `supabase/migrations/00056_invitation_source.sql`

- [x] Add nullable `source` column to `applications`:

  ```sql
  alter table public.applications add column source text
    check (source in ('direct', 'invitation'));
  ```

  NULL = legacy applications (before this migration). `'direct'` = organic apply. `'invitation'` = accepted invitation.

- [x] Update `apply_projection` `DAYWORK.APPLIED` handler:

  ```sql
  -- BEFORE:
  insert into public.applications (id, crew_person_id, daywork_id, status, message)
    values (..., 'applied', ...);

  -- AFTER: conditionally set status and source from payload
  insert into public.applications (id, crew_person_id, daywork_id, status, message, source)
    values (
      ...,
      case when (p_payload->>'source') = 'invitation' then 'shortlisted' else 'applied' end,
      p_payload->>'message',
      p_payload->>'source'
    );
  ```

  When `source = 'invitation'`, the application is created directly as `shortlisted` — no separate `DAYWORK.SHORTLISTED` event needed.

- [x] Update `apply_projection` `DAYWORK.ACCEPTED` handler — fix multi-crew invitation revocation:

  ```sql
  -- BEFORE: unconditionally revoke ALL pending invitations
  update public.daywork_invitations set status = 'revoked'
    where daywork_id = v_daywork_id and status = 'pending';

  -- AFTER: only revoke when positions are full
  select positions_filled, positions_available into v_filled, v_available
    from public.dayworks where id = v_daywork_id;
  if v_filled >= v_available then
    update public.daywork_invitations set status = 'revoked'
      where daywork_id = v_daywork_id and status = 'pending';
  end if;
  ```

  For single-position jobs, this behaves identically (first accept fills all positions → revoke). For multi-crew, invitations stay open until all positions are filled.

- [x] Corresponding rollback: `supabase/rollbacks/00056_invitation_source.down.sql` — drop `source` column, restore previous `apply_projection` body

---

#### 2. Update EventPayloadMap — add `source` to DAYWORK.APPLIED

File: `packages/types/src/events.ts`

- [x] Add optional `source` field to `DAYWORK.APPLIED` payload:
  ```typescript
  'DAYWORK.APPLIED': {
    id: string;
    daywork_id: string;
    crew_person_id?: string;
    message?: string | null;
    source?: 'direct' | 'invitation';
  };
  ```

---

#### 3. Invitation respond route — pass `source: 'invitation'` in payload

File: `apps/web/src/app/api/daywork/invitations/[id]/respond/route.ts`

- [x] In the accept path, add `source: 'invitation'` to the `DAYWORK.APPLIED` event payload:
  ```typescript
  {
    eventType: 'DAYWORK.APPLIED',
    payload: {
      id: applicationId,
      daywork_id: invitation.daywork_id,
      crew_person_id: user.id,
      source: 'invitation',  // NEW
    },
  }
  ```
  The projection handler will see `source = 'invitation'` and set status to `shortlisted`.

---

#### 4. Direct apply route — pass `source: 'direct'`

File: `apps/web/src/app/api/daywork/[id]/apply/route.ts`

- [x] Add `source: 'direct'` to the `DAYWORK.APPLIED` event payload (or omit it — NULL means legacy/direct, which is also fine)
- [x] **Decision: omit it.** NULL = direct apply. Only invitation accepts set `source: 'invitation'`. This avoids touching the direct apply route at all — backward compatible.

---

#### 5. Applicants API — expose `source` field

File: `apps/web/src/app/api/daywork/[id]/applicants/route.ts`

- [x] Add `source` to the select query:
  ```typescript
  .select(`
    id, crew_person_id, status, message, created_at, source,
    profiles!applications_crew_person_id_profiles_fkey(...)
  `)
  ```
- [x] The response now includes `source: 'invitation' | 'direct' | null` per applicant

---

#### 6. Review page — "Invited" badge on applicant cards

File: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

- [x] In the `ApplicantCard` component, add an "Invited" badge when `applicant.source === 'invitation'`:

  ```tsx
  {
    applicant.source === 'invitation' && (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        Invited
      </span>
    );
  }
  ```

  Position: on the name line, after the shortlist star (or replacing it — they'll already be in the Shortlisted tab since auto-shortlisted)

- [x] The invited crew will appear in the **Shortlisted tab** automatically (their status is `shortlisted` from the projection). The "Invited" badge provides additional context about WHY they're shortlisted.

---

#### 7. Invitations GET — filter stale invitations

File: `apps/web/src/app/api/daywork/invitations/route.ts`

- [x] Add a join or subquery to filter out invitations where the daywork is no longer active:

  ```typescript
  // Add to the existing query chain:
  .eq('dayworks.status', 'active')
  ```

  Or post-fetch filter if the join is complex. This prevents crew from seeing invitations for cancelled or completed dayworks.

- [x] Also filter out invitations where `positions_filled >= positions_available` on the daywork (all positions full — invitation is effectively stale even though not yet revoked)

---

#### 8. Tests

- [x] Update existing invitation respond tests: verify accepted invitation creates application with `source: 'invitation'` and `status: 'shortlisted'`
- [x] Add test: applicants API returns `source` field
- [x] Add test: multi-crew accept does NOT revoke invitations when positions remain
- [x] Add test: multi-crew accept DOES revoke invitations when last position is filled
- [x] Add integration test: invitation accept → application created as shortlisted (verify in DB)
- [x] Verify existing invitation tests still pass

---

#### 9. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 118] Invitation accept improvements — auto-shortlist invited crew (source column on applications, conditional status in apply_projection), "Invited" badge on review page, multi-crew invitation revocation only when positions full, stale invitation filtering`
  - Update schema version
  - Add migration 00056 to table
- [x] Update `packages/types/README.md` — new payload field
- [x] Update `supabase/README.md` — new migration
- [x] Update `apps/web/README.md` if applicants API response shape changed

---

### Stage 119: Chat Header Cleanup + Vessel Edit + Profile Vessels Button

**Goal:** Strip the chat header down to name + back + kebab (job details already in summary card). Add vessel edit UI. Add "My Vessels" button to employer profile header.

**Will NOT touch:** Database, migrations (vessel PATCH API already exists from Stage 61), messaging API, engagement lifecycle.

**Done condition:** Chat header shows only counterparty name and actions. Vessel cards have an edit affordance. Employer profile header has a My Vessels button in the correct position.

---

#### 1. Chat header — strip job context to name only

File: `apps/web/src/app/(app)/messages/[engagementId]/page.tsx`

The header currently crams job number, role, location, and dates into a single `text-xs` line. This info is already visible in:

- The daywork summary card pinned below the header
- The inbox thread list (role + location + dates)

- [x] Remove the job context `<div>` from the header (the `flex items-center gap-2 text-xs text-muted-foreground` block with job number, role, location, dates)
- [x] Keep only:
  ```tsx
  <header className="shrink-0 border-b border-border bg-background px-4 py-3">
    <div className="mx-auto flex max-w-lg items-center gap-3">
      <Link href="/messages">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-bold">{context?.other_name ?? 'Chat'}</h1>
      </div>
      {/* kebab menu unchanged */}
    </div>
  </header>
  ```
- [x] The daywork summary card remains pinned below the header — it already shows all job details in a clean, readable card format
- [x] Verify the header now looks clean on 375px mobile viewport

---

#### 2. Vessel cards — add edit button

File: `apps/web/src/app/(app)/vessels/page.tsx` (or wherever vessel list is rendered)

- [x] Add an edit icon button (Pencil) on each vessel card — top-right corner or inline
- [x] On tap, navigate to an edit form or open an inline edit mode
- [x] **Option A (simpler):** Navigate to `/vessels/[id]/edit` — new page with form pre-populated from vessel data, calls `PATCH /api/vessels/[id]`
- [x] **Option B:** Inline edit on the card — more complex, not worth it for v1
- [x] **Go with Option A.** Create `/vessels/[id]/edit/page.tsx`:
  - Fetch vessel by ID on mount
  - Pre-populate form: name, vessel type (motor/sail), LOA, NDA flag
  - IMO is read-only (immutable per CLAUDE.md)
  - Submit calls `PATCH /api/vessels/[id]`
  - Success toast + redirect back to vessels list
  - Error toast on failure
  - Try/catch/finally pattern for submit hardening
- [x] The `PATCH /api/vessels/[id]` route already exists (Stage 61) with full validation and NDA immutability guard — no API changes needed

---

#### 3. Profile header — add "My Vessels" button for employer hat

File: `apps/web/src/app/(app)/profile/page.tsx`

Current header right side: `[Edit button] [Settings gear]`
Desired order: `[My Vessels button] [Edit button] [Settings gear]`

- [x] Import `Ship` icon from lucide-react
- [x] Add a "My Vessels" icon button, only visible when `person.current_hat` is `'employer'` or `'agent'`:
  ```tsx
  <div className="flex items-center gap-1">
    {!editing && person?.current_hat !== 'crew' && (
      <Button variant="ghost" size="icon" onClick={() => router.push('/vessels')}>
        <Ship className="h-4 w-4" />
      </Button>
    )}
    {!editing && (
      <Button variant="ghost" size="sm" onClick={enterEdit}>
        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
      </Button>
    )}
    {/* ... save/cancel buttons when editing ... */}
    {!editing && (
      <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
        <Settings className="h-4 w-4" />
      </Button>
    )}
  </div>
  ```
- [x] The Ship icon button matches the Settings gear style (ghost variant, icon size)
- [x] Hidden during edit mode (same as Settings) and hidden for crew hat (crew don't own vessels for daywork posting)

---

#### 4. Tests

- [x] Verify existing chat page tests still pass after header simplification
- [x] Verify existing vessel tests still pass
- [x] No new API tests needed — `PATCH /api/vessels/[id]` already has test coverage

---

#### 5. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 119] Chat header cleanup (stripped to name + actions, job details in summary card only), vessel edit page (/vessels/[id]/edit with PATCH API), "My Vessels" Ship icon button on employer profile header`

---

### Stage 120: Toast Consistency — Success/Error Feedback on Every Mutation

**Goal:** Wire success and error toasts on every data mutation in the app. Currently only profile save has a success toast. Every other action either silently succeeds or only shows errors.

**Will NOT touch:** Database, migrations, RLS, API routes, response shapes. Purely frontend wiring.

**Done condition:** Every POST/PATCH/DELETE action shows a success toast on success and an error toast on failure. No silent mutations remain.

---

#### 1. Discover page — `apps/web/src/app/(app)/discover/page.tsx`

`useToast` already imported.

- [x] Apply action: add `showSuccess('Application sent')`
- [x] Withdraw action: add `showSuccess('Application withdrawn')`
- [x] Accept invitation: add `showSuccess('Invitation accepted')`
- [x] Decline invitation: add `showSuccess('Invitation declined')`

---

#### 2. My Jobs page — `apps/web/src/app/(app)/daywork/mine/page.tsx`

`useToast` NOT imported.

- [x] Import `useToast`, destructure `showSuccess` and `showError`
- [x] Cancel daywork: add `showSuccess('Posting cancelled')` + `showError(...)` on failure
- [x] Update positions: add `showSuccess('Positions updated')` + `showError(...)` on failure
- [x] Delete template: add `showSuccess('Template deleted')` + `showError(...)` on failure

---

#### 3. Post daywork page — `apps/web/src/app/(app)/daywork/post/page.tsx`

- [x] Import `useToast` if not already
- [x] Post daywork submit: add `showSuccess('Daywork posted')` before redirect
- [x] Save template: add `showSuccess('Template saved')` + `showError(...)` on failure

---

#### 4. Review page — `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

`useToast` already imported.

- [x] Accept applicant: add `showSuccess('Crew accepted')` (before/alongside the "Go to messages" dialog)
- [x] Reject applicant: add `showSuccess('Applicant rejected')`
- [x] Shortlist applicant: add `showSuccess('Added to shortlist')`
- [x] Invite crew: add `showSuccess('Invitation sent')` — verify this doesn't already exist inline

---

#### 5. Chat page — `apps/web/src/app/(app)/messages/[engagementId]/page.tsx`

`useToast` already imported. Most actions have error toasts but no success toasts.

- [x] Confirm completion: add `showSuccess('Completion confirmed')`
- [x] Submit rating: add `showSuccess('Rating submitted')`
- [x] Work started (initiate): add `showSuccess('Work started notification sent')`
- [x] Work started (confirm): add `showSuccess('Work started confirmed')`
- [x] Checklist submit: add `showSuccess('Checklist saved')`
- [x] Postponement request: add `showSuccess('Date change proposed')`
- [x] Respond to postponement (approve): add `showSuccess('New dates approved')`
- [x] Respond to postponement (reject): add `showSuccess('Date change rejected')`
- [x] Cancel engagement (employer submit): add `showSuccess('Cancellation submitted')`
- [x] Cancel engagement (crew submit): add `showSuccess('Cancellation submitted')`
- [x] Relist after rejection: add `showSuccess('Job relisted')`
- [x] **Skip message send** — no toast on every message (too noisy, chat is real-time feedback)

---

#### 6. Profile page — `apps/web/src/app/(app)/profile/page.tsx`

- [x] Delete experience: add `showSuccess('Experience removed')` — already planned in Stage 115, verify not duplicated
- [x] Avatar upload: verify component-level feedback exists, add toast if silent
- [x] Avatar delete: same

---

#### 7. Settings page — `apps/web/src/app/(app)/settings/page.tsx`

`useToast` NOT imported. Currently uses inline text feedback.

- [x] Import `useToast`
- [x] Export data: add `showSuccess('Data exported')` after download triggers + `showError(...)` on failure
- [x] Delete account: add `showSuccess('Account deactivated')` before signout (may flash briefly — acceptable)
- [x] Change password and change email already show inline text feedback — keep those AND add toast for consistency, or leave as-is since they have feedback. **Decision: leave as-is** — inline text is appropriate for settings forms.

---

#### 8. Vessels page — `apps/web/src/app/(app)/vessels/page.tsx`

- [x] Import `useToast` if not already
- [x] Add vessel: add `showSuccess('Vessel added')` + `showError(...)` on failure

---

#### 9. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 120] Toast consistency — success/error toasts on all mutations across discover (apply/withdraw/invite), mine (cancel/positions/templates), post (submit/save template), review (accept/reject/shortlist/invite), chat (completion/rating/work-started/checklist/postponement/cancel/relist), settings (export/delete), vessels (add)`

---

### Stage 121: Test Gap Coverage — Engagement State Machine + Notification Count

**Goal:** Add test coverage for the 7 highest-priority untested API routes, focused on the engagement state machine (postponement, crew cancel response, relist) and the notification count endpoint.

**Will NOT touch:** Database, migrations, UI components, existing tests.

**Done condition:** All P1 and P2 routes have test coverage. No regressions in existing test suite.

---

#### 1. Propose postponement — `apps/web/__tests__/api/engagements-propose-postponement.test.ts`

Route: `POST /api/engagements/[id]/propose-postponement`

- [ ] Test: happy path — employer proposes new dates → 200
- [ ] Test: crew hat → 403 (only employer can propose)
- [ ] Test: non-owner employer → 403
- [ ] Test: engagement not active → 400
- [ ] Test: work already started → 400
- [ ] Test: postponement already proposed (once-only) → 400
- [ ] Test: proposed dates have overlap conflict, no `confirmConflict` → 200 with `conflict: true`
- [ ] Test: proposed dates have overlap conflict, `confirmConflict: true` → 200 (cancels + relists)

---

#### 2. Respond to postponement — `apps/web/__tests__/api/engagements-respond-postponement.test.ts`

Route: `POST /api/engagements/[id]/respond-postponement`

- [ ] Test: crew approves → 200, dates updated
- [ ] Test: crew rejects → 200, engagement cancelled
- [ ] Test: employer hat → 403 (only crew can respond)
- [ ] Test: no pending postponement → 400
- [ ] Test: engagement not active → 400

---

#### 3. Respond to crew cancel — `apps/web/__tests__/api/engagements-respond-crew-cancel.test.ts`

Route: `POST /api/engagements/[id]/respond-crew-cancel`

- [ ] Test: employer chooses `relist` → 200, daywork relisted
- [ ] Test: employer chooses `cancel` → 200, daywork cancelled
- [ ] Test: crew hat → 403
- [ ] Test: no crew cancellation pending → 400
- [ ] Test: daywork already completed → 400

---

#### 4. Notification count — `apps/web/__tests__/api/notifications-count.test.ts`

Route: `GET /api/notifications/count`

- [ ] Test: returns `message_count` and `notification_count` for current hat
- [ ] Test: returns `alt_message_count` and `alt_notification_count` for other hat
- [ ] Test: message count reflects threads-with-unread (after Stage 116 fix), not total messages
- [ ] Test: unread count respects read cursor (messages after cursor are unread)
- [ ] Test: unauthenticated → 401

---

#### 5. Invite crew — `apps/web/__tests__/api/daywork-invite.test.ts`

Route: `POST /api/daywork/[id]/invite`

- [ ] Test: happy path — employer invites crew → 200
- [ ] Test: crew hat → 403
- [ ] Test: non-owner → 403
- [ ] Test: crew already applied → 400
- [ ] Test: crew already invited → 400
- [ ] Test: invitation limit reached (2 per position) → 400
- [ ] Test: daywork not active → 400

---

#### 6. Extend daywork — `apps/web/__tests__/api/daywork-extend.test.ts`

Route already has a test file from Stage 110 — verify coverage is complete.

- [ ] Verify: backward extension → 400
- [ ] Verify: invalid workingDayDates → 400
- [ ] Add if missing: happy path → 200
- [ ] Add if missing: non-owner → 403

---

#### 7. Relist with dates — `apps/web/__tests__/api/engagements-relist-with-dates.test.ts`

Route already has a partial test file — verify and expand.

- [ ] Verify: relist on completed daywork → 400
- [ ] Verify: relist on cancelled daywork → 400
- [ ] Add if missing: happy path → 200
- [ ] Add if missing: crew hat → 403
- [ ] Add if missing: non-owner → 403

---

#### 8. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 121] Test gap coverage — propose-postponement (8 tests), respond-postponement (5 tests), respond-crew-cancel (5 tests), notifications/count (5 tests), daywork/invite (7 tests), extend/relist verification`

---

### Stage 122: 100% API Route Test Coverage

**Goal:** Close the remaining 8 untested API routes. After this, every route in the app has at least basic test coverage.

**Will NOT touch:** Database, migrations, UI, existing tests. Test-only stage.

**Done condition:** Every `route.ts` file under `apps/web/src/app/api/` has a corresponding test file with at least happy path, auth, and basic validation tests. Zero untested routes.

---

#### 1. Checklist set — `apps/web/__tests__/api/engagements-checklist-set.test.ts`

Route: `POST /api/engagements/[id]/checklist`

- [ ] Test: happy path — employer sets checklist items → 200
- [ ] Test: crew hat → 403 (only employer can set checklist)
- [ ] Test: non-participant → 403
- [ ] Test: engagement not active → 400
- [ ] Test: empty items array → 400

---

#### 2. Checklist toggle — `apps/web/__tests__/api/engagements-checklist-toggle.test.ts`

Route: `POST /api/engagements/[id]/checklist/toggle`

- [ ] Test: happy path — crew toggles item on → 200
- [ ] Test: employer hat → 403 (only crew can toggle)
- [ ] Test: non-participant → 403
- [ ] Test: invalid item_id → 400

---

#### 3. Message read cursor — `apps/web/__tests__/api/messages-read.test.ts`

Route: `POST /api/messages/[engagementId]/read`

- [ ] Test: happy path — participant marks read → 200
- [ ] Test: non-participant → 403
- [ ] Test: invalid engagement ID → 404
- [ ] Test: unauthenticated → 401

---

#### 4. Notification mark read — `apps/web/__tests__/api/notifications-read.test.ts`

Route: `POST /api/notifications/read`

- [ ] Test: happy path — mark all read (`all: true`) → 200
- [ ] Test: happy path — mark specific IDs read → 200
- [ ] Test: empty body / no IDs → 400
- [ ] Test: unauthenticated → 401

---

#### 5. Push tokens — `apps/web/__tests__/api/push-tokens.test.ts`

Route: `POST /api/push-tokens` + `DELETE /api/push-tokens`

- [ ] Test: POST happy path — register token → 200
- [ ] Test: POST invalid platform (not apns/fcm/web) → 400
- [ ] Test: POST missing token → 400
- [ ] Test: DELETE happy path — remove token → 200
- [ ] Test: unauthenticated → 401

---

#### 6. View profile — `apps/web/__tests__/api/profile-view.test.ts`

Route: `GET /api/profile/[personId]`

- [ ] Test: happy path — viewer has engagement with target → 200, returns profile
- [ ] Test: no relationship (no engagement, application, or invitation) → 403
- [ ] Test: crew profile returns expected fields (bio, role, certs, experience bracket, experiences without salary)
- [ ] Test: employer profile returns expected fields (agency, role specializations, vessels, posting count)
- [ ] Test: unauthenticated → 401

---

#### 7. Get single experience — `apps/web/__tests__/api/experience-get.test.ts`

Route: `GET /api/experiences/[id]`

- [ ] Test: happy path — owner fetches own experience → 200
- [ ] Test: non-owner → 403 (or 404 depending on RLS)
- [ ] Test: invalid ID → 404
- [ ] Test: unauthenticated → 401

---

#### 8. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 122] 100% API route test coverage — checklist set/toggle (9 tests), message read cursor (4 tests), notification read (4 tests), push tokens (5 tests), view profile (5 tests), get experience (4 tests); total ~31 new tests; all 69 API routes now covered`

---

### Stage 123: Crew Nationality + Visas (DEFERRED — full spec, ready to pick up)

**Goal:** Add nationality and available visas to crew profiles. Both canonical lookups. Displayed across all crew-facing surfaces with nationality flag visual.

**Requires:** Migration (new tables + columns), seed data, API changes, onboarding update, UI across multiple pages. Plan fully before implementing.

**Will touch:** Migration, seed data, onboarding route + UI, profile API + page, profile overlay, applicant cards, available crew cards, discover application/invitation cards, view-only profile API.

---

#### 1. Migration — `00057_nationality_and_visas.sql`

- [ ] Create `nationalities` canonical lookup table:

  ```sql
  create table public.nationalities (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,        -- 'South African', 'British', 'French', etc.
    country_code text not null unique, -- 'ZA', 'GB', 'FR' (ISO 3166-1 alpha-2)
    flag_emoji text not null,          -- '🇿🇦', '🇬🇧', '🇫🇷'
    sort_order int not null default 0
  );
  ```

  RLS: read-only for authenticated users.

- [ ] Create `visa_types` canonical lookup table:

  ```sql
  create table public.visa_types (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,      -- 'Schengen', 'B1/B2 (US)', 'C1/D (US)', 'UAE Residence', 'UK Work Visa', etc.
    region text,                     -- optional grouping: 'Europe', 'Americas', 'Middle East', 'Other'
    sort_order int not null default 0
  );
  ```

  RLS: read-only for authenticated users.

- [ ] Add columns to `profiles`:

  ```sql
  alter table public.profiles add column nationality_id uuid references public.nationalities(id);
  alter table public.profiles add column visa_ids uuid[] default '{}';
  ```

- [ ] Update `apply_projection` for `PROFILE.CREATED` and `PROFILE.UPDATED` to write `nationality_id` and `visa_ids` from payload

- [ ] Seed data — nationalities: start with the top maritime crew nationalities (~30-40 countries covering major flag states + common crew origins). Visa types: Schengen, B1/B2 US, C1/D US, UAE residence, UK work visa, Australian work visa, Bahamian work permit, plus an "Other" catch-all.

- [ ] Corresponding rollback

---

#### 2. Types — `packages/types/src/events.ts`

- [ ] Add `nationality_id?: string` and `visa_ids?: string[]` to `PROFILE.CREATED` and `PROFILE.UPDATED` payloads

---

#### 3. Onboarding — collect nationality + visas

- [ ] API: `POST /api/onboarding` — accept `nationalityId` and `visaIds` in profile payload
- [ ] UI: add nationality dropdown (searchable, with flag emoji prefix) and visa multi-select to the onboarding flow
- [ ] Nationality required for crew, visas optional

---

#### 4. Profile edit — nationality + visas editable

- [ ] Profile page edit mode: add nationality dropdown + visa multi-select
- [ ] Profile save: include `nationalityId` and `visaIds` in PROFILE.UPDATED event

---

#### 5. Profile display — nationality flag visual

- [ ] Crew profile page: show nationality flag emoji + country name near the display name
- [ ] Visa pills below nationality (similar to cert pills)
- [ ] Profile overlay: same — flag + name in header, visa pills in body

---

#### 6. Cards — nationality flag on all crew-visible surfaces

- [ ] Review page ApplicantCard: nationality flag emoji next to crew name
- [ ] Review page AvailableCrewCard: same
- [ ] Discover page application cards: flag next to role/name if visible
- [ ] Discover page invitation cards: flag on employer view of invited crew (if applicable)
- [ ] Messages list: optional — flag next to counterparty name

---

#### 7. View-only profile API — include nationality + visas

- [ ] `GET /api/profile/[personId]`: include `nationality` (resolved name + country_code + flag_emoji) and `visas` (resolved names) in crew profile response

---

#### 8. Tests

- [ ] Onboarding test: nationality + visas persisted
- [ ] Profile update test: nationality + visa change
- [ ] View profile test: nationality + visas returned
- [ ] Integration test: PROFILE.CREATED with nationality_id + visa_ids → projection writes correctly

---

#### 9. Documentation

- [ ] Update `BUILD_STATE.md`: stage entry, schema version, migration table
- [ ] Update `packages/types/README.md` — new payload fields
- [ ] Update `supabase/README.md` — new migration + tables
- [ ] Update `apps/web/README.md` — new lookup endpoints if any

---

## Done

(See git history for completed stages 51-113)
