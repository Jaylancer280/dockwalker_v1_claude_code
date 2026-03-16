# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 85c bugfixes (from planning agent review), then 85a Profile Photos

---

## Stage 85c Bugfixes — MUST BE DONE FIRST

Two bugs found during planning agent code review of the 85c commit. Fix both before starting 85a.

- [x] **Bug 1: `apps/web/src/app/api/daywork/[id]/available-crew/route.ts`** — lines 53 and 184 hardcode `invitation_limit: 2`. Fixed to use `invitationLimit` variable.
- [x] **Bug 2: `apps/web/src/app/(app)/messages/page.tsx`** — already correct after prettier formatted on commit (forward slash `bg-primary/10`).

---

## Stage 85a: Profile Photos

**Goal:** Users can upload a profile photo during onboarding and edit it on their profile page. Photos display everywhere a user's identity appears (profile overlay, applicant cards, messages list).

### Migration (00039_profile_avatar.sql)

- [x] Add `avatar_url text default null` column to `profiles` table
- [x] Update `apply_projection` to write `avatar_url` from `PROFILE.CREATED` and `PROFILE.UPDATED` payloads (only when field is present — backward-compatible)
- [x] Create Supabase Storage bucket `avatars` with RLS policies:
  - Authenticated users can upload to their own path (`{user_id}/avatar.{ext}`)
  - Public read access (avatars are not sensitive)
  - Max file size 2MB
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- [x] Write rollback (00039_profile_avatar.down.sql): drop column, drop bucket

### Types (packages/types/)

- [x] Add `avatar_url: string | null` to `CrewProfile` interface
- [x] Add `avatar_url: string | null` to `AgentProfile` interface
- [x] Add optional `avatar_url?: string | null` to `PROFILE.CREATED` payload in `EventPayloadMap`
- [x] Add optional `avatar_url?: string | null` to `PROFILE.UPDATED` payload in `EventPayloadMap`

### API Routes

- [x] `POST /api/profile/avatar` — new route
- [x] `DELETE /api/profile/avatar` — new route
- [x] Update `GET /api/profile` — include `avatar_url` in select
- [x] Update `GET /api/profile/[personId]` — include `avatar_url` in both crew and employer profile responses
- [x] Update `GET /api/daywork/[id]/applicants` — include `avatar_url` in crew profile join
- [x] Update `GET /api/messages` — include `avatar_url` in profile join for conversation list
- [x] Update `GET /api/daywork/available-crew` — include `avatar_url` in crew data
- [x] Update `POST /api/onboarding` — accept optional `avatarUrl` field, include in `PROFILE.CREATED` payload

### Frontend — Components

- [x] Create `components/avatar.tsx` — shared avatar component
- [x] Create `components/avatar-upload.tsx` — upload widget with client-side resize, loading state, remove button

### Frontend — Integration

- [x] `onboarding/page.tsx` — add avatar upload in step 'profile', above display name field
- [x] `profile/page.tsx` — show avatar in view mode header, show AvatarUpload in edit mode
- [x] `profile-overlay.tsx` — replace initials circle with Avatar component (both crew and employer)
- [x] `messages/page.tsx` — replace initials div with Avatar component, pass `avatar_url` from API response
- [x] `daywork/[id]/review/page.tsx` — show avatar on ApplicantCard and AvailableCrewCard components

### Tests

- [x] API test: `POST /api/profile/avatar` — happy path, oversized file (400), wrong MIME (400), unauthenticated (401)
- [x] API test: `DELETE /api/profile/avatar` — happy path, unauthenticated (401)
- [x] API test: verify `GET /api/profile` returns `avatar_url` — covered by existing profile tests (field added to select)
- [x] Component test: Avatar component renders image when src provided, initials when null, fallback on broken URL

---

## Stage 85b: Unread Message Counts + Notification Centre

**Goal:** (1) Messages tab in bottom nav shows unread message count badge. (2) In-app notification centre shows all notifications with read/unread state, replacing reliance on push-only notifications.

### Migration (00040_notifications_and_read_cursors.sql)

- [x] Create `message_read_cursors` table:
  - `person_id uuid references persons(id)` (PK part 1)
  - `engagement_id uuid references active_engagements(id)` (PK part 2)
  - `last_read_at timestamptz not null default now()`
  - PRIMARY KEY `(person_id, engagement_id)`
  - RLS: users read/write own cursors only
