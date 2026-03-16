# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 86: Cursor-Based Discovery Pagination, then Stage 87: Permanent Opportunity Signal

---

## Stage 86: Cursor-Based Discovery Pagination

**Goal:** Remove the 50-result hard cap on discovery. As crew swipe through the card stack, automatically fetch the next batch when the stack runs low. No "page 2" button — infinite scroll via the existing swipe mechanic.

### Why cursor-based, not offset-based

The discover page is a swipe-through card stack. Cards are removed from the local array as crew swipe (apply or pass). Offset pagination (`OFFSET 50`) would skip or duplicate results as the underlying data changes (new postings, status changes). Cursor pagination (`created_at < ?`) is stable against concurrent changes.

### API Change — `GET /api/daywork/discover`

**File:** `apps/web/src/app/api/daywork/discover/route.ts`

- [x] Add optional `cursor` query param — ISO timestamp string. When provided, only return dayworks with `created_at < cursor`
- [x] Add the filter: `if (cursor) { query = query.lt('created_at', cursor); }`
- [x] Add `has_more: boolean` to the response
- [x] Return `next_cursor: string | null`
- [x] Response shape changes from `{ dayworks }` to `{ dayworks, has_more, next_cursor }`
- [x] Keep limit at 50

### Frontend Change — `discover/page.tsx`

**File:** `apps/web/src/app/(app)/discover/page.tsx`

- [x] Add state: `nextCursor`, `hasMore`, `loadingMore`
- [x] Update `loadCards` — sets cursor from response on initial load
- [x] Add `loadMore` — appends cards, updates cursor, retries on empty post-filter batches (max 3)
- [x] Add auto-load trigger: `cards.length <= 5 && hasMore && !loadingMore`
- [x] Show loading indicator when `loadingMore`
- [x] Empty state when `!hasMore && cards.length === 0` (existing, no change needed)
- [x] Filter change resets cursor (loadCards recreated via buildFilterParams dependency)

### Edge Cases

- [x] **Concurrent new postings:** Correct by design — cursor pagination stable against concurrent changes
- [x] **Swiped-away jobs reappearing:** `excludedIds` prevents reappearance — no change needed
- [x] **Empty batch before true end:** `loadMore` retries up to 3 times when post-filter yields empty batch

### Tests

- [x] API test: first batch returns `has_more` + `next_cursor`
- [x] API test: cursor param applies `lt('created_at', cursor)` filter
- [x] API test: `next_cursor` null when fewer than 50 results
- [x] Existing discover tests: all 15 still pass with new response shape

### What NOT to change

- **Applicant lists** (`GET /api/daywork/[id]/applicants`): Applicant counts per posting are naturally bounded (dozens, not hundreds). No pagination needed.
- **My Jobs** (`GET /api/daywork/mine`): Employer's own postings are bounded. No pagination needed.
- **Messages list** (`GET /api/messages`): Engagements per user are bounded. No pagination needed.
- **Swipe mechanic**: No changes to the motion/gesture code. Cards still render as a stack with top + preview.

---

## Stage 87: Permanent Opportunity Signal

**Goal:** Employers can indicate a daywork posting could lead to a permanent role. This is a passive, honest signal — not a sorting factor, not a filter, not a ranking mechanism. Crew see it on the card. The rating system holds employers accountable via internal-only accuracy tracking.

### What This IS

- A boolean toggle on the posting: "This role could lead to a permanent position"
- A visible badge on discovery cards and detail views
- A single crew rating question: "Did the daywork engagement lead to a permanent opportunity?" (only shown when the flag was on)
- Internal intelligence data for admin — patterns of inaccurate signals can be surfaced by admin tooling later

### What This Is NOT — Architectural Guardrails

> These rules are non-negotiable. They protect the core product philosophy.

- **NOT a filter.** Crew cannot filter discovery by "permanent opportunity only." This would bifurcate the job pool and pressure employers to enable the flag for visibility.
- **NOT a sort factor.** Postings with the flag do not appear higher or earlier in discovery. Sort remains recency-only.
- **NOT a ranking signal.** The flag does not affect any algorithmic ordering, weighting, or recommendation logic.
- **NOT a crew-facing metric.** Crew never see "this employer's permanent accuracy is X%." That would be a reputation score — explicitly prohibited by the mission doc.
- **NOT a guarantee or contract.** The UI must communicate this clearly: "The employer has indicated this could lead to a permanent role. DockWalker makes no promises — this is the employer's signal only."
- **NOT gamifiable.** Employers who toggle it on every posting with no follow-through gain zero advantage — no better placement, no more applicants via algorithmic boost. The only consequence is internal accuracy tracking visible to admin.
- **NOT visible to employers on crew profiles.** Crew don't get tagged as "seeking permanent" or "not interested in permanent." This would create a two-tier crew system.

If any future feature proposal would violate these guardrails, it is out of scope and must be rejected.

### Migration (00041_permanent_opportunity.sql)

