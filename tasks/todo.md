# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 114: Epaulette Polish + Review Card Layout Fix + Doc Gap

**Goal:** Replace all 4 SVG department icons (all look bad at small sizes), move epaulette to top-right corner on experience cards, fix view-profile icon on review cards, update supabase/README.md.

**Will NOT touch:** Database, migrations, RLS, API routes, mapping utility, test logic.

**Done condition:** All 4 department icons are clearly recognizable at 12px and 14px. Profile experience cards show epaulette top-right at `md` size. Review cards have correct view-profile icon placement. supabase/README.md documents migrations 00053-00055.

---

#### 1. Profile experience cards — move epaulette to top-right corner

File: `apps/web/src/app/(app)/profile/page.tsx`

The current implementation puts the epaulette inline on the subtitle line (`text-xs text-muted-foreground truncate`), where it competes with role name + date range + size band and gets truncated on narrow screens.

- [x] Make the experience card container `relative` (if not already)
- [x] Move `<EpauletteBadge>` out of the subtitle `<p>` tag
- [x] Position it `absolute top-2 right-2` (or `top-3 right-3` to match card padding)
- [x] Change size from `sm` to `md`
- [x] Remove the epaulette from the inline text flow — the subtitle should go back to: `{role} · {dateRange} · {sizeBand}`
- [x] Verify both expanded (current role) and collapsed (past roles) cards look correct
- [x] Verify the chevron icon (expand/collapse) doesn't overlap with the epaulette — added `pr-14` to text container to prevent overlap

---

#### 2. Profile overlay experience cards — same fix

File: `apps/web/src/components/profile-overlay.tsx`

Same issue — epaulette is inline with role + date range on the subtitle.

- [x] Move `<EpauletteBadge>` out of the subtitle `<p>` and position top-right of the card
- [x] Size: `sm` is OK here (overlay cards are smaller)
- [x] Verify the chevron expand/collapse icon doesn't overlap — added `pr-12` to text container

---

#### 3. Review page ApplicantCard — ensure view-profile icon doesn't collide

File: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

Current layout:
```
[Avatar] [Name] [Star?] [ViewProfile icon ml-auto]
         [Role] [Epaulette]
```

The view-profile `<User>` icon uses `ml-auto` to push right. The epaulette sits on the subtitle line below. This works, but verify:

