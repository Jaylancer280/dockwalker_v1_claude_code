# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Fix 131a: Withdraw confirmation dialog for selected permanent applications

**Goal:** Add a confirmation dialog when crew withdraws from a permanent application with `selected` status. Withdrawing from `selected` closes the engagement and reverts the posting — this is a significant action that warrants a "are you sure?" step.

**Will touch:** `apps/web/src/app/(app)/discover/_components/permanent-application-card.tsx`

**Will NOT touch:** API routes, other components, tests (UI-only change).

**Done condition:** Withdrawing from `applied` or `shortlisted` works immediately (no dialog). Withdrawing from `selected` shows confirmation dialog: "Withdrawing will close the conversation with the employer. Continue?" with Cancel and Withdraw buttons.

---

- [x] Import `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` from `@/components/ui/dialog`
- [x] Add state: `const [confirmOpen, setConfirmOpen] = useState(false)`
- [x] Change withdraw button onClick for `selected` status
- [x] Dialog content with title, description, cancel, withdraw (destructive)
- [x] `npx tsc --noEmit` — zero errors
- [ ] Commit

---

### Stage 132: Permanent Review + Shortlist + Select

**Goal:** Employers can review permanent applicants in a scrollable list, shortlist candidates (capped), and select one candidate to enter negotiation (creates engagement, opens chat). New review page with Applicants + Shortlist tabs. Profile view context updated for permanent relationships.

**Will touch:** New review page + API routes (review, shortlist, select, reject, view), existing profile view context route (additive OR branch).

**Will NOT touch:** Daywork review page, daywork applicant routes, daywork swipe mechanic, discover page, apply route, chat page, migrations.

**Done condition:** Employer can view applicants for a permanent posting, shortlist (capped), select one to enter negotiation. Engagement created on selection. Profile view works for permanent relationships. All tests pass. `tsc` + `eslint` clean.

**Context:** See `tasks/permanent-jobs-spec.md` → Shortlist Mechanics, The Permanent Hiring Funnel, Event Types (SHORTLISTED, REJECTED, SELECTED).

---

#### 1. GET `/api/permanent/[id]/review/route.ts` — Applicants + shortlist

New file: `apps/web/src/app/api/permanent/[id]/review/route.ts`

- [ ] Auth: `requireDomainUser()`, employer/agent hat check
- [ ] Top-level try/catch
- [ ] Fetch posting: `.from('permanent_postings').select('id, employer_person_id, status, shortlist_cap').eq('id', postingId).single()`
- [ ] Validate ownership: `posting.employer_person_id === user.id`
- [ ] Fetch applications with profile joins:
  ```typescript
  .from('applications')
  .select(`
    id, crew_person_id, status, message, created_at, source,
    profiles!applications_crew_person_id_profiles_fkey(
      display_name, bio, avatar_url,
      primary_role_id, certification_ids, experience_bracket_id,
      vessel_size_exposure_ids, nationality_id, visa_ids,
      permanent_availability, notice_period_days, currently_employed,
      yacht_roles:primary_role_id(name, department),
      experience_brackets:experience_bracket_id(label),
      ports:location_port_id(name, cities(name, regions(name))),
      nationalities:nationality_id(name, flag_emoji)
    )
  `)
  .eq('permanent_posting_id', postingId)
  .in('status', ['applied', 'shortlisted', 'selected'])
  .order('created_at', { ascending: true })
  ```
- [ ] Enrich with past engagement count (completed engagements, same pattern as daywork)
- [ ] Enrich with permanent availability display (from profile join — already in select)
- [ ] Response shape:
  ```typescript
  {
    applicants: [...],
    shortlist_cap: posting.shortlist_cap,
    shortlist_count: number,  // count of shortlisted + selected
    posting_status: posting.status,  // for negotiation banner
    selected_crew_id: string | null,  // for "In negotiation" badge
  }
  ```
- [ ] `shortlist_count` derived from applicants with status `shortlisted` or `selected`
- [ ] `selected_crew_id` derived from applicant with status `selected` (null if none)

---

#### 2. POST `/api/permanent/[id]/shortlist/route.ts` — Shortlist a candidate

New file: `apps/web/src/app/api/permanent/[id]/applicants/[crewId]/shortlist/route.ts`