- [ ] Add `permanent_opportunity boolean not null default false` to `dayworks`
- [ ] Add `permanent_opportunity boolean not null default false` to `daywork_templates`
- [ ] Add `permanent_opportunity_accuracy text check (permanent_opportunity_accuracy in ('yes', 'no', 'not_applicable'))` to `engagement_ratings` (nullable — only populated when daywork had the flag)
- [ ] Update `apply_projection` DAYWORK.POSTED handler to write `permanent_opportunity` from payload: `coalesce((p_payload->>'permanent_opportunity')::boolean, false)`
- [ ] Update `apply_projection` ENGAGEMENT.RATED_BY_CREW handler to write `permanent_opportunity_accuracy` from payload (nullable)
- [ ] Write rollback (00041_permanent_opportunity.down.sql): drop columns, restore previous apply_projection from 00039

### Types (packages/types/)

- [ ] Add `permanent_opportunity: boolean` to `Daywork` interface in `models.ts`
- [ ] Add optional `permanent_opportunity?: boolean` to `DAYWORK.POSTED` payload in `EventPayloadMap`
- [ ] Add optional `permanent_opportunity_accuracy?: string` to `ENGAGEMENT.RATED_BY_CREW` payload in `EventPayloadMap`

### API Routes

- [ ] Update `POST /api/daywork`:
  - Accept optional `permanentOpportunity` boolean field (default false)
  - Include `permanent_opportunity` in `DAYWORK.POSTED` payload
- [ ] Update `GET /api/daywork/discover`:
  - Include `permanent_opportunity` in response — **do NOT add it as a filter param**
- [ ] Update `GET /api/daywork/mine`:
  - Include `permanent_opportunity` in response
- [ ] Update `GET /api/daywork/[id]/applicants`:
  - Include `permanent_opportunity` in daywork metadata (so employer sees what they posted)
- [ ] Update `GET /api/daywork/applications`:
  - Include `permanent_opportunity` in hydrated daywork (so crew sees the signal on their pending apps)
- [ ] Update `POST /api/daywork/templates`:
  - Accept optional `permanentOpportunity` field
- [ ] Update `GET /api/daywork/templates` and `GET /api/daywork/templates/[id]`:
  - Include `permanent_opportunity` in response
- [ ] Update `POST /api/engagements/[id]/rate`:
  - For crew completed-context rating: accept optional `permanent_opportunity_accuracy` field
  - Validate: if daywork had `permanent_opportunity === true`, value must be 'yes' | 'no' | 'not_applicable'
  - If daywork had `permanent_opportunity === false`, field should not be present (ignore if sent)
  - To check: query daywork via engagement to read `permanent_opportunity` flag
  - Include in `ENGAGEMENT.RATED_BY_CREW` payload when present
- [ ] Update `GET /api/messages/[engagementId]/context`:
  - Include `permanent_opportunity` in daywork metadata (so chat page can display it and rating form knows whether to show the question)

### Frontend — Post Job Form

- [ ] Add toggle to `daywork/post/page.tsx`:
  - Place after "Notes" field (last optional field, before submit)
  - Label: "Could lead to permanent role"
  - Helper text: "Signal to crew that this daywork could lead to a permanent position. No guarantees."
  - Switch/checkbox component, default off
  - Send as `permanentOpportunity` in POST body
- [ ] Include in template save/load/apply

### Frontend — Discovery Cards

- [ ] Update discover card rendering:
  - When `permanent_opportunity === true`: show small badge "Could go permanent" in a neutral color (not green/amber — no urgency signaling)
  - Place below existing badges (experience bracket, positions)
  - No special visual weight — same prominence as meals or certs

### Frontend — My Jobs + Applicant Review

- [ ] Show "Could go permanent" badge on posting cards in mine page when flag is true
- [ ] Show in applicant review header alongside positions info

### Frontend — Applications View (Crew)

- [ ] Show "Could go permanent" badge on pending application cards when flag is true

### Frontend — Rating Form

- [ ] Update `rating-form-overlay.tsx`:
  - For crew completed-context rating: if daywork had `permanent_opportunity === true`, show additional question after `would_work_on_vessel_again`:
    - "Did the daywork engagement lead to a permanent opportunity?"
    - Options: "Yes" / "No" / "Not applicable" (employer may not have discussed it)
  - If daywork did NOT have the flag: don't show the question
  - The rating form needs to know whether the daywork had the flag — pass via engagement context
- [ ] Update `rating-summary.tsx`:
  - Show the permanent opportunity accuracy answer in read-only summary when present

### Tests

- [ ] API test: `POST /api/daywork` with `permanentOpportunity: true` creates daywork with correct value
- [ ] API test: `POST /api/daywork` without `permanentOpportunity` defaults to false
- [ ] API test: `GET /api/daywork/discover` returns `permanent_opportunity` field
- [ ] API test: `POST /api/engagements/[id]/rate` (crew, completed) with `permanent_opportunity_accuracy: 'yes'` succeeds when daywork had flag
- [ ] API test: verify `permanent_opportunity` is NOT available as a discover filter param (ensuring no one adds `?permanentOpportunity=true`)
- [ ] Existing rating tests: ensure they still pass with the new optional field

---

## Queue

(empty)

## Done

(See git history for completed stages 51-85)