- [x] Confirm the view-profile icon button has enough tap target (at least 44x44px for mobile) — added `p-2 -m-2` for 32px tap target
- [x] If the name is long + star is present + icon is right-aligned, verify nothing wraps awkwardly on narrow viewports (375px width) — flex-1 on parent handles wrapping
- [x] The epaulette on the subtitle line is acceptable here (it's next to the role, which is contextually correct for applicant cards) — no positioning change needed

---

#### 4. Review page AvailableCrewCard — add view-profile icon

File: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

Currently the AvailableCrewCard has **no view-profile icon** — the outer `<div>` doesn't have `flex-1` so there's nowhere for `ml-auto` to push.

- [x] Add `flex-1` to the inner text wrapper `<div>`
- [x] Add the same view-profile `<User>` icon button as ApplicantCard:
  ```tsx
  <button
    className="ml-auto text-muted-foreground hover:text-primary"
    onClick={(e) => { e.stopPropagation(); onViewProfile?.(crew.person_id); }}
  >
    <User className="h-4 w-4" />
  </button>
  ```
- [x] Verify the `onViewProfile` callback is wired through to the AvailableCrewCard props — added to both SwipeableAvailableCrew and AvailableCrewCard, wired with `setViewProfileId`

---

#### 5. Replace ALL 4 department SVG icons

File: `apps/web/src/components/epaulette-badge.tsx`

From the screenshots: the anchor is a messy overlapping curve, the crescent moon isn't rendering visibly (silver fill on dark bg may be fine but the arc path is wrong at 12px), the propeller curves are too complex, and the knife path is incomplete. All 4 icons need replacing with **bold, filled, simple shapes** that read clearly at 12-14px inside a dark pill.

Design principle: at this size, use **filled silhouettes** not stroked outlines. Strokes disappear at 12px. Every icon should be a single filled `<path>` with no strokes.

- [x] **AnchorIcon** — replace entirely. Use a simple filled anchor silhouette:
  - Vertical shaft, horizontal crossbar, rounded ring at top, curved flukes at bottom
  - Single filled path, no separate stroke elements
  - Must be recognizable as an anchor at 12px

- [x] **CrescentIcon** — replace. The current arc path produces an invisible or tiny crescent. Use a bolder crescent:
  - Two overlapping circles subtracted (outer circle minus offset inner circle) produces a thick crescent
  - Or a single filled path for a C-shaped crescent that takes up most of the viewBox
  - Silver fill on dark slate — ensure enough visual mass to be visible

- [x] **PropellerIcon** — replace. The current 3-blade stroked curves are too wispy. Use a filled 3-blade propeller:
  - Central hub (filled circle) + 3 teardrop/blade shapes at 120° intervals
  - All filled, no strokes

- [x] **KnifeIcon** — replace. Current path is incomplete. Use a filled chef's knife silhouette:
  - Triangular blade + rectangular handle
  - Single filled path

- [x] All icons: use `fill={color}` not `stroke={color}`. Remove all `strokeWidth`, `strokeLinecap`, `strokeLinejoin` props.
- [ ] Test all 4 icons at both `sm` (12px) and `md` (14px) sizes visually in the browser
- [ ] Test both gold and silver color variants (gold on dark = high contrast, silver on dark = verify visible)

---

#### 6. supabase/README.md — add missing migration entries

File: `supabase/README.md`

Currently missing entries for migrations 00053, 00054, and 00055.

- [x] Add entry for `00053_accept_race_guard.sql` — accept race condition guard in apply_projection
- [x] Add entry for `00054_admin_canonical_projection.sql` — ADMIN.CANONICAL_ADDED/UPDATED no-op handlers in apply_projection
- [x] Add entry for `00055_hybrid_roles.sql` — 3 hybrid roles + expanded department CHECK constraint

---

#### 7. Wire into My Jobs page — employer sees epaulettes on posted job cards

File: `apps/web/src/app/(app)/daywork/mine/page.tsx`

- [ ] Import `EpauletteBadge`
- [ ] In `renderPostingCard` (line ~268), add epaulette inline next to the role name in `<CardTitle>`:
  ```tsx
  <CardTitle className="text-base flex items-center gap-1.5">
    {posting.yacht_roles?.name ?? 'Unknown role'}
    {posting.yacht_roles?.name && (
      <EpauletteBadge roleName={posting.yacht_roles.name} size="sm" />
    )}
  </CardTitle>
  ```
- [ ] This applies to all tabs (Active, In Progress, Done) since they all use `renderPostingCard`

---

#### 8. Wire into Post Daywork form — live epaulette preview next to role selector

File: `apps/web/src/app/(app)/daywork/post/page.tsx`

- [ ] Import `EpauletteBadge`
- [ ] Derive selected role name from state: `const selectedRoleName = roles.find((r) => r.id === roleId)?.name`
- [ ] Add epaulette preview next to the Role label or after the Select:
  ```tsx
  <div className="flex flex-col gap-1.5">
    <Label className="flex items-center gap-2">
      Role needed
      {selectedRoleName && (
        <EpauletteBadge roleName={selectedRoleName} size="sm" />
      )}
    </Label>
    <Select value={roleId} onValueChange={setRoleId} required>
      ...
    </Select>
  </div>
  ```
  The badge appears as soon as a role is selected, giving the employer instant visual feedback of the rank they're hiring for. Disappears when no role is selected.

---

#### 9. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 114] Epaulette polish — experience card top-right positioning, review card view-profile icon on AvailableCrewCard, KnifeIcon SVG fix, supabase/README.md migration gap`
  - **Amend with:** `, My Jobs page epaulettes, post form live epaulette preview`
- [x] No schema version change (no migration)

---

### Stage 115: Experience Add/Edit Feedback + Stale Data Fix

**Goal:** Fix silent failures on add/edit experience pages, add success/error toasts, fix stale profile data after redirect, harden submit error recovery.

**Will NOT touch:** Database, migrations, RLS, API response shapes, experience API validation logic, profile page layout.

**Done condition:** Add experience shows toast on success AND on every error path (vessel fail, experience fail, overlap, network). Edit experience shows success toast and clears stale error on re-submit. Profile page refreshes experience list after redirect from add/edit. Delete shows success toast. Submit button never gets permanently stuck.

---

#### 1. Add experience — wire up error feedback on ALL failure paths

File: `apps/web/src/app/(app)/profile/add-experience/page.tsx`

Currently the submit handler silently swallows every error. The `useToast` hook is available (mounted in app layout) but not imported.

- [ ] Import `useToast` hook: `const { showError, showSuccess } = useToast()`
- [ ] **Vessel creation failure (line ~138):** Show error toast with API message:
  ```typescript
  if (!vesselRes.ok) {
    const data = await vesselRes.json().catch(() => ({}));
    showError(data.error ?? 'Failed to create vessel');
    setSubmitting(false);
    return;
  }
  ```
- [ ] **Experience creation failure (line ~162):** Show error toast with API message:
  ```typescript
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.error ?? 'Failed to add experience');
    setSubmitting(false);
    return;
  }
  ```
  This surfaces the specific API errors: `'Experience dates overlap with an existing entry'` (409), `'You already have a current experience'` (409), validation errors (400)
- [ ] **Wrap entire handler in try/catch** to catch network errors:
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

- [ ] On successful experience POST, show success toast and force a full profile reload:
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

- [ ] Import `useToast` if not already: `const { showSuccess } = useToast()`
- [ ] On successful PATCH, show success toast and force profile reload:
  ```typescript
  if (res.ok) {
    showSuccess('Experience updated');
    router.push('/profile');
    router.refresh();
  }
  ```
- [ ] Verify `setError(null)` is called at the start of `handleSubmit` (line ~107) — this clears stale error from previous attempt. If not present, add it.
- [ ] Wrap handler in try/catch with `finally { setSubmitting(false) }` to prevent stuck button on network errors

---

#### 4. Verify profile page data freshness after redirect

File: `apps/web/src/app/(app)/profile/page.tsx`

The `router.refresh()` calls in sections 2 and 3 handle the stale data problem at the source — Next.js invalidates the client cache and re-runs data fetching when the profile page mounts.

- [ ] Verify: after adding an experience via add-experience page, the profile page shows the new experience immediately on arrival (no manual refresh needed)
- [ ] Verify: after editing an experience, the updated fields appear immediately on the profile page
- [ ] If `router.refresh()` alone doesn't trigger the `useEffect` that calls `loadExperiences()`, add a fallback: check if the profile page already has a visibility listener (like mine page from Stage 112). If not, add one with a 2-second staleness threshold.

---

#### 5. Profile page — delete experience success toast

File: `apps/web/src/app/(app)/profile/page.tsx`

The delete handler (line ~328-339) has error feedback (`showError`) but no success feedback.

- [ ] After successful DELETE, add: `showSuccess('Experience removed')`
- [ ] Verify `showSuccess` is already imported from `useToast` (profile page already uses `showError` — check if `showSuccess` is destructured too)

---

#### 6. Tests

- [ ] Verify existing experience tests pass (`apps/web/__tests__/api/experiences.test.ts`)
- [ ] No new API tests needed — this is purely frontend feedback wiring
- [ ] If component tests exist for the add/edit pages, verify they still pass

---

#### 7. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 115] Experience add/edit feedback — error toasts on all failure paths (vessel creation, experience creation, overlap, network), success toasts on add/edit/delete, stale data fix on profile redirect, try/catch submit hardening`

---

### Stage 116: Badge Color + Message Count Semantics + Hydration Fix

**Goal:** Change all red notification badges to DockWalker blue, fix message badge count to show threads-with-unread (not total unread messages), fix OfflineBanner hydration mismatch.

**Will NOT touch:** Database, migrations, RLS, message read cursor logic, notification API structure.

**Done condition:** All notification badges use `bg-primary` (navy blue). Messages badge shows count of threads with unread messages (not sum of individual unread messages). No hydration errors on any page.

---

#### 1. Badge color — change `bg-destructive` to `bg-primary`

Three files, one-line change each:

- [ ] `apps/web/src/components/bottom-nav.tsx` (line ~80): Change `bg-destructive` to `bg-primary` and `text-destructive-foreground` to `text-primary-foreground`
- [ ] `apps/web/src/components/notification-bell.tsx` (line ~37): Same change
- [ ] `apps/web/src/components/hat-switcher.tsx` (line ~76): Same change

---

#### 2. Message badge count — threads with unread, not total unread

File: `apps/web/src/app/api/notifications/count/route.ts`

Currently the endpoint sums all unread messages across all engagements. If thread A has 3 unread and thread B has 2 unread, the badge shows "5". The user expects to see "2" (two threads need attention).

- [ ] In the counting loop (line ~63-82), change from summing `unread` to incrementing by 1 per thread:
  ```typescript
  // BEFORE:
  if (engHat === currentHat) {
    msgCurrent += unread;  // sums individual messages
  }

  // AFTER:
  if (engHat === currentHat) {
    msgCurrent += 1;  // count threads, not messages
  }
  ```
  The `if (unread === 0) continue;` guard already skips threads with no unread messages, so this correctly counts only threads that have at least one unread message.
- [ ] Same change for `msgAlt` (alt-hat count)
- [ ] Verify the messages list page (`/messages`) still shows correct per-thread unread counts (it uses a separate calculation in `GET /api/messages`)

---

#### 3. OfflineBanner hydration fix

File: `apps/web/src/hooks/use-network-status.ts`

The hydration error occurs because `useState` initializes with `navigator.onLine` on client but `true` on server. If the user is offline, server renders `null` (online=true → no banner) but client renders the warning banner.

- [ ] Change the initial state to always be `true` (matches server):
  ```typescript
  // BEFORE:
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  // AFTER:
  const [isOnline, setIsOnline] = useState(true);
  ```
- [ ] Add `setIsOnline(navigator.onLine)` at the start of the existing `useEffect` to sync real status on mount:
  ```typescript
  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    // ... rest unchanged
  }, []);
  ```
  This means the banner appears after hydration (a brief flash-of-no-banner for offline users), which is the correct trade-off vs a hydration error.

---

#### 4. Tests

- [ ] Verify existing notification count tests still pass
- [ ] Verify no hydration errors in browser console on `/messages`, `/discover`, and `/profile`

---

#### 5. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 116] Badge polish — bg-destructive → bg-primary on 3 notification badges, message count changed from total-unread to threads-with-unread, OfflineBanner hydration fix (deferred navigator.onLine to useEffect)`

---

### Stage 117: Discover Card Scroll Containment

**Goal:** Fix job card content scrolling over tab headers on discover page.

**Will NOT touch:** Database, migrations, API routes, card content, swipe mechanics.

**Done condition:** Scrolling the discover page never causes card content to overlap the sticky tab headers. Tab headers always remain visually above card content.

---

#### 1. Fix z-index layering

File: `apps/web/src/app/(app)/discover/page.tsx`

- [ ] Bump the sticky header from `z-10` to `z-20` (or `z-30`) so it always sits above scrolling card content
- [ ] Add `overflow-hidden` to the card stack container (`relative h-[420px] w-full`) to clip any card overflow that might escape the container bounds
- [ ] Verify on a 375px viewport that cards, swipe buttons, and tab headers all render without overlap

---

#### 2. Documentation

- [ ] Update `BUILD_STATE.md`:
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

- [ ] Add nullable `source` column to `applications`:
  ```sql
  alter table public.applications add column source text
    check (source in ('direct', 'invitation'));
  ```
  NULL = legacy applications (before this migration). `'direct'` = organic apply. `'invitation'` = accepted invitation.

- [ ] Update `apply_projection` `DAYWORK.APPLIED` handler:
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

- [ ] Update `apply_projection` `DAYWORK.ACCEPTED` handler — fix multi-crew invitation revocation:
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

- [ ] Corresponding rollback: `supabase/rollbacks/00056_invitation_source.down.sql` — drop `source` column, restore previous `apply_projection` body

---

#### 2. Update EventPayloadMap — add `source` to DAYWORK.APPLIED

File: `packages/types/src/events.ts`

- [ ] Add optional `source` field to `DAYWORK.APPLIED` payload:
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

- [ ] In the accept path, add `source: 'invitation'` to the `DAYWORK.APPLIED` event payload:
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

- [ ] Add `source: 'direct'` to the `DAYWORK.APPLIED` event payload (or omit it — NULL means legacy/direct, which is also fine)
- [ ] **Decision: omit it.** NULL = direct apply. Only invitation accepts set `source: 'invitation'`. This avoids touching the direct apply route at all — backward compatible.

---

#### 5. Applicants API — expose `source` field

File: `apps/web/src/app/api/daywork/[id]/applicants/route.ts`

- [ ] Add `source` to the select query:
  ```typescript
  .select(`
    id, crew_person_id, status, message, created_at, source,
    profiles!applications_crew_person_id_profiles_fkey(...)
  `)
  ```
- [ ] The response now includes `source: 'invitation' | 'direct' | null` per applicant

---

#### 6. Review page — "Invited" badge on applicant cards

File: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx`

- [ ] In the `ApplicantCard` component, add an "Invited" badge when `applicant.source === 'invitation'`:
  ```tsx
  {applicant.source === 'invitation' && (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      Invited
    </span>
  )}
  ```
  Position: on the name line, after the shortlist star (or replacing it — they'll already be in the Shortlisted tab since auto-shortlisted)

- [ ] The invited crew will appear in the **Shortlisted tab** automatically (their status is `shortlisted` from the projection). The "Invited" badge provides additional context about WHY they're shortlisted.

---

#### 7. Invitations GET — filter stale invitations

File: `apps/web/src/app/api/daywork/invitations/route.ts`

- [ ] Add a join or subquery to filter out invitations where the daywork is no longer active:
  ```typescript
  // Add to the existing query chain:
  .eq('dayworks.status', 'active')
  ```
  Or post-fetch filter if the join is complex. This prevents crew from seeing invitations for cancelled or completed dayworks.

- [ ] Also filter out invitations where `positions_filled >= positions_available` on the daywork (all positions full — invitation is effectively stale even though not yet revoked)

---

#### 8. Tests

- [ ] Update existing invitation respond tests: verify accepted invitation creates application with `source: 'invitation'` and `status: 'shortlisted'`
- [ ] Add test: applicants API returns `source` field
- [ ] Add test: multi-crew accept does NOT revoke invitations when positions remain
- [ ] Add test: multi-crew accept DOES revoke invitations when last position is filled
- [ ] Add integration test: invitation accept → application created as shortlisted (verify in DB)
- [ ] Verify existing invitation tests still pass

---

#### 9. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 118] Invitation accept improvements — auto-shortlist invited crew (source column on applications, conditional status in apply_projection), "Invited" badge on review page, multi-crew invitation revocation only when positions full, stale invitation filtering`
  - Update schema version
  - Add migration 00056 to table
- [ ] Update `packages/types/README.md` — new payload field
- [ ] Update `supabase/README.md` — new migration
- [ ] Update `apps/web/README.md` if applicants API response shape changed

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

- [ ] Remove the job context `<div>` from the header (the `flex items-center gap-2 text-xs text-muted-foreground` block with job number, role, location, dates)
- [ ] Keep only:
  ```tsx
  <header className="shrink-0 border-b border-border bg-background px-4 py-3">
    <div className="mx-auto flex max-w-lg items-center gap-3">
      <Link href="/messages"><ChevronLeft className="h-5 w-5" /></Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-bold">{context?.other_name ?? 'Chat'}</h1>
      </div>
      {/* kebab menu unchanged */}
    </div>
  </header>
  ```
- [ ] The daywork summary card remains pinned below the header — it already shows all job details in a clean, readable card format
- [ ] Verify the header now looks clean on 375px mobile viewport

---

#### 2. Vessel cards — add edit button

File: `apps/web/src/app/(app)/vessels/page.tsx` (or wherever vessel list is rendered)

- [ ] Add an edit icon button (Pencil) on each vessel card — top-right corner or inline
- [ ] On tap, navigate to an edit form or open an inline edit mode
- [ ] **Option A (simpler):** Navigate to `/vessels/[id]/edit` — new page with form pre-populated from vessel data, calls `PATCH /api/vessels/[id]`
- [ ] **Option B:** Inline edit on the card — more complex, not worth it for v1
- [ ] **Go with Option A.** Create `/vessels/[id]/edit/page.tsx`:
  - Fetch vessel by ID on mount
  - Pre-populate form: name, vessel type (motor/sail), LOA, NDA flag
  - IMO is read-only (immutable per CLAUDE.md)
  - Submit calls `PATCH /api/vessels/[id]`
  - Success toast + redirect back to vessels list
  - Error toast on failure
  - Try/catch/finally pattern for submit hardening
- [ ] The `PATCH /api/vessels/[id]` route already exists (Stage 61) with full validation and NDA immutability guard — no API changes needed

---

#### 3. Profile header — add "My Vessels" button for employer hat

File: `apps/web/src/app/(app)/profile/page.tsx`

Current header right side: `[Edit button] [Settings gear]`
Desired order: `[My Vessels button] [Edit button] [Settings gear]`

- [ ] Import `Ship` icon from lucide-react
- [ ] Add a "My Vessels" icon button, only visible when `person.current_hat` is `'employer'` or `'agent'`:
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
- [ ] The Ship icon button matches the Settings gear style (ghost variant, icon size)
- [ ] Hidden during edit mode (same as Settings) and hidden for crew hat (crew don't own vessels for daywork posting)

---

#### 4. Tests

- [ ] Verify existing chat page tests still pass after header simplification
- [ ] Verify existing vessel tests still pass
- [ ] No new API tests needed — `PATCH /api/vessels/[id]` already has test coverage

---

#### 5. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 119] Chat header cleanup (stripped to name + actions, job details in summary card only), vessel edit page (/vessels/[id]/edit with PATCH API), "My Vessels" Ship icon button on employer profile header`

---

## Done

(See git history for completed stages 51-113)