- [ ] Auth: `requireDomainUser()`, employer/agent hat check
- [ ] Top-level try/catch, safe `request.json()`
- [ ] Fetch posting: validate ownership, status is `active` or `in_negotiation`
- [ ] Fetch application: `.eq('crew_person_id', crewId).eq('permanent_posting_id', postingId).single()`
- [ ] Validate application status is `'applied'` (only applied can be shortlisted)
- [ ] Pre-check shortlist cap:
  ```typescript
  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('permanent_posting_id', postingId)
    .in('status', ['shortlisted', 'selected']);
  if (count >= posting.shortlist_cap) {
    return NextResponse.json(
      { error: `Shortlist is full (${count} of ${posting.shortlist_cap})` },
      { status: 400 },
    );
  }
  ```
- [ ] `appendEvent`:
  ```typescript
  eventType: 'PERMANENT.SHORTLISTED',
  aggregateId: `${crewId}:${postingId}`,
  aggregateType: 'permanent',
  roleContext: person.current_hat,
  payload: { crew_person_id: crewId, permanent_posting_id: postingId }
  ```
- [ ] `notifyOnEvent` with `PERMANENT.SHORTLISTED`
- [ ] Return `{ success: true }`

---

#### 3. POST `/api/permanent/[id]/reject/route.ts` — Reject a candidate

New file: `apps/web/src/app/api/permanent/[id]/applicants/[crewId]/reject/route.ts`

- [ ] Auth: employer/agent hat, ownership
- [ ] Top-level try/catch
- [ ] Fetch application, validate status is `'applied'` or `'shortlisted'`
- [ ] `appendEvent` with `PERMANENT.REJECTED`
- [ ] `notifyOnEvent` with `PERMANENT.REJECTED`
- [ ] Return `{ success: true }`

---

#### 4. POST `/api/permanent/[id]/select/route.ts` — Select candidate (enter negotiation)

New file: `apps/web/src/app/api/permanent/[id]/applicants/[crewId]/select/route.ts`

- [ ] Auth: employer/agent hat, ownership
- [ ] Top-level try/catch
- [ ] Fetch posting: validate status is `'active'` (cannot select if already `in_negotiation` or `filled`)
- [ ] Fetch application: validate status is `'shortlisted'` (only shortlisted can be selected)
- [ ] No overlap check needed (permanent has no date-based conflicts per spec)
- [ ] Generate engagement UUID
- [ ] `appendEvent`:
  ```typescript
  eventType: 'PERMANENT.SELECTED',
  aggregateId: `${crewId}:${postingId}`,
  aggregateType: 'permanent',
  roleContext: person.current_hat,
  payload: {
    crew_person_id: crewId,
    permanent_posting_id: postingId,
    engagement_id: engagementId,
  }
  ```
- [ ] Fetch newly created engagement:
  ```typescript
  const { data: engagement } = await serviceClient
    .from('active_engagements')
    .select('id')
    .eq('permanent_posting_id', postingId)
    .eq('crew_person_id', crewId)
    .single();
  ```
- [ ] `notifyOnEvent` with `PERMANENT.SELECTED` (includes `engagement_id` for deep link)
- [ ] Return `{ success: true, engagementId: engagement?.id ?? null }`

---

#### 5. Profile view context — add permanent relationship check

File: `apps/web/src/app/api/profile/[personId]/route.ts` (existing, additive)

The profile view route validates that the requester has a relationship (engagement, application, or invitation) with the target. Currently only checks daywork relationships.

- [ ] Find the application relationship check (uses `dayworks!inner(poster_person_id)`)
- [ ] Add an OR branch for permanent relationships:
  ```typescript
  // Check permanent application relationship
  const { data: permApp } = await supabase
    .from('applications')
    .select('id, permanent_postings!inner(employer_person_id)')
    .or(
      `and(crew_person_id.eq.${targetId},permanent_postings.employer_person_id.eq.${requesterId}),` +
        `and(crew_person_id.eq.${requesterId},permanent_postings.employer_person_id.eq.${targetId})`,
    )
    .not('status', 'eq', 'withdrawn')
    .limit(1);
  ```
- [ ] Also check permanent engagements:
  ```typescript
  // Check permanent engagement relationship
  const { data: permEng } = await supabase
    .from('active_engagements')
    .select('id')
    .not('permanent_posting_id', 'is', null)
    .or(
      `and(crew_person_id.eq.${requesterId},employer_person_id.eq.${targetId}),and(crew_person_id.eq.${targetId},employer_person_id.eq.${requesterId})`,
    )
    .limit(1);
  ```