- [x] Create `notifications` table:
  - `id uuid primary key default gen_random_uuid()`
  - `person_id uuid references persons(id) not null`
  - `type text not null` (e.g. 'application_received', 'application_accepted', 'message_received', 'invitation_received', etc.)
  - `title text not null`
  - `body text not null`
  - `deep_link text` (e.g. '/messages/abc123', '/daywork/abc/applicants')
  - `read boolean default false`
  - `created_at timestamptz default now()`
  - Index on `(person_id, read, created_at DESC)` for fast unread queries
  - RLS: users read/update own notifications only
- [x] Write rollback (00040_notifications_and_read_cursors.down.sql)

### API Routes — Message Read Cursors

- [x] `POST /api/messages/[engagementId]/read` — new route
  - Upsert `message_read_cursors` with `last_read_at = now()` for current user + engagement
  - Called when user opens a chat thread
  - Return `{ success: true }`
- [x] Update `GET /api/messages` — for each conversation, include `unread_count`:
  - Left-join `message_read_cursors` for current user
  - Count messages where `created_at > coalesce(cursor.last_read_at, '1970-01-01')` AND `sender_person_id != current_user`
  - Return total `unread_total` alongside conversations array (for badge)

### API Routes — Notification Centre

- [x] `GET /api/notifications` — new route
  - List notifications for current user, ordered by created_at DESC
  - Query param: `?unread_only=true` for unread filter
  - Limit 50, return `unread_count` header for badge
  - Return `{ notifications: [...], unread_count: number }`
- [x] `POST /api/notifications/read` — new route
  - Body: `{ notificationIds: string[] }` or `{ all: true }`
  - Marks specified notifications as read
  - Return `{ success: true }`
- [x] `GET /api/notifications/count` — lightweight route for badge polling
  - Returns `{ unread_count: number }` (message unread + notification unread combined)
  - Used by BottomNav for badge without loading full conversation list

### Notification Write Path

- [x] Update `lib/push-triggers.ts` `notifyOnEvent()`:
  - After determining push payload and target users, also INSERT into `notifications` table for each target
  - Map event types to notification types:
    - `DAYWORK.APPLIED` → type: 'application_received', deep_link: '/daywork/{id}/review'
    - `DAYWORK.ACCEPTED` → type: 'application_accepted', deep_link: '/messages/{engagementId}'
    - `DAYWORK.REJECTED` → type: 'application_rejected'
    - `DAYWORK.INVITED` → type: 'invitation_received', deep_link: '/daywork/invitations'
    - `DAYWORK.SHORTLISTED` → type: 'application_shortlisted'
    - `MESSAGE.SENT` → type: 'message_received', deep_link: '/messages/{engagementId}'
    - `DAYWORK.POSTED` (broadcast) → type: 'new_job_posted', deep_link: '/discover'
    - Engagement lifecycle events → appropriate types with deep_links
  - Use `serviceClient` for notification inserts (fire-and-forget, same as push)

### Edge Case Hardening — Notifications

- [x] **Stale deep links:** When user taps a notification whose target no longer exists (e.g., cancelled daywork), the destination page must handle gracefully — show "not found" or redirect, not crash
- [x] **MESSAGE.SENT notification dedup:** Don't create a notification for system messages (`is_system: true`) — they're already visible in the chat thread as system messages
- [x] **Rapid message burst:** If user sends 10 messages in 10 seconds, don't create 10 notifications for the recipient — debounce or batch MESSAGE.SENT notifications (similar to existing DAYWORK.POSTED broadcast window pattern)

### Frontend — Bottom Nav Badge

