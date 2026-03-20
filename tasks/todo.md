# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 124: Engagement Starts Tomorrow — Cron Reminder

**Goal:** Notify both crew and employer 24 hours before an engagement's start date via in-app notification, push, and email. Modelled after the availability expiry cron (Stage 102).

**Will touch:** New cron route, vercel.json, new email template, push-triggers (email helper reuse).

**Will NOT touch:** Database schema, migrations, existing event types, engagement lifecycle, chat page.

**Done condition:** Both parties receive in-app + push + email notification the morning before an engagement starts. Duplicate prevention ensures one notification per engagement per person per day. Cron authenticated via CRON_SECRET.

---

#### 1. Create cron route

File: `apps/web/src/app/api/cron/engagement-starts/route.ts`

Follow the exact pattern from `apps/web/src/app/api/cron/availability-expiry/route.ts`.

- [x] Auth: validate `Authorization: Bearer ${CRON_SECRET}`, return 401 if missing/invalid
- [x] Use `createServiceClient()` (service role bypasses RLS)
- [x] Query `active_engagements` where:

  ```typescript
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: engagements } = await serviceClient
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, start_date, daywork_id')
    .eq('status', 'active')
    .eq('start_date', tomorrow);
  ```

  This finds all active engagements starting tomorrow (not today, not in 2 days — exactly tomorrow's date).

- [x] For each engagement, notify BOTH `crew_person_id` and `employer_person_id`:
  - **Duplicate prevention:** Before inserting, check `notifications` table for existing `type: 'engagement_starting'` with matching `deep_link` containing the engagement ID, created in last 24h. Skip if found.
    ```typescript
    const { data: existing } = await serviceClient
      .from('notifications')
      .select('id')
      .eq('person_id', personId)
      .eq('type', 'engagement_starting')
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .like('deep_link', `%${engagement.id}%`)
      .limit(1);
    if (existing && existing.length > 0) continue;
    ```
  - **In-app notification:**
    ```typescript
    await serviceClient.from('notifications').insert({
      person_id: personId,
      type: 'engagement_starting',
      title: 'Engagement starts tomorrow',
      body: `Your engagement starts tomorrow — check the pre-arrival checklist.`,
      deep_link: `/messages/${engagement.id}`,
      role_context: roleContext, // 'crew' for crew_person_id, 'employer' for employer_person_id
    });
    ```
  - **Push notification** (fire-and-forget):
    ```typescript
    sendPushToUser(serviceClient, personId, {
      title: 'Engagement Starts Tomorrow',
      body: 'Your engagement starts tomorrow — check the pre-arrival checklist.',
      data: { screen: 'chat', engagementId: engagement.id },
    }).catch(() => {});
    ```
  - **Email notification** (fire-and-forget): see section 2

- [x] Return `{ notified: count }` on success
- [x] Wrap in try/catch, return 500 on error

---

#### 2. Email template + send

File: `apps/web/src/lib/email/templates/engagement-starting.ts` (new file)

- [x] Create template function:

  ```typescript
  export function engagementStartingEmail(params: {
    recipientName: string;
    otherPartyName: string;
    roleName: string;
    startDate: string;
    engagementId: string;
  }): { subject: string; html: string };
  ```

  Subject: `Your engagement starts tomorrow`
  Body: Brief branded email with engagement details (role, date, counterparty name) and a CTA link to the chat thread. Follow the existing template style from `apps/web/src/lib/email/templates/` (check `application-accepted.ts` for the HTML structure).

- [x] In the cron route, after creating the notification and push, send the email:

  ```typescript
  const email = await getRecipientEmail(serviceClient, personId);
  if (email) {
    const { subject, html } = engagementStartingEmail({
      recipientName: ...,
      otherPartyName: ...,
      roleName: ...,
      startDate: engagement.start_date,
      engagementId: engagement.id,
    });
    sendEmail({ to: email, subject, html }).catch(() => {});
  }
  ```

- [x] To resolve names: fetch profiles for both person IDs in a single query before the notification loop:

  ```typescript
  const personIds = engagements.flatMap((e) => [e.crew_person_id, e.employer_person_id]);
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('person_id, display_name')
    .in('person_id', [...new Set(personIds)]);
  const nameMap = new Map(profiles?.map((p) => [p.person_id, p.display_name]) ?? []);
  ```

- [x] To resolve role name: fetch daywork role in a single query:

  ```typescript
  const dayworkIds = [...new Set(engagements.map((e) => e.daywork_id))];
  const { data: dayworks } = await serviceClient
    .from('dayworks')
    .select('id, yacht_roles(name)')
    .in('id', dayworkIds);
  const roleMap = new Map(dayworks?.map((d) => [d.id, d.yacht_roles?.name]) ?? []);
  ```

- [x] Import `sendEmail` from `@/lib/email/send` and `getRecipientEmail` from `@/lib/push-triggers` (or inline the auth.admin.getUserById pattern if getRecipientEmail is not exported)

---

#### 3. Register cron in vercel.json

File: `vercel.json`

- [x] Add to the `crons` array:
  ```json
  {
    "path": "/api/cron/engagement-starts",
    "schedule": "0 7 * * *"
  }
  ```
  Runs at 07:00 UTC daily — one hour before the availability expiry cron (08:00 UTC). This gives engagement reminders slightly higher priority in the morning notification stack.

---

#### 4. Export getRecipientEmail if needed

File: `apps/web/src/lib/push-triggers.ts`

- [x] Check if `getRecipientEmail` is exported. If not, either:
  - **Option A:** Export it (preferred — it's a utility function)
  - **Option B:** Duplicate the 3-line function in the cron route
- [x] If exporting, verify no circular import issues

---

#### 5. Tests

File: `apps/web/__tests__/api/cron-engagement-starts.test.ts`

- [x] Test: returns 401 without valid CRON_SECRET
- [x] Test: returns `{ notified: 0 }` when no engagements start tomorrow
- [x] Test: happy path — engagement starting tomorrow → notifications inserted for both crew and employer, returns `{ notified: 2 }`
- [x] Test: duplicate prevention — existing notification in last 24h → skipped, returns `{ notified: 0 }`
- [x] Test: only active engagements (cancelled/completed excluded)
- [x] Test: does not notify for engagements starting today or in 2+ days

Mock pattern: mock `createServiceClient` returning a mock Supabase client. Mock `sendPushToUser` and `sendEmail` as fire-and-forget (verify they're called but don't test delivery). Follow the existing cron test pattern if one exists, otherwise follow the standard API test pattern.

---

#### 6. Documentation

- [x] Update `BUILD_STATE.md`: stage entry `[Stage 124] Engagement starts tomorrow reminder — daily cron (07:00 UTC), in-app + push + email notification for both parties, duplicate prevention, engagement-starting email template`
- [x] Update `apps/web/README.md`: add cron endpoint to the API routes list
- [x] Update launch readiness `tasks/launch-readiness.md`: mark P2 #17 as `[x]` with Stage 124

---

### Stage 125: Notification Count N+1 Fix

**Goal:** Replace the per-engagement COUNT loops in `/api/notifications/count` and `/api/messages` with single aggregate queries. Currently a user with 20 engagements triggers 22+ database queries per badge poll.

**Will touch:** Two API route files, one new Postgres function, migration + rollback, test updates.

**Will NOT touch:** Frontend badge/count display logic, notification table, read cursor update flow, message send/receive.

**Done condition:** Both endpoints execute a fixed number of queries regardless of engagement count. Tests pass. Badge counts unchanged from user perspective.

---

#### 1. Migration — create `get_unread_counts` Postgres function

File: `supabase/migrations/00058_unread_counts_function.sql`

- [x] Create a function that returns unread message counts per engagement in one query:

  ```sql
  create or replace function public.get_unread_counts(p_person_id uuid)
  returns table (engagement_id uuid, unread_count bigint)
  language sql
  stable
  security definer
  as $$
    select
      m.engagement_id,
      count(*) as unread_count
    from public.messages m
    left join public.message_read_cursors mrc
      on mrc.engagement_id = m.engagement_id
      and mrc.person_id = p_person_id
    where m.engagement_id in (
      select id from public.active_engagements
      where crew_person_id = p_person_id or employer_person_id = p_person_id
    )
    and m.sender_person_id != p_person_id
    and m.created_at > coalesce(mrc.last_read_at, '1970-01-01'::timestamptz)
    group by m.engagement_id
    having count(*) > 0;
  $$;
  ```

  This returns ONLY engagements with unread messages (the `having` clause). Engagements with 0 unread simply don't appear — the caller treats missing = 0.

- [x] Corresponding rollback: `supabase/rollbacks/00058_unread_counts_function.down.sql`
  ```sql
  drop function if exists public.get_unread_counts(uuid);
  ```

---

#### 2. Refactor notification count endpoint

File: `apps/web/src/app/api/notifications/count/route.ts`

Replace the N+1 loop (lines ~63-82) with a single RPC call.

- [x] Call the new function:

  ```typescript
  const { data: unreadRows } = await supabase.rpc('get_unread_counts', {
    p_person_id: user.id,
  });
  const unreadMap = new Map(
    (unreadRows ?? []).map((r: { engagement_id: string; unread_count: number }) => [
      r.engagement_id,
      r.unread_count,
    ]),
  );
  ```

- [x] Replace the per-engagement loop with a simple iteration over the engagements list:

  ```typescript
  for (const eng of engList) {
    const hasUnread = unreadMap.has(eng.id);
    if (!hasUnread) continue;

    const engHat = eng.crew_person_id === user.id ? 'crew' : 'employer';
    if (engHat === currentHat) {
      msgCurrent += 1; // threads with unread (Stage 116 semantics)
    } else {
      msgAlt += 1;
    }
  }
  ```

- [x] Remove the `message_read_cursors` query that was previously fetched for the loop (the function handles cursors internally)

- [x] Net result: the entire endpoint should now make ~3-4 queries total:
  1. Auth (guard)
  2. Engagements list
  3. `get_unread_counts` RPC (replaces N queries)
  4. Notifications count

---

#### 3. Refactor messages endpoint

File: `apps/web/src/app/api/messages/route.ts`

Replace the N+1 loop (lines ~120-130) with the same RPC.

- [x] Call `get_unread_counts` RPC (same pattern as above)
- [x] Build unread map, then assign `unread_count` per conversation from the map:
  ```typescript
  const unreadCount = unreadMap.get(engId) ?? 0;
  ```
- [x] Remove the per-engagement COUNT loop
- [x] Remove the separate `message_read_cursors` batch query (the function handles it)
- [x] Verify `unread_total` in the response is still the sum of all `unread_count` values

---

#### 4. Update tests — notification count

File: `apps/web/__tests__/api/notifications-count.test.ts`

The tests currently mock individual per-engagement Supabase count calls. They need to mock the RPC instead.

- [x] Replace mock pattern: instead of mocking N `from('messages').select(...)` calls, mock `rpc('get_unread_counts', ...)` returning an array of `{ engagement_id, unread_count }` rows
- [x] Test: no unread messages → RPC returns empty array → message_count = 0
- [x] Test: 2 threads with unread on current hat → message_count = 2
- [x] Test: 1 thread current hat + 1 thread alt hat → message_count = 1, alt_message_count = 1
- [x] Test: cursor semantics preserved (implicit — the RPC handles it, but verify the response matches expected counts)
- [x] Keep auth test (401 unauthenticated) unchanged

---

#### 5. Update tests — messages endpoint

File: `apps/web/__tests__/api/messages.test.ts`

- [x] Replace mock pattern: mock `rpc('get_unread_counts', ...)` instead of per-engagement count queries
- [x] Verify `unread_count` per conversation matches the RPC return value
- [x] Verify `unread_total` is the sum
- [x] Verify conversations with 0 unread (not in RPC result) get `unread_count: 0`

---

#### 6. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 125] Notification count N+1 fix — get_unread_counts Postgres function replaces per-engagement COUNT loops in /api/notifications/count and /api/messages; fixed query count regardless of engagement volume`
  - Schema version: v58
  - Migration 00058 in table
- [x] Update `supabase/README.md`: new migration + RPC
- [x] Update `packages/db/README.md` if the RPC is exposed through db helpers (likely not — called directly via `supabase.rpc()`)
- [x] Remove the N+1 deferred decision from `BUILD_STATE.md` Deferred Decisions section (it's resolved)

---

## Done

(See git history for completed stages 51-123, fixes 118a/123a/123b)