- [ ] If any of the existing daywork checks OR the new permanent checks find a relationship, allow access
- [ ] Existing daywork checks untouched — permanent checks are additive

---

#### 6. PermanentReviewPage component

New file: `apps/web/src/app/(app)/permanent/[id]/review/page.tsx`

Scrollable list (NOT swipe stack). Two tabs: Applicants and Shortlisted.

- [ ] Client component with `useParams` to get posting ID
- [ ] Fetch applicants from `GET /api/permanent/:id/review` on mount
- [ ] Two tabs:
  - **Applicants** — shows applications with status `applied`
  - **Shortlisted** — shows applications with status `shortlisted` or `selected`
- [ ] Each applicant card shows:
  - Display name + avatar
  - Role + experience bracket
  - Certifications (listed)
  - Nationality flag
  - Permanent availability status:
    - "Available immediately" (green)
    - "Available — X day notice period" (amber)
    - "Currently employed" indicator
  - Application message preview
  - "Posted X days ago" (application age)
  - EpauletteBadge
  - Profile drill-down button (opens ProfileOverlay)
- [ ] Applicants tab actions: "Shortlist" and "Reject" buttons per card
  - Shortlist: `POST /api/permanent/:id/applicants/:crewId/shortlist` → move card to Shortlisted tab, update count
  - Reject: `POST /api/permanent/:id/applicants/:crewId/reject` → remove card, toast
  - Shortlist button disabled when cap reached (show "Shortlist full" tooltip)
- [ ] Shortlisted tab actions: "Select" and "Reject" buttons per card
  - Select: confirmation dialog "Select {name} for negotiation? This will open a message thread." → `POST /api/permanent/:id/applicants/:crewId/select` → redirect to `/messages/:engagementId`
  - Reject: same as above
  - Select button disabled when posting is already `in_negotiation`
- [ ] Negotiation banner (when `posting_status === 'in_negotiation'`):
  - "Currently in negotiation with {name}" at top of page
  - Selected candidate shown in Shortlisted tab with "In negotiation" badge
  - Select button disabled for all other candidates
- [ ] Shortlist cap indicator: "X of Y shortlisted" (uses `shortlist_count` and `shortlist_cap` from API)
- [ ] Empty states for both tabs
- [ ] Toast on all actions (success/error)

---

#### 7. Tests

New file: `apps/web/__tests__/api/permanent-review.test.ts`

- [ ] Test: returns 401 when unauthenticated
- [ ] Test: returns 403 when hat is `crew`
- [ ] Test: returns 403 when not posting owner
- [ ] Test: returns applicants with correct response shape
- [ ] Test: includes shortlist_cap, shortlist_count, posting_status in response

New file: `apps/web/__tests__/api/permanent-shortlist.test.ts`

- [ ] Test: returns 401 when unauthenticated
- [ ] Test: returns 400 when application status is not `applied`
- [ ] Test: returns 400 when shortlist is at cap
- [ ] Test: happy path — shortlists applicant, returns `{ success: true }`

New file: `apps/web/__tests__/api/permanent-select.test.ts`

- [ ] Test: returns 401 when unauthenticated
- [ ] Test: returns 400 when posting status is not `active`
- [ ] Test: returns 400 when application status is not `shortlisted`
- [ ] Test: happy path — selects candidate, returns `{ success: true, engagementId }`

New file: `apps/web/__tests__/api/permanent-reject.test.ts`

- [ ] Test: returns 401 when unauthenticated
- [ ] Test: returns 400 when application is in terminal state
- [ ] Test: happy path — rejects applicant, returns `{ success: true }`

---

#### 8. Verify

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest run` — all tests pass (762 existing + new)
- [ ] `npx eslint src/ --max-warnings 0` — zero warnings
- [ ] Manual: log in as employer, create permanent posting (Stage 128), switch to crew hat, apply (Stage 130), switch back to employer, navigate to review page. Verify:
  - Applicant appears in Applicants tab
  - Shortlist moves to Shortlisted tab, cap indicator updates
  - Select opens confirmation, creates engagement, redirects to chat
  - Negotiation banner appears, select button disabled for others

---

#### 9. Documentation

- [ ] Update `BUILD_STATE.md`: stage entry + test count
- [ ] Update `apps/web/README.md`: add permanent review/shortlist/select/reject routes

---

## Done

(See git history for completed stages 51-131, fixes 118a/123a/123b/127a/128a/128b, messages test cleanup)