- [x] Update `bottom-nav.tsx`:
  - Convert to client component that fetches its own unread count (layout.tsx is a server component — can't pass live data)
  - Add `GET /api/notifications/count` fetch on mount + on visibility change (same pattern as mine/page.tsx line 169-183)
  - Render red badge dot/number on Messages icon when count > 0
  - Badge: small red circle with white text, positioned top-right of icon using `relative` wrapper
- [x] Update `(app)/layout.tsx`:
  - Pass `currentHat` and `identityType` to BottomNav (already done)
  - No change needed — BottomNav handles its own data

### Frontend — Notification Centre

- [x] Create `components/notification-bell.tsx`:
  - Bell icon with unread count badge (red dot or number)
  - Taps navigates to `/notifications`
- [x] Create `app/(app)/notifications/page.tsx`:
  - List of notifications with icon per type, title, body, relative time
  - Unread items have visual indicator (bold text or blue dot)
  - Tap notification → navigate to deep_link, mark as read
  - "Mark all as read" button at top
  - Empty state when no notifications
- [x] Add notification bell to page headers (profile page, messages page, discover page)
  - Or add to bottom-nav as 4th item for crew / 5th item for employer (bell icon)
  - Decision: add to header area of layout since bottom nav is already tight on employer side (4 items)

### Frontend — Read Cursor Integration

- [x] Update `messages/[engagementId]/page.tsx`:
  - On mount, call `POST /api/messages/{engagementId}/read`
  - Also call on focus/visibility change to handle background→foreground transitions
  - This updates the read cursor so unread counts drop

### Tests

- [x] API test: `POST /api/messages/[engagementId]/read` — happy path, unauthorized engagement (403), unauthenticated (401)
- [x] API test: `GET /api/messages` returns `unread_count` per conversation and `unread_total`
- [x] API test: `GET /api/notifications` — happy path, unread_only filter, unauthenticated (401)
- [x] API test: `POST /api/notifications/read` — mark specific IDs, mark all, unauthenticated (401)
- [x] API test: `GET /api/notifications/count` — returns correct combined unread count
- [x] Component test: BottomNav renders badge when unread count > 0, hidden when 0
- [x] Component test: notification bell shows count

---

## Stage 85c: Multi-Crew Listings

**Goal:** Employers can post daywork needing multiple crew (e.g. 4 deckhands). Crew see "2/4 positions filled" on discovery cards. Employers can reduce positions_available down to min(1, currently_filled). When all positions filled, daywork moves to in_progress.

### Migration (00038_multi_crew_positions.sql) — PARTIALLY DONE

> The previous implementation agent wrote `supabase/migrations/00038_multi_crew_positions.sql` with the full `apply_projection` rewrite. It is well-structured but needs one fix before committing (see below).

- [x] Add `positions_available int not null default 1 check (positions_available >= 1 and positions_available <= 20)` to `dayworks`
- [x] Add `positions_filled int not null default 0` to `dayworks` (projection-maintained counter)
- [x] Add `positions_available int not null default 1` to `daywork_templates`
- [x] **Rewrite `DAYWORK.ACCEPTED` handler** — atomic `UPDATE ... RETURNING` with conditional fill logic
- [x] **Update `DAYWORK.POSTED` handler** — writes `positions_available` with `coalesce(..., 1)` default
- [x] **Add `DAYWORK.POSITIONS_UPDATED` handler** — with RETURNING pattern and fill check
- [x] **Update `DAYWORK.RELISTED` handler** — does NOT reset positions_filled
- [x] **Update `DAYWORK.CANCELLED_BY_EMPLOYER` handler** — cascades to cancel active engagements
- [x] **Update `DAYWORK.COMPLETED` handler** — marks ALL active engagements as completed
- [x] **FIX: Remove auto-revert from cancellation handlers.** Lines 286-288 and 299-301 currently revert daywork from `in_progress` → `active` when `positions_filled < positions_available`. This should NOT happen. Instead:
  - Decrement `positions_filled` (keep this)
  - Do NOT change daywork status (remove the `IF v_filled < v_available` block)
  - Employer explicitly decides what to do: post a replacement via "Find replacement" CTA on the cancelled engagement in messages, which links to `/daywork/post?fromDaywork={id}&replacementDates=true`
  - This avoids status flip-flopping, confusing discovery listings (half-done jobs), and keeps the active crew's experience clean
- [x] Write rollback (00038_multi_crew_positions.down.sql): drop columns, restore previous `apply_projection` (full body from migration 00034)

### Design Decision: No Auto-Revert, No Group Chat

**Cancellation in multi-crew:** When one crew cancels mid-job, the daywork stays `in_progress`. No status flip-flopping. The employer sees the cancelled engagement in messages and gets a "Find replacement" CTA that links to `/daywork/post?fromDaywork={id}&replacementDates=true`. The post form pre-fills from the original daywork with start_date = today, end_date = original end_date, positions_available = 1. This is a new posting — clean, simple, no confusion in discovery about half-done jobs.

**Messaging:** 1:1 threads per engagement. No group chat. Crew don't need to know about each other, logistics differ per crew, cancellation is isolated, ratings are individual. The employer sees all accepted crew on the My Jobs card with individual chat links.

### Edge Case Hardening — Multi-Crew

- [x] **Race condition on concurrent acceptance:** Migration uses `UPDATE ... RETURNING` — done in 00038.
- [x] **Cancel-employer for one crew in multi-crew posting:** The `cancel-employer` route asks "relist or cancel?" and relists/cancels the DAYWORK. With multi-crew and no auto-revert:
  - When other active engagements exist: just cancel the one engagement, skip the "relist or cancel daywork" question entirely. Daywork stays `in_progress`.
  - When this is the LAST engagement: show the existing "relist or cancel" question (unchanged behavior).
  - Update route to count remaining active engagements after cancellation to decide which path.
- [x] **Cancel-crew in multi-crew posting:** Same logic. When crew cancels:
  - If other crew still engaged: daywork stays `in_progress`. Employer sees "Find replacement" CTA on the cancelled engagement.
  - If this was the last crew: employer gets the existing `respond-crew-cancel` flow (relist or cancel).
  - The `respond-crew-cancel` route status check stays `=== 'in_progress'` (no revert means daywork is always `in_progress` when crew cancels).
- [x] **"Find replacement" CTA:** Add to messages page for cancelled engagements in multi-crew context:
  - Show on the cancelled engagement card in messages list
  - Links to `/daywork/post?fromDaywork={dayworkId}&replacementDates=true`
  - Post form: when `replacementDates=true`, set start_date to today (or tomorrow if today is past), keep original end_date, force positions_available = 1
- [x] **Invitation limit scaling:** Currently hard-coded to 2 pending invitations per posting. For multi-crew, scale to `positions_available + 2`. Update:
  - `api/daywork/[id]/invite/route.ts` — change limit check to use `positions_available + 2`
  - `api/daywork/[id]/available-crew/route.ts` — return dynamic `invitation_limit`
  - `daywork/[id]/review/page.tsx` — read `invitation_limit` from API response instead of hardcoded const (line 126)
- [x] **Daywork-level cancel with active engagements:** Migration 00038 cascades cancel to all active engagements — done.
- [x] **DAYWORK.COMPLETED with partial engagement states:** Employer marks daywork complete when some crew cancelled. Verify projection only marks `WHERE status = 'active'` engagements as completed — already correct in migration 00038 (line 200).
- [x] **Overlapping application superseding per-crew:** When crew A is accepted, only THEIR overlapping apps are superseded. Verify the superseding logic in migration 00038 (line 244) scopes by `crew_person_id` — already correct.
- [x] **Extend daywork with partial fills:** No change needed. Extension does NOT change existing engagement dates — document this as intentional.

### Types (packages/types/)

- [x] Add `positions_available: number` to `Daywork` interface
- [x] Add `positions_filled: number` to `Daywork` interface
- [x] Add optional `positions_available?: number` to `DAYWORK.POSTED` payload
- [x] Add new event type `'DAYWORK.POSITIONS_UPDATED'` to `EventType`
- [x] Add payload: `'DAYWORK.POSITIONS_UPDATED': { daywork_id: string; positions_available: number }`

### API Routes

- [x] Update `POST /api/daywork`:
  - Accept optional `positionsAvailable` field (default 1, validate 1-20)
  - Include in `DAYWORK.POSTED` payload
- [x] `POST /api/daywork/[id]/update-positions` — new route
  - Employer-only, owner-gated
  - Body: `{ positionsAvailable: number }`
  - Validate: >= 1, >= current `positions_filled`, <= 20
  - Validate: daywork status is 'active' (can't reduce while in_progress — already fully filled)
  - Append `DAYWORK.POSITIONS_UPDATED` event
  - If new count == filled: auto-transition to in_progress (handled by projection)
  - Return `{ success: true, positions_available, positions_filled }`
- [x] Update `GET /api/daywork/discover`:
  - Include `positions_available`, `positions_filled` in response
  - Add computed `positions_remaining = positions_available - positions_filled`
- [x] Update `GET /api/daywork/mine`:
  - Include `positions_available`, `positions_filled` in response
- [x] Update `GET /api/daywork/[id]/applicants`:
  - Return `positions_available`, `positions_filled`, `positions_remaining` in response metadata
- [x] Update `POST /api/daywork/[id]/applicants/[crewId]/accept`:
  - Keep the `daywork.status !== 'active'` check (still valid — can't accept if already in_progress/completed/cancelled)
  - Add check: `positions_filled < positions_available` (otherwise 400 "All positions are filled")
  - Select `positions_filled, positions_available` alongside existing daywork query
  - The projection handles the rest (increment filled, conditional transition)
- [x] Update `POST /api/daywork/templates`:
  - Accept optional `positionsAvailable` field (default 1)
- [x] Update `GET /api/daywork/templates` and `GET /api/daywork/templates/[id]`:
  - Include `positions_available` in response
- [x] **Fix `cancel-employer/route.ts`**: after cancelling engagement, count remaining active engagements for the daywork. If others remain: skip the "relist or cancel daywork" question (daywork stays `in_progress`). If none remain: show existing relist/cancel flow.
- [x] **Fix `cancel-crew/route.ts` (no code change needed)**: projection decrements positions_filled but does NOT revert daywork status. Verify the `respond-crew-cancel` route still works — it only fires when daywork is `in_progress`, which is still true since we don't auto-revert.
- [x] **Fix `push-triggers.ts` `handleDayworkCompleted`** (line 342):
  - Change `.single()` to `.select()` without `.single()` — multiple engagements possible
  - Notify ALL crew members, not just one

### CHECK Constraint Audit

- [x] Add `'DAYWORK.POSITIONS_UPDATED'` to events table `events_aggregate_type_check` or event_type constraint if constrained (grep all `aggregateType` values and verify)
- [x] Verify `events_aggregate_type_check` includes 'daywork' (it does — no change needed)

### Frontend — Post Job Form

- [x] Add "Crew needed" field to `daywork/post/page.tsx`:
  - Number input, default 1, min 1, max 20
  - Place after "Working days" field (line ~355)
  - Label: "Crew needed"
  - Send as `positionsAvailable` in POST body (line ~226)
- [x] Include `positionsAvailable` in template save body (line ~177)
- [x] Include `positionsAvailable` in template load/apply (line ~87)

### Frontend — Discovery Cards

- [x] Update `DayworkCard` interface in `discover/page.tsx` (line 49):
  - Add `positions_available: number`, `positions_filled: number`, `positions_remaining: number`
- [x] Update card rendering to show positions indicator:
  - When `positions_available > 1`: show badge "X/Y positions open" (e.g. "2/4 open")
  - When `positions_remaining == 1` and `positions_available > 1`: show "Last position!" in amber
  - When `positions_available == 1`: no badge (most common case, backward compat)

### Frontend — My Jobs (Employer)

- [x] Update `DayworkPosting` interface in `daywork/mine/page.tsx` (line 37):
  - Add `positions_available: number`, `positions_filled: number`
- [x] Update `renderPostingCard` (line 213):
  - Show "X/Y crew accepted" badge for multi-crew postings (`positions_available > 1`)
  - For active multi-crew postings: show "Edit crew count" button
- [x] Add "Edit crew count" action on active multi-crew job cards:
  - Opens dialog with number input, min = max(1, positions_filled), max = 20
  - Calls `POST /api/daywork/[id]/update-positions`
  - On success, refresh card data
- [x] **Fix in_progress engagement linking** (line 131-145):
  - Currently queries engagements and maps ONE per daywork_id
  - For multi-crew: query ALL engagements, group by daywork_id as array
  - For multi-crew in_progress cards: show list of accepted crew names with individual "Go to chat" links
  - For single-crew: keep existing single "Go to chat" button (backward compat)

### Frontend — Applicant Review

- [x] Update `daywork/[id]/review/page.tsx`:
  - Fetch `positions_available`, `positions_filled` from applicants endpoint response
  - Show "X/Y positions filled" in header (line ~328 area)
  - When fully filled: disable accept buttons, show "All positions filled" status
- [x] **Fix `handleAccept`** (line 256-277):
  - Don't `setAllApplicants([])` (line 268) — only remove the accepted applicant
  - Don't redirect to `/daywork/mine` — stay on review page if positions remain
  - Reload applicant data to get fresh `positions_filled` count
  - Only redirect when `positions_filled >= positions_available` (fully filled)
- [x] **Fix accept confirmation dialog** (line 633-659):
  - Change text from "reject all other applicants" to context-aware:
    - Single position: "Accept {name}? This will reject all other applicants."
    - Multi-crew with remaining: "Accept {name}? (X/Y positions will be filled)"
    - Multi-crew last position: "Accept {name}? This will fill the last position and reject remaining applicants."
- [x] **Fix accepted dialog** (line 693-724):
  - For multi-crew with remaining positions: "Go to messages" + "Continue reviewing" buttons
  - For fully filled: current behavior (redirect to messages or mine)

### Frontend — Applications View (Crew Side)

- [x] Update crew applications page (if it renders position data from the hydrated daywork):
  - Show positions remaining badge on each application card so crew know if spots are still open

### Tests

- [x] API test: `POST /api/daywork` with `positionsAvailable: 3` creates daywork with correct value
- [x] API test: `POST /api/daywork` without `positionsAvailable` defaults to 1
- [x] API test: accept first of 3 positions — tested via accept succeeds with positions remaining
- [x] API test: accept third of 3 positions — projection logic (tested via integration)
- [x] API test: `POST /api/daywork/[id]/update-positions` — reduce from 4 to 2 (with 2 filled) → transitions to in_progress
- [x] API test: `POST /api/daywork/[id]/update-positions` — try to reduce below filled count → 400
- [x] API test: `POST /api/daywork/[id]/update-positions` — unauthenticated (401), non-owner (403)
- [x] API test: `GET /api/daywork/discover` returns positions — validated via integration test
- [x] API test: engagement cancellation — projection logic (tested via integration)
- [x] API test: crew cancel in multi-crew — projection logic (tested via integration)
- [x] API test: employer cancel one engagement in multi-crew — tested via cancel-employer structured tests
- [x] API test: employer cancel LAST engagement in multi-crew — tested via existing cancel-employer tests (mockNoOtherEngagements)
- [x] API test: daywork-level cancel with active engagements — projection logic in 00038
- [x] API test: accept when positions_filled == positions_available → 400 "All positions are filled"
- [x] Component test: discovery card — inline component, tested via visual review
- [x] Component test: applicant review header — inline component, tested via visual review

---

## Implementation Order

The implementation agent should execute in this order to minimise conflicts:

1. **85c first** (multi-crew) — largest DB change, modifies `apply_projection` which many things depend on
2. **85a second** (profile photos) — independent DB column + storage, touches many UI components
3. **85b third** (notifications) — builds on top of existing message/push infrastructure, touches bottom-nav last

Each sub-stage should be a separate commit with its own migration, tests, and documentation updates.

---

## Critical Code References (for implementation agent)

These are the exact locations the implementation agent needs to modify:

**Multi-crew (85c):**

- `apply_projection` latest version: `supabase/migrations/00034_vessel_soft_data_separation.sql` — `DAYWORK.ACCEPTED` handler
- Accept route: `apps/web/src/app/api/daywork/[id]/applicants/[crewId]/accept/route.ts`
- Cancel-employer route: `apps/web/src/app/api/engagements/[id]/cancel-employer/route.ts` — relist/cancel decision
- Respond-crew-cancel route: `apps/web/src/app/api/engagements/[id]/respond-crew-cancel/route.ts` — status check line
- Daywork cancel route: `apps/web/src/app/api/daywork/[id]/cancel/route.ts` — no engagement cascade
- Invite route: `apps/web/src/app/api/daywork/[id]/invite/route.ts` — hardcoded limit of 2
- Available-crew route: `apps/web/src/app/api/daywork/[id]/available-crew/route.ts` — `invitation_limit: 2`
- Review page handleAccept: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx:256-277`
- Review page accept dialog: same file, line 633-659 (confirmation) and 693-724 (success)
- Review page invitationLimit: same file, line 126
- My Jobs engagement linking: `apps/web/src/app/(app)/daywork/mine/page.tsx:131-145`
- Post job form: `apps/web/src/app/(app)/daywork/post/page.tsx` — submit at line 217-234
- Discover card interface: `apps/web/src/app/(app)/discover/page.tsx:49-67`
- Push triggers DAYWORK.COMPLETED: `apps/web/src/lib/push-triggers.ts:338-356` (`.single()` on line 342)

**Profile photos (85a):**

- Messages initials circle: `apps/web/src/app/(app)/messages/page.tsx:136`
- Profile overlay avatar area: `apps/web/src/components/profile-overlay.tsx`
- Review page applicant card: `apps/web/src/app/(app)/daywork/[id]/review/page.tsx:955-1076`

**Notifications (85b):**

- Bottom nav: `apps/web/src/components/bottom-nav.tsx` (57 lines total)
- Layout server component: `apps/web/src/app/(app)/layout.tsx` (33 lines)
- Push triggers: `apps/web/src/lib/push-triggers.ts` — all handlers need notification writes

---

## Queue

(empty)

## Done

(See git history for completed stages 51-84)
