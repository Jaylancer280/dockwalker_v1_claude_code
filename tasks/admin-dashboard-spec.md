# DockWalker Admin Dashboard — Feature Specification (v2)

> Implementation blueprint for the admin dashboard, user moderation, support channel, and platform health tooling.
> This document contains concrete decisions, not options. Follow it exactly.
>
> **Baseline:** Stage 206 (current) — admin API-only tooling from Stage 103, plus `admin_delete_person` RPC (00095)
> **Admin screens:** Web-only — no admin routes in the mobile app
> **Design principle:** Functional and efficient, not pretty. Dense tables, click-through detail views, sidebar nav. Zero decorative UI.
>
> **v2 changelog (2026-04-13):** Stress-tested against current codebase. Fixes: broken `requireAdmin` fast path, blocking not in JWT, cascade contradictions, append-only invariant violation in DELETE route, `proxy.ts` vs `middleware.ts` convention, FK cleanup gaps, `cancelled_by` analytics pollution, Phase 1/3 ordering, messages RLS race on cancel. See §14 for full diff summary.

## Progress Tracker

> Updated by the planning agent at the end of each session. A fresh agent reads this first.

| Phase                                | Status      | Notes                                                                            |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------- |
| Phase 0 — Prerequisites              | DONE        | §0.1/0.3 already in place; §0.2 shipped in migration 00105                       |
| Phase 1 — Blocking + user moderation | DONE        | Cascade, requireDomainUser blocked check, user_notes, force-cancel + hide routes |
| Phase 2 — Reporting system           | NOT STARTED | Reports table, user-facing report flow, admin queue                              |
| Phase 3 — Support channel            | NOT STARTED | Support threads + messages, user feedback, admin inbox                           |
| Phase 4 — Admin dashboard UI         | NOT STARTED | Layout, pages, all read views, action panels                                     |
| Phase 5 — Platform health metrics    | NOT STARTED | Query-time aggregations, dashboard landing page                                  |
| Phase 6 — Event log browser          | NOT STARTED | Filterable raw event view, power-user tool                                       |
| Phase 7 — Intelligence layer (V2)    | NOT STARTED | Materialized metrics, anomaly detection, automated alerts                        |

**Last session:** 2026-04-21 — Phase 1 shipped (migration 00106 + API routes + UI)

---

## 0. Phase 0 — Prerequisites (ship before Phase 1)

These are bugs and gaps in the current codebase that Phase 1 cannot safely build on. They must land first.

### 0.1 Fix `requireAdmin` — it is currently broken for all modern sessions

**Problem.** `lib/auth/require-admin.ts:10` reads `is_admin` from the result of `requireDomainUser()`. But `requireDomainUser` has a header fast path (`require-domain-user.ts:25-44`) that hardcodes `is_admin: false` with the comment "Admin routes query DB directly" — they don't. After the JWT hook in migration 00078 was enabled, middleware always populates the headers, so the fast path always fires, and every admin route 403s.

**Fix.** Rewrite `requireAdmin` to ignore the `is_admin` value on the header fast path and do a targeted DB lookup instead:

```typescript
// lib/auth/require-admin.ts
import { NextResponse } from 'next/server';
import { requireDomainUser, type DomainUser } from './require-domain-user';

type AdminGuardResult = { ok: true; value: DomainUser } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard;

  // Always DB-check is_admin — do not trust the fast path's hardcoded false.
  // Admin traffic is low volume; one extra query is acceptable.
  const { data, error } = await guard.value.serviceClient
    .from('persons')
    .select('is_admin')
    .eq('id', guard.value.person.id)
    .single();

  if (error || !data?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  // Overwrite the hardcoded-false value with the real one for downstream consumers.
  guard.value.person.is_admin = true;
  return guard;
}
```

This preserves the fast path's perf for non-admin routes and fixes admin routes with a single localised change.

### 0.2 Extend the JWT custom access token hook with `is_admin` and `blocked_at`

**Problem.** Migration 00078 injects `person_id`, `current_hat`, `identity_type`, `onboarded`, `deactivated` into `app_metadata`. It does not inject `is_admin` or `blocked_at`. Without them, `proxy.ts` middleware cannot enforce admin-only path guards or blocked-user redirects without a DB query per request.

**Fix.** New migration `00096_jwt_hook_admin_and_blocked.sql`:

```sql
-- Extend custom_access_token_hook to include is_admin and blocked_at.
-- Existing claims (person_id, current_hat, identity_type, onboarded, deactivated) preserved.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  person_record record;
begin
  claims := event->'claims';

  select id, current_hat, identity_type, deactivated_at, is_admin, blocked_at
  into person_record
  from public.persons
  where id = (event->>'user_id')::uuid;

  if person_record.id is not null then
    claims := jsonb_set(claims, '{app_metadata, person_id}',      to_jsonb(person_record.id::text));
    claims := jsonb_set(claims, '{app_metadata, current_hat}',    to_jsonb(person_record.current_hat));
    claims := jsonb_set(claims, '{app_metadata, identity_type}',  to_jsonb(person_record.identity_type));

    if exists (select 1 from public.profiles where person_id = person_record.id) then
      claims := jsonb_set(claims, '{app_metadata, onboarded}', 'true'::jsonb);
    else
      claims := jsonb_set(claims, '{app_metadata, onboarded}', 'false'::jsonb);
    end if;

    if person_record.deactivated_at is not null then
      claims := jsonb_set(claims, '{app_metadata, deactivated}', 'true'::jsonb);
    end if;

    if person_record.blocked_at is not null then
      claims := jsonb_set(claims, '{app_metadata, blocked}', 'true'::jsonb);
    end if;

    if person_record.is_admin = true then
      claims := jsonb_set(claims, '{app_metadata, is_admin}', 'true'::jsonb);
    end if;
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

**Note:** `blocked_at` propagates on the next JWT refresh (up to 1 hour lag). Acceptable because the DB path also enforces via `requireDomainUser` — see §4.1. Admin claim is only read by `proxy.ts` for path routing, never as a security gate for a DB operation (RLS and the admin API guard are the real gates).

### 0.3 Proxy path guard for `/admin/*`

**Problem.** Admin UI pages can render Server Component data before client-side guards run. Non-admins can briefly see admin page scaffolding or data.

**Fix.** Extend `lib/supabase/middleware.ts` `updateSession()` to redirect non-admins away from `/admin/*` before rendering:

```typescript
// Add after the existing deactivation/onboarding checks:
if (path.startsWith('/admin') && user) {
  const isAdmin = appMeta?.is_admin === true;
  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
}
```

This uses the new `is_admin` JWT claim from 0.2. Combined with the server-side layout guard (§6.1), admin pages have two layers of enforcement.

### 0.4 Phase 0 acceptance criteria

- `/api/admin/users` responds 200 for an admin user with a modern JWT (regression test against Phase 0 fix)
- `/api/admin/users` responds 403 for a non-admin user
- Navigating to `/admin` as a non-admin redirects to `/` before any render
- Blocked user check infrastructure is in place but not yet referenced (Phase 1 uses it)

---

## 1. What Exists Today

Built in Stages 103-106 and extended through Stage 206.

| Capability          | Route                                        | Notes                                                                                                    |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| User list + search  | `GET /api/admin/users`                       | Paginated, search by name, filter by port                                                                |
| User detail         | `GET /api/admin/users/:personId`             | Profile, subscription, event count                                                                       |
| **User delete**     | `DELETE /api/admin/users/:personId`          | **Exists. Calls `admin_delete_person` RPC — hard-deletes events. To be replaced in Phase 1 — see §2.8.** |
| Stuck engagements   | `GET /api/admin/engagements`                 | Finds active engagements older than N days                                                               |
| Force-complete      | `POST /api/admin/engagements/:id/complete`   | Emits `ADMIN.ENGAGEMENT_COMPLETED`                                                                       |
| Canonical data CRUD | `GET/POST/PATCH /api/admin/canonical/:table` | 7 whitelisted reference tables                                                                           |
| Auth guard          | `requireAdmin()`                             | **Broken for modern JWTs until Phase 0 lands — see §0.1.**                                               |

**Service-role-only (never exposed via API):**

| Capability                            | Function                        | Use                                         |
| ------------------------------------- | ------------------------------- | ------------------------------------------- |
| Full hard-delete including event rows | `admin_delete_person(uuid)` RPC | Supabase dashboard manual test-user cleanup |

**Not built:** blocking, reporting, support channel, admin UI, metrics, event browser, force-cancel, posting moderation, admin notes, message visibility, last-active tracking.

---

## 2. Architecture Decisions

### 2.1 Three-way distinction: Blocking, Deactivation, Scrub

Each sets a timestamp on `persons`. They are independent and non-overlapping.

| Mechanism        | Initiated by | Reversible | Purpose                                   | Column                                                                                                     |
| ---------------- | ------------ | ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Blocking**     | Admin        | Yes        | Abuse/safety enforcement                  | `blocked_at`                                                                                               |
| **Deactivation** | User         | No         | User-initiated account closure            | `deactivated_at`                                                                                           |
| **Scrub**        | Admin        | No         | GDPR erasure or abuse purge (PII removal) | (soft: uses `deactivated_at` + `PERSON.DATA_SCRUBBED` event — projection scrub only, event rows preserved) |

Blocking is event-sourced (`ADMIN.USER_BLOCKED`, `ADMIN.USER_UNBLOCKED`). Deactivation uses `PERSON.DEACTIVATED`. Scrub uses `PERSON.DATA_SCRUBBED` (existing handler in migration 00081; extended in Phase 1).

### 2.2 Reports Table — CRUD, Not Event-Sourced

Reports are operational workflow data. CRUD table with RLS, not in the event ledger. The _action taken_ on a report (blocking a user, cancelling a posting) IS event-sourced.

### 2.3 Support Channel — Separate Tables

Support threads and messages live in their own tables, not in the engagement-scoped `messages` table. Reasons:

- `messages.engagement_id` is `NOT NULL` and FK-constrained (`00003_projection_tables.sql:113`) — support has no engagement
- Support conversations have different lifecycle (no acceptance gate, no ratings phase)
- Admin sees all threads; engagement messages are participant-scoped

Support events (`SUPPORT.THREAD_OPENED`, `SUPPORT.MESSAGE_SENT`) go to the event ledger for audit. The tables are CRUD for operational data.

### 2.4 Metrics — Query-Time for V1

At launch scale (hundreds of users, thousands of events), all metrics are computed at query time. No materialized views, no summary tables, no background jobs. When query-time gets slow (~50k events), introduce materialized views (Phase 7). Cache the overview endpoint for 60s with `revalidate` to blunt repeat loads — acceptable staleness for ops tooling.

### 2.5 Admin UI — Server Components + Proxy Guard + Layout Guard

Admin pages are Next.js server components where possible. Sensitive data must never reach a non-admin's browser, so enforcement is layered:

1. **Proxy guard** (`proxy.ts`/`updateSession`) — redirects non-admins away from `/admin/*` before any render. Relies on `is_admin` JWT claim from §0.2.
2. **Layout guard** (`app/(admin)/admin/layout.tsx` server component) — `redirect('/')` if `is_admin` is false. Belt and braces behind the proxy.
3. **API guard** (`requireAdmin`) — the real security gate. Every admin API route must call it.

Admin layout lives under `apps/web/src/app/(admin)/admin/` — a separate route group with its own sidebar layout.

### 2.6 Last-Active Tracking

Add `last_event_at` column to `persons`. Updated by `apply_projection` at the end of every event where `p_person_id` is not null. Backfill with `UPDATE persons SET last_event_at = (SELECT MAX(created_at) FROM events WHERE person_id = persons.id)` — acceptable at launch scale (low hundreds of users).

### 2.7 Cascade runs at the API layer, not in `apply_projection`

**Decision.** The `ADMIN.USER_BLOCKED` projection handler does exactly one thing: `update persons set blocked_at = now()`. All cascade effects (cancelling engagements, withdrawing applications, cancelling postings, clearing availability) are **separate events**, emitted atomically from the `/block` API route via `append_events_batch` (migration 00021).

This follows the existing pattern for compound actions (onboarding, Stage 96). Benefits:

- Each side effect is independently replayable and auditable
- The projection handler stays small and inspectable
- No recursive event emission from inside a SECURITY DEFINER function
- Event ordering is explicit in the API route, not buried in PL/pgSQL

See §3.8 for the full event sequence.

### 2.8 Scrub vs Purge

Two distinct cleanup pathways:

| Action    | Triggered by                                                                 | Touches events table?                       | Used for                                       |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| **Scrub** | Admin API (`DELETE /api/admin/users/:personId`)                              | No — projection scrub only, events retained | Real user erasure, GDPR erasure, abuse removal |
| **Purge** | Supabase dashboard (service-role) calling `admin_delete_person` RPC directly | Yes — hard-deletes events too               | Test user cleanup only, never via API          |

The existing DELETE route is **replaced in Phase 1**:

- No longer calls `admin_delete_person`
- Emits `PERSON.DATA_SCRUBBED` (existing handler in 00081 scrubs profiles + advisor + interactions — extended in Phase 1 to also clear notification channels, scrub user_notes authored by target, null out sender identity in support_messages)
- Sets `persons.deactivated_at = now()` via a paired `PERSON.DEACTIVATED` event
- Bans the auth row via `auth.admin.updateUserById(id, { ban_duration: '876000h' })` — ~100 years. This blocks login without breaking FK chains.

The `admin_delete_person` RPC (migration 00095) stays as-is. Its comment already notes "Use this to clean up test users or complete GDPR erasure after DATA_SCRUBBED" — Phase 1 just stops exposing it via HTTP.

Event rows remain in the ledger with PII present in historical payloads. This is an acknowledged residual trace of event sourcing: GDPR erasure removes access to PII via projection scrubs, but historical event payloads are retained for audit integrity. Document this in the user-facing privacy page.

---

## 3. Database Schema Changes

### 3.1 New Column: `persons.blocked_at`

```sql
ALTER TABLE public.persons ADD COLUMN blocked_at timestamptz;
```

Nullable. Set by `ADMIN.USER_BLOCKED` projection, cleared by `ADMIN.USER_UNBLOCKED` projection. JWT hook extended in §0.2 to propagate.

### 3.2 New Column: `persons.last_event_at`

```sql
ALTER TABLE public.persons ADD COLUMN last_event_at timestamptz;
```

Updated by `apply_projection` at the end of the `case` block when `p_person_id` is not null.

### 3.3 New Table: `reports`

```sql
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_person_id uuid NOT NULL REFERENCES public.persons(id),
  reported_person_id uuid NOT NULL REFERENCES public.persons(id),
  engagement_id uuid REFERENCES public.active_engagements(id),
  reason_category text NOT NULL CHECK (reason_category IN (
    'harassment', 'fraud', 'inappropriate_content',
    'safety_concern', 'spam', 'impersonation', 'duplicate_account', 'other'
  )),
  reason_text text NOT NULL CHECK (char_length(reason_text) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'reviewing', 'dismissed', 'actioned'
  )),
  admin_person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  admin_notes text,
  resolution text CHECK (resolution IN ('dismissed', 'warned', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT reports_no_self_report CHECK (reporter_person_id != reported_person_id)
);

CREATE INDEX idx_reports_status_category ON public.reports(status, reason_category);
CREATE INDEX idx_reports_reported ON public.reports(reported_person_id);
```

**RLS:**

- Authenticated users can INSERT where `reporter_person_id = auth.uid()`
- Authenticated users can SELECT own submitted reports (`reporter_person_id = auth.uid()`)
- Admin access via service client

**Notes:**

- `resolution` values: `'dismissed'` (no action), `'warned'` (admin added a note visible only internally), `'actioned'` (admin took a concrete action — block, posting hide, etc.). Removed `'blocked'` from the enum: blocking is a separate action with its own API route and event; reports track resolution categories, not the enforcement mechanism.
- `admin_person_id` uses `ON DELETE SET NULL` so scrubbing an admin doesn't block report retention (rare, but possible).
- Self-report prevention is enforced at the DB via CHECK constraint.
- Index includes `reason_category` so `/admin/reports` can prioritise `safety_concern` via a cheap secondary sort.

### 3.4 New Table: `user_notes`

```sql
CREATE TABLE public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.persons(id),
  admin_person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(content) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_notes_person ON public.user_notes(person_id);
```

**RLS:** no user access. Admin-only via service client. Notes are editable by the authoring admin only (author check in API route). Notes cannot be deleted — corrections are made via edit.

**FK:** `admin_person_id` is `ON DELETE SET NULL`. The authoring admin's identity is lost but the note survives with "unknown admin" attribution.

**Scrub behavior:** when the note's **subject** (person_id) is scrubbed, the projection handler for `PERSON.DATA_SCRUBBED` rewrites `user_notes.content` of the scrubbed user's notes to `'[content scrubbed]'`. Preserves audit trail without retaining PII-mentioning free text.

### 3.5 New Table: `support_threads`

```sql
CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.persons(id),
  subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  is_admin_initiated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_threads_person ON public.support_threads(person_id);
CREATE INDEX idx_support_threads_status ON public.support_threads(status);
```

**RLS:** authenticated users can SELECT/INSERT where `person_id = auth.uid()`. Admin access via service client.

### 3.6 New Table: `support_messages`

```sql
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  is_platform boolean NOT NULL DEFAULT false,
  content text NOT NULL CHECK (char_length(content) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_thread ON public.support_messages(thread_id);
```

`sender_person_id` is the actual person who sent the message (nullable for scrubbed senders). `is_platform` = `true` means the message displays as "DockWalker" regardless of who actually sent it.

**RLS:** thread participants can SELECT (where `thread_id` belongs to user's thread). No INSERT policy for `authenticated` role — all inserts go through API routes using the service client. Postgres RLS denies when no matching policy exists.

**Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;`

### 3.7 New Events + `aggregate_type` CHECK extension

Update the `events.aggregate_type` CHECK constraint to add `'support'`. Current (from 00059): `('person', 'vessel', 'daywork', 'application', 'message', 'engagement', 'checklist', 'invitation', 'experience', 'admin', 'permanent')`. New set adds `'support'`.

| Event                        | Aggregate Type | Payload                                                                          | Projection                                                   |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ADMIN.USER_BLOCKED`         | `admin`        | `{ person_id, reason_category, reason_text, admin_person_id }`                   | Set `persons.blocked_at = now()`. Nothing else — see §3.8.   |
| `ADMIN.USER_UNBLOCKED`       | `admin`        | `{ person_id, reason_text, admin_person_id }`                                    | Clear `persons.blocked_at = NULL`                            |
| `ADMIN.ENGAGEMENT_CANCELLED` | `admin`        | `{ engagement_id, posting_type, reason_category, reason_text, admin_person_id }` | Cancel engagement, mark posting, system message — see §3.8.3 |
| `ADMIN.POSTING_HIDDEN`       | `admin`        | `{ posting_id, posting_type, reason, admin_person_id }`                          | Set daywork/permanent posting status to `cancelled`          |
| `SUPPORT.THREAD_OPENED`      | `support`      | `{ thread_id, person_id, subject, is_admin_initiated }`                          | Audit no-op (thread created via CRUD)                        |
| `SUPPORT.MESSAGE_SENT`       | `support`      | `{ message_id, thread_id, sender_person_id, is_platform }`                       | Audit no-op (message created via CRUD)                       |

**`cancelled_by` CHECK extension (same migration):**

```sql
ALTER TABLE public.active_engagements DROP CONSTRAINT active_engagements_cancelled_by_check;
ALTER TABLE public.active_engagements ADD CONSTRAINT active_engagements_cancelled_by_check
  CHECK (cancelled_by IN ('crew', 'employer', 'postponement', 'admin'));
```

Admin-initiated cancellations use `cancelled_by = 'admin'`, keeping analytics clean. This was previously aliased to `'employer'` (a bug — fixed here).

### 3.8 Blocking Cascade — API-Layer Event Sequence

When admin blocks user X, the `/block` API route computes the list of side-effect events and submits them all in a single `append_events_batch` call (migration 00021) alongside `ADMIN.USER_BLOCKED`. The projection handlers for each event type are already correct — no new handler cascades required.

The API route does this work:

1. Query `active_engagements` where X is crew or employer with `status = 'active'`
2. Query `applications` where X is crew with `status IN ('applied', 'viewed', 'shortlisted', 'accepted', 'selected')`
3. Query `dayworks` where X is poster with `status IN ('active', 'in_progress')`
4. Query `permanent_postings` where X is employer with `status IN ('active', 'in_negotiation')`
5. Query `availability_windows` where X has any rows with `expires_at > now()`

Then build the event batch:

```typescript
const events = [
  { type: 'ADMIN.USER_BLOCKED', aggregate_type: 'admin', aggregate_id: personId, payload: {...}, person_id: adminPersonId },
  // One ADMIN.ENGAGEMENT_CANCELLED per active engagement (crew or employer side):
  ...activeEngagements.map(eng => ({
    type: 'ADMIN.ENGAGEMENT_CANCELLED',
    aggregate_type: 'admin',
    aggregate_id: eng.id,
    payload: {
      engagement_id: eng.id,
      posting_type: eng.daywork_id ? 'daywork' : 'permanent',
      daywork_id: eng.daywork_id,
      permanent_posting_id: eng.permanent_posting_id,
      reason_category: 'other',
      reason_text: 'Account suspended by DockWalker',
      admin_person_id: adminPersonId,
    },
    person_id: adminPersonId,
  })),
  // One ADMIN.POSTING_HIDDEN per affected posting owned by X:
  ...affectedPostings.map(p => ({ type: 'ADMIN.POSTING_HIDDEN', ... })),
  // One AVAILABILITY.SET (not_available: true) if X had any future windows:
  ...(hasFutureAvailability ? [{
    type: 'AVAILABILITY.SET',
    aggregate_type: 'person',
    aggregate_id: personId,
    payload: { not_available: true, start_date: today, end_date: today },
    person_id: personId, // still the user's own person_id — projection semantics unchanged
  }] : []),
];

await serviceClient.rpc('append_events_batch', { events });
```

**Projection handlers for `ADMIN.ENGAGEMENT_CANCELLED`:**

```sql
when 'ADMIN.ENGAGEMENT_CANCELLED' then
  update public.active_engagements
  set status = 'cancelled',
      cancelled_by = 'admin',
      cancellation_reason_category = p_payload->>'reason_category',
      cancellation_reason_text = p_payload->>'reason_text'
  where id = (p_payload->>'engagement_id')::uuid
    and status = 'active';

  -- Daywork: also update applications and daywork status
  if (p_payload->>'posting_type') = 'daywork' then
    update public.applications
    set status = 'cancelled_by_employer', updated_at = now()
    where daywork_id = (p_payload->>'daywork_id')::uuid
      and status IN ('accepted');

    update public.dayworks
    set status = 'cancelled'
    where id = (p_payload->>'daywork_id')::uuid
      and status IN ('active', 'in_progress');
  end if;

  -- Permanent: close the engagement and mark posting
  if (p_payload->>'posting_type') = 'permanent' then
    update public.active_engagements
    set status = 'closed', outcome = 'not_successful'
    where id = (p_payload->>'engagement_id')::uuid;

    update public.applications
    set status = 'cancelled_by_employer', updated_at = now()
    where permanent_posting_id = (p_payload->>'permanent_posting_id')::uuid
      and status IN ('selected');

    update public.permanent_postings
    set status = 'cancelled'
    where id = (p_payload->>'permanent_posting_id')::uuid
      and status IN ('active', 'in_negotiation');
  end if;

  -- System message into the engagement's chat (sender_person_id is the admin, is_system true)
  insert into public.messages (engagement_id, sender_person_id, content, is_system)
  values (
    (p_payload->>'engagement_id')::uuid,
    (p_payload->>'admin_person_id')::uuid,
    'This engagement has been cancelled by DockWalker.',
    true
  );
```

**`ADMIN.POSTING_HIDDEN` projection** just updates the posting row:

```sql
when 'ADMIN.POSTING_HIDDEN' then
  if (p_payload->>'posting_type') = 'daywork' then
    update public.dayworks
    set status = 'cancelled'
    where id = (p_payload->>'posting_id')::uuid
      and status IN ('active', 'in_progress');
  else
    update public.permanent_postings
    set status = 'cancelled'
    where id = (p_payload->>'posting_id')::uuid
      and status IN ('active', 'in_negotiation');
  end if;
```

**Pending applications** are withdrawn separately via direct status update in the `/block` API route (no event — these are the applications that aren't tied to active engagements and don't need individual system messages):

```typescript
await serviceClient
  .from('applications')
  .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
  .eq('crew_person_id', personId)
  .in('status', ['applied', 'viewed', 'shortlisted']);
```

**Invariants preserved:**

- `append_events_batch` is transactional — all cascade events succeed or none do.
- `ADMIN.USER_BLOCKED` is emitted first; subsequent events see `blocked_at` is set.
- Every cascade event has its own projection handler — no nested emission from inside `apply_projection`.
- `cancelled_by = 'admin'` keeps analytics honest (see §3.7 CHECK extension).
- System messages use the admin's `person_id` with `is_system = true` — the existing UI styles system messages without showing sender names.

**`ADMIN.USER_UNBLOCKED` does NOT restore state.** Cancelled engagements stay cancelled, withdrawn applications stay withdrawn, cancelled postings stay cancelled, cleared availability stays cleared. The user starts fresh.

**Notifications cleanup:** on block, the API route also deletes the blocked user's unread notifications (`notifications` table is CRUD, not event-sourced):

```typescript
await serviceClient.from('notifications').delete().eq('person_id', personId).eq('read', false);
```

On unblock, no restore — matches the "start fresh" principle.

### 3.9 Messages RLS tightening — close the cancellation race

**Problem.** The blocking cascade cancels engagements, but cached Realtime subscriptions and client state on the counterparty's side don't re-evaluate instantly. The counterparty can still send messages into a now-cancelled engagement until they refresh.

**Fix.** Tighten the messages INSERT RLS policy to require `active_engagements.status = 'active'`:

```sql
-- New migration (Phase 1 batch):
DROP POLICY IF EXISTS "Engagement participants can send messages" ON public.messages;
CREATE POLICY "Engagement participants can send messages on active engagements"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    engagement_id IN (
      SELECT id FROM public.active_engagements
      WHERE (crew_person_id = auth.uid() OR employer_person_id = auth.uid())
        AND status = 'active'
    )
  );
```

This fixes blocking, but is also a general improvement: users currently can still post messages to cancelled/completed engagements via the RLS policy, only blocked by API-layer checks. RLS should enforce the same rule.

Read RLS is unchanged — participants can still read their historical messages on cancelled engagements.

### 3.10 Extend `admin_delete_person` RPC for new tables

Even though `admin_delete_person` is no longer exposed via the admin API, it remains callable via Supabase dashboard for test cleanup. The new tables from Phases 1-3 need to be included in its FK-order delete chain to avoid violations during manual purges.

New migration (same file as Phase 1 schema):

```sql
-- Extend admin_delete_person to cover user_notes, reports, support tables
CREATE OR REPLACE FUNCTION public.admin_delete_person(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NEW: support_messages children first
  DELETE FROM public.support_messages WHERE thread_id IN (
    SELECT id FROM public.support_threads WHERE person_id = target_id
  );
  DELETE FROM public.support_messages WHERE sender_person_id = target_id;
  DELETE FROM public.support_threads WHERE person_id = target_id;

  -- NEW: reports — delete where target is reporter, reported, or admin
  DELETE FROM public.reports
    WHERE reporter_person_id = target_id
       OR reported_person_id = target_id;
  UPDATE public.reports SET admin_person_id = NULL WHERE admin_person_id = target_id;

  -- NEW: user_notes
  DELETE FROM public.user_notes WHERE person_id = target_id;
  UPDATE public.user_notes SET admin_person_id = NULL WHERE admin_person_id = target_id;

  -- ... existing delete chain from 00095 continues unchanged ...
END;
$$;
```

### 3.11 FK `ON DELETE` policy summary

| FK                                  | Behavior              | Rationale                                       |
| ----------------------------------- | --------------------- | ----------------------------------------------- |
| `reports.reporter_person_id`        | RESTRICT (no cascade) | Use scrub flow; purge cleans explicitly         |
| `reports.reported_person_id`        | RESTRICT              | Same                                            |
| `reports.admin_person_id`           | `ON DELETE SET NULL`  | Preserve report, lose admin attribution         |
| `user_notes.person_id`              | RESTRICT              | Scrub rewrites content; purge cleans explicitly |
| `user_notes.admin_person_id`        | `ON DELETE SET NULL`  | Preserve note, lose admin attribution           |
| `support_threads.person_id`         | RESTRICT              | Same                                            |
| `support_messages.thread_id`        | `ON DELETE CASCADE`   | Messages belong to their thread                 |
| `support_messages.sender_person_id` | `ON DELETE SET NULL`  | Preserve message content, lose sender identity  |

---

## 4. Enforcement Points — Where Blocking Takes Effect

### 4.1 Auth guard (`requireDomainUser`)

Add `blocked_at` check alongside the existing `deactivated_at` check. Because the header fast path bypasses the DB, the check must happen in **every** path:

- **Header fast path (lines 25-44):** read `x-blocked` header if present. Middleware sets this header from the JWT `blocked` claim (see §0.2 and §4.2).
- **JWT claims path (lines 77-117):** read `appMeta.blocked`.
- **DB fallback (lines 119-169):** SELECT `blocked_at` alongside `deactivated_at`.

In all three paths, if the user is blocked:

```typescript
return {
  ok: false,
  response: NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 }),
};
```

**Exception for support routes:** `requireDomainUser` accepts an optional `{ allowBlocked: true }` parameter. Support-facing API routes pass this flag so blocked users can still submit/read their own support threads:

```typescript
export async function POST(request: Request) {
  const guard = await requireDomainUser({ allowBlocked: true });
  if (!guard.ok) return guard.response;
  // ... support thread creation
}
```

The flag only skips the `blocked_at` check; `deactivated_at` is still enforced (deactivated accounts have no support access).

### 4.2 `proxy.ts` / `updateSession` — middleware-layer enforcement

**Important:** Next.js 16 uses `proxy.ts`, not `middleware.ts`. The file at `apps/web/src/proxy.ts` wraps `updateSession` from `lib/supabase/middleware.ts`. All "middleware" changes in this document mean changes to `lib/supabase/middleware.ts`.

Updates to `updateSession`:

1. **Blocked user redirect** (non-API paths):

```typescript
if (user && !isPublicRoute && !path.startsWith('/blocked') && !path.startsWith('/support')) {
  const isBlocked = appMeta?.blocked === true;
  if (isBlocked) {
    const url = request.nextUrl.clone();
    url.pathname = '/blocked';
    return NextResponse.redirect(url);
  }
}
```

2. **Admin path guard** (see §0.3).

3. **API header propagation** — set `x-blocked: true` when `appMeta?.blocked` so the header fast path in `requireDomainUser` can enforce without a DB query.

4. **Public route list extension**: `/blocked`, `/support`, and `/api/support/*` are treated as public-ish (authenticated but blocked-user accessible). Add to the public routes check carefully — `/blocked` requires auth (so an unblocked user accidentally there bounces to `/`).

### 4.3 `/blocked` page

Static-ish page under `apps/web/src/app/(public)/blocked/page.tsx`:

- Headline: "Your account is suspended"
- Body: "Your DockWalker account has been suspended. If you believe this is a mistake or want to discuss your account, please contact support."
- CTA: "Contact support" → `/support`
- Footer: "For urgent issues, email support@dockwalker.com" (fallback for Phase 1 before `/support` is built — see §8 phasing)

Server-renders without requiring `requireDomainUser`. Uses its own minimal auth check.

### 4.4 Discovery feeds

No explicit exclusion needed. Blocked users can't reach the discover API (auth guard rejects them). Their postings are cancelled by the cascade (§3.8). Their availability is cleared.

### 4.5 Realtime subscriptions

Blocked users' existing Realtime subscriptions are not forcibly disconnected — Supabase Realtime doesn't expose a per-user disconnect API. Their JWT remains valid until expiry (up to 1 hour). But:

- Their API calls are blocked by §4.1 enforcement (immediate).
- The cascade system messages are inserted during the block, so the counterparty's chat renders the "cancelled by DockWalker" message immediately.
- The counterparty can't send new messages into the engagement because §3.9 tightened the messages RLS INSERT policy to require `status = 'active'`.
- On next page navigation, `proxy.ts` redirects the blocked user to `/blocked`.

The acceptable worst case: the blocked user's browser tab continues rendering their cached chat for up to ~1 hour. They cannot send. They cannot receive new messages (because the counterparty cannot send). They lose navigation on any refresh.

### 4.6 Admin self-protection

Block endpoint explicitly rejects:

- Self-blocks: `if (personId === adminPerson.id) return 400 'Cannot block your own account'`
- Blocking another admin: `if (target.is_admin) return 400 'Cannot block an admin — demote first via direct DB access'`

Both are tested in Phase 1.

---

## 5. API Routes

### 5.1 Existing Routes — Updates

| Route                                        | Change                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/admin/users`                       | Add `blocked` filter param, return `blocked_at` + `last_event_at` in each row.                               |
| `GET /api/admin/users/:personId`             | Include `blocked_at`, `last_event_at` in response.                                                           |
| **`DELETE /api/admin/users/:personId`**      | **Replaced.** No longer calls `admin_delete_person`. Emits `PERSON.DATA_SCRUBBED` + bans auth row. See §5.2. |
| `POST /api/admin/engagements/:id/complete`   | No change.                                                                                                   |
| `GET/POST/PATCH /api/admin/canonical/:table` | No change.                                                                                                   |

### 5.2 New + Replaced Admin Routes

| Route                                      | Method | Purpose                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/admin/users/:personId`               | DELETE | **Scrub user.** Emits `PERSON.DATA_SCRUBBED` + `PERSON.DEACTIVATED` (batched). Projection scrubs PII from projections. Then calls `auth.admin.updateUserById(id, { ban_duration: '876000h' })` to block login. Events preserved. Self-deletion prevented. Admin-deletion prevented (see §4.6). Reversible only via direct DB. |
| `/api/admin/users/:personId/block`         | POST   | Block user. Body: `{ reason_category, reason_text }`. Emits batch: `ADMIN.USER_BLOCKED` + cascade events (see §3.8). Self-block + admin-block rejected. Body validates `reason_category IN (...)`.                                                                                                                            |
| `/api/admin/users/:personId/unblock`       | POST   | Unblock user. Body: `{ reason_text }`. Emits `ADMIN.USER_UNBLOCKED`. No state restoration.                                                                                                                                                                                                                                    |
| `/api/admin/users/:personId/notes`         | GET    | List admin notes for user, chronological.                                                                                                                                                                                                                                                                                     |
| `/api/admin/users/:personId/notes`         | POST   | Add admin note. Body: `{ content }`.                                                                                                                                                                                                                                                                                          |
| `/api/admin/users/:personId/notes/:noteId` | PATCH  | Edit admin note. Body: `{ content }`. Only the note's author can edit (author check via `admin_person_id = guard.value.person.id`).                                                                                                                                                                                           |
| `/api/admin/users/:personId/events`        | GET    | User's complete event timeline. Paginated, filterable by event type.                                                                                                                                                                                                                                                          |
| `/api/admin/users/:personId/engagements`   | GET    | All engagements (active + historical) for user.                                                                                                                                                                                                                                                                               |
| `/api/admin/users/:personId/postings`      | GET    | All daywork + permanent postings by user.                                                                                                                                                                                                                                                                                     |
| `/api/admin/users/:personId/applications`  | GET    | All applications by user (daywork + permanent).                                                                                                                                                                                                                                                                               |
| `/api/admin/engagements`                   | GET    | **Extend existing.** Add filters: status, date range, person_id, type (daywork/permanent). Remove stuck-only constraint.                                                                                                                                                                                                      |
| `/api/admin/engagements/:id`               | GET    | Engagement detail with full message history (service-client read bypasses participant RLS).                                                                                                                                                                                                                                   |
| `/api/admin/engagements/:id/cancel`        | POST   | Force-cancel engagement. Body: `{ reason_category, reason_text }`. Emits `ADMIN.ENGAGEMENT_CANCELLED`.                                                                                                                                                                                                                        |
| `/api/admin/postings`                      | GET    | All postings (daywork + permanent). Filterable by type, status, date, poster.                                                                                                                                                                                                                                                 |
| `/api/admin/postings/:id/hide`             | POST   | Hide a posting. Body: `{ posting_type, reason }`. Emits `ADMIN.POSTING_HIDDEN`.                                                                                                                                                                                                                                               |
| `/api/admin/reports`                       | GET    | Report queue. Filterable by status, category. Sort: `safety_concern` first, then `created_at DESC`. Paginated (20/page).                                                                                                                                                                                                      |
| `/api/admin/reports/:id`                   | GET    | Report detail with reporter + reported user context.                                                                                                                                                                                                                                                                          |
| `/api/admin/reports/:id`                   | PATCH  | Update report. Body: `{ status, admin_notes, resolution }`. Resolution `IN ('dismissed', 'warned', 'actioned')`. Does NOT auto-block — block is a separate action.                                                                                                                                                            |
| `/api/admin/support`                       | GET    | All support threads. Filterable by status. Sorted by `updated_at DESC`.                                                                                                                                                                                                                                                       |
| `/api/admin/support/:threadId`             | GET    | Thread messages.                                                                                                                                                                                                                                                                                                              |
| `/api/admin/support/:threadId`             | POST   | Send message as DockWalker. Body: `{ content, is_platform }`. Sets `sender_person_id = adminPersonId`, `is_platform = true` by default.                                                                                                                                                                                       |
| `/api/admin/support/:threadId/close`       | POST   | Close thread.                                                                                                                                                                                                                                                                                                                 |
| `/api/admin/support/initiate`              | POST   | Admin opens thread for a user. Body: `{ person_id, subject, content }`. Creates thread + first message + triggers a push + in-app notification to the target user via the existing `notifications` table (no email).                                                                                                          |
| `/api/admin/metrics`                       | GET    | Platform health summary (computed at query time). Cached server-side for 60s via `revalidate`.                                                                                                                                                                                                                                |
| `/api/admin/events`                        | GET    | Raw event log. Paginated, filterable by type, person, aggregate, date range.                                                                                                                                                                                                                                                  |

### 5.3 New User-Facing Routes

| Route                    | Method | Purpose                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/reports`           | POST   | Submit a report. Body: `{ reported_person_id, engagement_id?, reason_category, reason_text }`. Rate limit: 5 reports per hour per user (see existing rate limiter, Stage 90). Max 5 `open` reports per user — enforced with `INSERT ... WHERE ((SELECT COUNT(*) FROM reports WHERE reporter_person_id = $1 AND status = 'open') < 5)` (single-statement, no TOCTOU). |
| `/api/reports`           | GET    | List own submitted reports.                                                                                                                                                                                                                                                                                                                                          |
| `/api/support`           | GET    | List own support threads. Blocked users allowed (`{ allowBlocked: true }`).                                                                                                                                                                                                                                                                                          |
| `/api/support`           | POST   | Open new support thread. Body: `{ subject?, content }`. Max 3 `open` threads per user, enforced same pattern. Blocked users allowed.                                                                                                                                                                                                                                 |
| `/api/support/:threadId` | GET    | Thread messages (own threads only). Blocked users allowed.                                                                                                                                                                                                                                                                                                           |
| `/api/support/:threadId` | POST   | Send message in own thread. Body: `{ content }`. Blocked users allowed.                                                                                                                                                                                                                                                                                              |

---

## 6. Admin Dashboard UI

### 6.1 Layout

Route group: `apps/web/src/app/(admin)/admin/`

Sidebar navigation (fixed left, collapsed on smaller screens):

```
Overview        /admin
Users           /admin/users
Reports         /admin/reports     (badge: open count)
Engagements     /admin/engagements
Postings        /admin/postings
Support         /admin/support     (badge: open thread count)
Events          /admin/events
Canonical       /admin/canonical
```

**Guards (three layers):**

1. `proxy.ts` path guard (§0.3) redirects non-admins at the edge.
2. `app/(admin)/admin/layout.tsx` is a Server Component that calls `requireAdmin()` and `redirect('/')` on failure, **before** any child renders.
3. Every admin API route starts with `requireAdmin()`.

No `useEffect` client-side check — Server Component redirect is the source of truth.

No bottom nav. No mobile optimization — admin is desktop-only.

### 6.2 Pages

#### `/admin` — Overview

Platform health numbers in a simple grid. Cached 60s server-side.

| Metric                    | Source                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| Total users               | `COUNT(*) FROM persons WHERE deactivated_at IS NULL`                    |
| Active users (7d)         | `COUNT(*) FROM persons WHERE last_event_at > now() - interval '7 days'` |
| New signups (7d)          | `COUNT(*) FROM persons WHERE created_at > now() - interval '7 days'`    |
| Blocked users             | `COUNT(*) FROM persons WHERE blocked_at IS NOT NULL`                    |
| Active daywork postings   | `COUNT(*) FROM dayworks WHERE status = 'active'`                        |
| Active permanent postings | `COUNT(*) FROM permanent_postings WHERE status = 'active'`              |
| In-progress engagements   | `COUNT(*) FROM active_engagements WHERE status = 'active'`              |
| Completed this week       | `COUNT(*) FROM active_engagements WHERE status = 'completed' AND ...`   |
| Cancelled this week       | `COUNT(*) FROM active_engagements WHERE status = 'cancelled' AND ...`   |
| Open reports              | `COUNT(*) FROM reports WHERE status = 'open'`                           |
| Open support threads      | `COUNT(*) FROM support_threads WHERE status = 'open'`                   |

Below the grid: two tables.

**Action items — Open reports** (most recent 5 by `reason_category = 'safety_concern'` first, then `created_at DESC`, link to full queue)

**Action items — Stale engagements** (`active > STALE_ENGAGEMENT_DAYS` — constant at top of file, default 14; link to full list)

#### `/admin/users` — User List

**Filters:** identity type, current hat, blocked/active/all, port, text search (display name)
**Sort:** last active (default), created date, display name
**Columns:** Display name | Type | Hat | Port | Created | Last active | Status | →

Click row → `/admin/users/:personId`

#### `/admin/users/:personId` — User Detail

**Header:** Display name, identity type, hat, status (active/blocked/deactivated), created date, last active.

**Action bar:**

- Block / Unblock button
  - Block dialog includes: reason_category select, reason_text textarea, cascade preview (shows counts: "X active engagements, Y pending applications, Z postings will be cancelled"), and a "Stripe subscription cancelled?" acknowledgment checkbox (not enforced — reminder only).
  - Disabled for admins and self.
- Scrub User button (renamed from "Delete" for clarity)
  - Confirmation dialog explains: "This will remove this user's PII from the app, close their account, and prevent re-login. Event history is retained for audit. This action cannot be undone from the UI."
- Add note button
- Open support thread button

**Sections (vertical stack, all expanded by default):**

1. **Profile** — All profile fields: display_name, deck_name, avatar, primary_role, desired_role, certifications, experience_bracket, vessel_size_exposure, bio, location_port, location_city, nationality, visas, languages, permanent_availability + notice_period_days + currently_employed, smoker, visible_tattoos, sea_time_days, sea_time_nautical_miles, availability status, and identity-type-specific fields (agency_name, role_specializations for agents). Read-only.

2. **Admin Notes** — Chronological list. Each note: admin name (or "[deleted admin]" if null), date, content. Edit button visible only to original author. "Add note" form at bottom.

3. **Reports** — Two sub-tables: reports filed **against** this user, and reports filed **by** this user. Status, category, date, link to report detail.

4. **Event Timeline** — Complete event history from `events` table. Filterable by event type. Paginated (50/page, cursor-based). Shows: timestamp, event_type, payload summary. Most recent first.

5. **Engagements** — All engagements (crew side + employer side). Columns: counterparty, job, dates, status, posting type. Link to engagement detail.

6. **Postings** — All daywork + permanent postings. Columns: type, role, port, dates, status, application count. Link to posting detail.

7. **Applications** — All applications submitted (daywork + permanent). Columns: job, status, applied date.

8. **Support Threads** — Any support threads for this user. Link to thread.

#### `/admin/reports` — Report Queue

**Filters:** status (open/reviewing/dismissed/actioned/all), reason_category
**Sort:** `safety_concern` first (categorical priority), then `created_at DESC`
**Columns:** Reporter | Reported | Category | Status | Submitted | →

Click row → report detail panel (inline expansion — decided, not a separate page):

- Reporter's message (reason_text)
- Link to reported user's detail page
- Link to engagement (if engagement_id present) with message history
- Action form: status dropdown, admin notes textarea, resolution dropdown (`dismissed` / `warned` / `actioned`), Save button
- Note above action form: "Blocking or hiding a posting is a separate action. This form only records resolution status."

#### `/admin/engagements` — Engagement List

**Filters:** status (active/completed/cancelled/closed/all), type (daywork/permanent), date range, person search
**Sort:** created_at DESC (default), days_active for active
**Columns:** Crew | Employer | Job # | Type | Dates | Status | Days active | →

Click row → `/admin/engagements/:id`

#### `/admin/engagements/:id` — Engagement Detail

**Header:** Status badge, job reference, type (daywork/permanent), dates.

**Action bar:** Force-complete (daywork only, active engagements only), Force-cancel (active engagements only).

**Sections:**

1. **Parties** — Crew name (link), Employer name (link).
2. **Job Details** — Role, vessel, port, rate/salary, dates, positions.
3. **Status History** — Derived from events: accepted, work started, completed/cancelled, rated. Timeline view.
4. **Messages** — Full message history. Read-only. System messages styled differently. Service-client read bypasses participant RLS.
5. **Ratings** — If rated, show both crew and employer ratings.

#### `/admin/postings` — Postings List

**Filters:** type, status, date range, poster search
**Columns:** Job # | Type | Role | Port | Dates | Status | Applications | Poster | →

Click row → posting detail (inline): full posting fields + application list.

#### `/admin/support` — Support Inbox

**Filters:** status (open/closed/all)
**Sort:** updated_at DESC
**Columns:** User | Subject | Status | Messages | Last updated | →

Click row → `/admin/support/:threadId`

#### `/admin/support/:threadId` — Support Thread

Chat-style message list. From the admin's perspective: user messages on the left, DockWalker messages on the right.

**Footer:** Text input + "Send as DockWalker" button. "Close thread" button in header.

**Sidebar:** User info summary (name, type, hat, status) with link to full user detail.

#### `/admin/events` — Event Log Browser

**Filters:** event type (dropdown of all types), person_id (text input), aggregate_type, date range
**Sort:** created_at DESC
**Pagination:** cursor-based, 50 per page
**Columns:** Timestamp | Event type | Person | Aggregate | Payload (truncated, expandable)

Click row → expand to show full payload JSON.

#### `/admin/canonical` — Reference Data

Tabs for each table (regions, cities, ports, yacht_roles, certifications, experience_brackets, vessel_size_bands).

**Scope:** add + edit label fields only. Deletion is deferred (FK implications on live data). Spec is explicit: **no delete button in V1.**

---

## 7. User-Facing UI for Reports and Support

### 7.1 Report Flow

**Where the report button appears:**

1. **Chat kebab menu** — "Report user" option. Pre-fills `engagement_id` and `reported_person_id` (the counterparty).
2. **Profile overlay** — "Report" link at the bottom. Pre-fills `reported_person_id`. No engagement context.

**Report dialog:** Modal with:

- Reason category dropdown (harassment, fraud, inappropriate content, safety concern, spam, impersonation, duplicate account, other)
- Reason text textarea (required, max 1000 chars — matches DB CHECK)
- Submit button

After submission: toast confirmation "Report submitted. We'll review it shortly."

No report detail view for users — they submit and move on.

### 7.2 Support / Feedback Channel

**Entry points:**

1. **Settings page** — "Contact DockWalker" / "Send feedback" row → `/support`
2. **Blocked page** — "Contact support" link → `/support`
3. Future: help icon (deferred)

**`/support` page (user-facing):**

List of own support threads (most users will have 0-1). "New message" button to start a thread.

Click thread → chat view. From the user's perspective: their own messages on the right, DockWalker messages on the left.

**New thread flow:** Subject (optional), message content (required). Creates thread + first message in a single API call (server-side transaction via batched insert — one request, not two).

**Admin-initiated threads:** when admin opens a thread via `/api/admin/support/initiate`, the target user gets:

- An in-app notification (existing `notifications` table, type `support_opened`)
- A push notification (existing push-triggers, if `push_messages = true` in `user_preferences`)
- No email (admin-initiated isn't a user-expected channel)

---

## 8. Implementation Phases

### Phase 0 — Prerequisites

See §0. Ships before Phase 1.

- Fix `requireAdmin` (direct DB check)
- Migration `00096_jwt_hook_admin_and_blocked.sql` — extend JWT hook with `is_admin` and `blocked_at`
- Update `lib/supabase/middleware.ts` `updateSession`:
  - Admin path guard for `/admin/*`
  - Header propagation for `x-blocked`
- Enable new JWT claims in Supabase dashboard (out-of-code step — flag in §12)

**Tests:** admin routes respond 200 for admin, 403 for non-admin. Non-admin navigating to `/admin` gets redirected before render.

### Phase 1 — Blocking + User Moderation + Scrub

**Single migration file** `00097_admin_phase1.sql`:

- Add `blocked_at`, `last_event_at` columns to `persons`
- Extend `events.aggregate_type` CHECK to include `'support'`
- Extend `active_engagements.cancelled_by` CHECK to include `'admin'`
- Create `user_notes` table with RLS + FK `ON DELETE SET NULL` on `admin_person_id`
- Tighten `messages` INSERT RLS policy to require `active_engagements.status = 'active'`
- Extend `admin_delete_person` RPC to cover `user_notes`, `reports`, `support_threads`, `support_messages` (even though reports + support aren't created until later phases — the RPC should be ready)
  - Note: use `IF EXISTS` guards for tables that don't exist yet in this migration; or split this extension into a separate migration that ships after Phase 3. **Recommended: split** — see Phase 3 notes.
- Update `apply_projection`:
  - `ADMIN.USER_BLOCKED` — sets `blocked_at`, nothing else
  - `ADMIN.USER_UNBLOCKED` — clears `blocked_at`
  - `ADMIN.ENGAGEMENT_CANCELLED` — cancels engagement + posting + applications + system message (see §3.8)
  - `ADMIN.POSTING_HIDDEN` — cancels posting
  - Extend `PERSON.DATA_SCRUBBED` to also clear notification_channels and scrub user_notes content (via new table from this migration)
  - Add `last_event_at = now()` write at end of every event case where `p_person_id IS NOT NULL`
- Backfill `last_event_at` from existing events

**API routes (Phase 1):**

- `POST /api/admin/users/:personId/block`
- `POST /api/admin/users/:personId/unblock`
- `GET/POST /api/admin/users/:personId/notes`
- `PATCH /api/admin/users/:personId/notes/:noteId`
- `POST /api/admin/engagements/:id/cancel`
- `POST /api/admin/postings/:id/hide`
- **Replace** `DELETE /api/admin/users/:personId` to emit `PERSON.DATA_SCRUBBED` + `PERSON.DEACTIVATED` via `append_events_batch`, then ban auth row. No longer calls `admin_delete_person`.

**Enforcement:**

- `requireDomainUser` — add `blocked_at` check across all three paths (header, JWT, DB), add `{ allowBlocked: true }` option
- `lib/supabase/middleware.ts` — redirect blocked users to `/blocked` on non-API non-support paths
- `/blocked` static page with email fallback link (`/support` not available until Phase 3)

**Phase 1 cannot be shipped alone to production.** Phase 3 ships before any user is blocked in production, OR Phase 1's `/blocked` page uses the `mailto:` fallback only. Decision recorded in §12.

**Tests:**

- Block/unblock happy path
- Cascade verification (engagements cancelled, applications withdrawn/cancelled-by-employer, postings hidden, availability cleared, system messages inserted)
- Permanent engagement cascade verification (separate test — common regression)
- Auth guard rejection on blocked user (all three paths)
- Unblock does not restore cascaded state
- Force-cancel engagement: happy path, non-active engagement rejection
- Admin notes: create, list, edit (author-only), update
- Admin self-block rejection, admin-on-admin block rejection
- Scrub route: emits batched events, bans auth user, does not call admin_delete_person, event rows preserved
- `last_event_at` updated on event append (one test per major event type)

### Phase 2 — Reporting System

**Migration `00098_reports.sql`:**

- Create `reports` table with CHECK constraints (self-report, reason_text length), indexes, RLS

**API routes:**

- `POST /api/reports` (user submits — single-statement cap enforcement)
- `GET /api/reports` (user lists own reports)
- `GET /api/admin/reports` (queue with category priority sort)
- `GET /api/admin/reports/:id` (detail)
- `PATCH /api/admin/reports/:id` (admin updates)

**UI (user-facing):**

- Report button in chat kebab menu
- Report link on profile overlay
- Report submission dialog

**Tests:** submission, self-report rejection, cap enforcement (try 6th open report → 400), admin queue filtering, report resolution flow, category-priority sort.

### Phase 3 — Support Channel

**Migration `00099_support.sql`:**

- Create `support_threads` and `support_messages` tables with RLS, FKs with `ON DELETE` behavior per §3.11
- Add `support_messages` to Supabase Realtime publication
- Extend `apply_projection` with `SUPPORT.THREAD_OPENED` and `SUPPORT.MESSAGE_SENT` audit no-op handlers

**Migration `00100_extend_admin_delete_person.sql`:**

- Update `admin_delete_person` RPC to clean up user_notes, reports, support_threads, support_messages in FK order (child-first)

**API routes:**

- User-facing: `GET/POST /api/support`, `GET/POST /api/support/:threadId` (all with `{ allowBlocked: true }`)
- Admin: `GET /api/admin/support`, `GET/POST /api/admin/support/:threadId`, `POST /api/admin/support/:threadId/close`, `POST /api/admin/support/initiate`

**UI (user-facing):**

- `/support` page (thread list + chat view)
- "Contact DockWalker" entry point in settings
- Update `/blocked` page Contact Support link from `mailto:` to `/support`

**Tests:** thread creation (single request), message send/receive, admin reply as DockWalker, thread close, Realtime subscription, blocked users can access support routes (via `allowBlocked`), cap enforcement.

### Phase 4 — Admin Dashboard UI

This phase builds the frontend for everything from Phases 1-3 plus existing admin APIs. It also includes the backend routes that support UI pages but weren't needed for earlier phases.

**New API routes (backend support for dashboard pages):**

- `GET /api/admin/users/:personId/events`
- `GET /api/admin/users/:personId/engagements`
- `GET /api/admin/users/:personId/postings`
- `GET /api/admin/users/:personId/applications`
- `GET /api/admin/engagements/:id` (with messages)
- `GET /api/admin/postings`

**Layout + pages:**

- `(admin)/admin/layout.tsx` — sidebar nav + Server Component admin guard
- `/admin` — overview (static layout — metrics wired in Phase 5)
- `/admin/users` — user list
- `/admin/users/[personId]` — user detail hub
- `/admin/reports` — report queue
- `/admin/engagements` — engagement list
- `/admin/engagements/[id]` — engagement detail with messages
- `/admin/postings` — postings list
- `/admin/support` — support inbox
- `/admin/support/[threadId]` — support thread
- `/admin/canonical` — reference data UI (add + edit, no delete)

### Phase 5 — Platform Health Metrics

**API:**

- `GET /api/admin/metrics` — returns all overview metrics, computed at query time, cached 60s

**UI:**

- Wire metrics into `/admin` overview
- Add action item tables (open reports, stale engagements)

### Phase 6 — Event Log Browser

**API:**

- `GET /api/admin/events` — paginated, filtered event log

**UI:**

- `/admin/events` page with filter controls and expandable payload rows

---

## 9. Explicitly Deferred (Phase 7 / V2)

| Item                                                | Why deferred                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Device fingerprinting / multi-account detection     | Complex, requires client-side fingerprint collection. Low priority at launch scale.            |
| Automated anomaly detection                         | Requires population baselines that don't exist at launch.                                      |
| Materialized metric views                           | Query-time + 60s cache is fast enough at launch. Introduce when event table exceeds ~50k rows. |
| Time-limited suspensions (auto-unblock)             | Admin can manually unblock. Automation is a convenience.                                       |
| Bulk admin actions                                  | One-at-a-time is fine for 1-2 admins at launch scale.                                          |
| GDPR data export automation                         | Manual export via SQL is acceptable initially.                                                 |
| Admin email/push alerts on new reports              | Badge counts on dashboard are sufficient when admin checks daily.                              |
| Cross-engagement message search                     | Heavy feature. Admin can search per-user via the event timeline.                               |
| Structured warning system                           | Admin notes + `resolution = 'warned'` serve this purpose informally.                           |
| Cancellation rate / rating outlier flagging         | Intelligence layer. Requires materialized per-user stats.                                      |
| Onboarding funnel / retention metrics               | Analytics layer. Vercel Analytics covers basic page views.                                     |
| Content moderation (word filters, auto-flag)        | Manual moderation is appropriate at launch scale.                                              |
| Automatic Stripe subscription cancellation on block | Admin acknowledges manually for now. Full automation is V2.                                    |
| Restore blocked user state on unblock               | "Start fresh" is simpler and matches abuse-enforcement semantics. Restore is V2 if needed.     |

---

## 10. Migration Checklist

Phase 0 ships `00096_jwt_hook_admin_and_blocked.sql`.

Phase 1 ships `00097_admin_phase1.sql` covering:

- [ ] Add `blocked_at timestamptz` to `persons`
- [ ] Add `last_event_at timestamptz` to `persons`
- [ ] Backfill `last_event_at` from existing events (`UPDATE persons SET last_event_at = (SELECT MAX(created_at) FROM events WHERE person_id = persons.id)` — acceptable at launch scale)
- [ ] Extend `events.aggregate_type` CHECK to include `'support'` (even though support tables don't exist yet — future-proofing, so Phase 3 doesn't need to touch `events` CHECK)
- [ ] Extend `active_engagements.cancelled_by` CHECK to include `'admin'`
- [ ] Create `user_notes` table with FK `ON DELETE SET NULL` on `admin_person_id`, CHECK `char_length(content) <= 4000`
- [ ] RLS policies for `user_notes`
- [ ] Tighten `messages` INSERT RLS to require `active_engagements.status = 'active'`
- [ ] Update `apply_projection`:
  - [ ] `ADMIN.USER_BLOCKED` handler
  - [ ] `ADMIN.USER_UNBLOCKED` handler
  - [ ] `ADMIN.ENGAGEMENT_CANCELLED` handler (daywork + permanent branches)
  - [ ] `ADMIN.POSTING_HIDDEN` handler
  - [ ] Extend `PERSON.DATA_SCRUBBED` handler: clear `notification_channels`, scrub `user_notes.content`
  - [ ] `last_event_at = now()` write at end of every event case when `p_person_id IS NOT NULL`
- [ ] **Rollback `00097_admin_phase1.sql`** (self-contained per CLAUDE.md Invariant #4):
  - [ ] Restore previous `apply_projection` body verbatim from the prior migration (grep-count `when '...' then` to match)
  - [ ] Revert `active_engagements.cancelled_by` CHECK — must `DELETE FROM events WHERE aggregate_type = 'admin' AND event_type IN ('ADMIN.ENGAGEMENT_CANCELLED', 'ADMIN.POSTING_HIDDEN')` first if any such events exist; otherwise the projection could replay onto a rolled-back schema
  - [ ] Revert `events.aggregate_type` CHECK — must first `DELETE FROM events WHERE aggregate_type = 'support'` (unlikely to exist this early but defensive)
  - [ ] Revert `messages` RLS policy to prior
  - [ ] Drop `user_notes` table
  - [ ] Drop `blocked_at`, `last_event_at` columns
  - [ ] Set `persons.blocked_at` data is lost — acceptable, rollback is a test-only operation

Phase 2 ships `00098_reports.sql`:

- [ ] Create `reports` table with CHECK constraints (self-report, reason_text length), indexes, RLS
- [ ] Rollback: drop `reports` table

Phase 3 ships `00099_support.sql` + `00100_extend_admin_delete_person.sql`:

- [ ] `00099`: create `support_threads`, `support_messages`, RLS, FKs per §3.11
- [ ] `00099`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages`
- [ ] `00099`: extend `apply_projection` with `SUPPORT.*` audit no-op handlers
- [ ] `00099` rollback: `ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages`, drop tables, restore prior `apply_projection`, `DELETE FROM events WHERE aggregate_type = 'support'` before rollback finishes
- [ ] `00100`: extend `admin_delete_person` RPC for `user_notes`, `reports`, `support_threads`, `support_messages` (child-first delete order)
- [ ] `00100` rollback: restore prior `admin_delete_person` body

**Migration deployment procedure** (this project):

Per `memory/MEMORY.md`: this repo does NOT use local Docker/local Supabase. Apply all new migrations via `npx supabase db push` against the linked remote project. Do NOT attempt `npx supabase db reset` (requires Docker). Smoke-test each phase's migration against the live dev project before moving on.

**After every phase migration push:**

1. `npx supabase db push` from repo root
2. `cd apps/web && npx vitest run` — unit tests must pass
3. `cd apps/web && npm run test:integration` — integration tests exercise the real DB
4. Manual smoke test against `localhost:3000` pointed at dev Supabase:
   - Phase 0: admin route responds 200 for admin, 403 for non-admin
   - Phase 1: block a test user, verify cascade (engagements cancelled, messages show system message, permanent handled, availability cleared), unblock, verify no restore
   - Phase 2: submit a report, try self-report (400), admin queue sees it
   - Phase 3: user opens a thread, admin replies, Realtime delivers within 1s

---

## 11. Test Plan

### API Tests (Vitest)

**Phase 0:**

- `requireAdmin` returns 200 for admin with modern JWT (regression for the fast-path bug)
- `requireAdmin` returns 403 for non-admin with modern JWT
- Proxy redirect on `/admin/*` for non-admin
- JWT claims include `is_admin` and `blocked` after migration

**Phase 1 — Blocking + Scrub:**

- Block user: happy path, non-admin 403, self-block 400, admin-on-admin block 400, already-blocked idempotency
- Block cascade daywork: active engagements cancelled (`cancelled_by = 'admin'`), pending applications withdrawn, accepted applications set to cancelled_by_employer, active dayworks cancelled, availability cleared, system message inserted, unread notifications cleared
- Block cascade permanent: active engagements closed (status `'closed'`, outcome `'not_successful'`), selected applications set to cancelled_by_employer, active/in_negotiation permanent_postings cancelled
- Unblock user: happy path, does not restore cascaded state
- Auth guard: blocked user gets 403 on all domain routes except `/api/support/*`
- Blocked user gets 200 on `/api/support/*` via `allowBlocked: true`
- Force-cancel engagement: happy path, non-active engagement rejection
- Admin notes: create, list, edit (author-only enforced — different-admin edit returns 403)
- `last_event_at` updated on DAYWORK.APPLIED, VESSEL.CREATED, PROFILE.UPDATED, etc.
- Scrub user: happy path emits `PERSON.DATA_SCRUBBED` + `PERSON.DEACTIVATED` via `append_events_batch`, bans auth row, does NOT call `admin_delete_person` (mock spy), event rows for that person still exist post-scrub, projection data is anonymised (`display_name = 'Deleted User'`)
- Scrub user: non-admin 403, self-scrub 400, admin-scrub prevented (cannot scrub an admin via API)
- Messages INSERT RLS rejects posts to `status != 'active'` engagements

**Phase 2 — Reporting:**

- Submit report: happy path
- Self-report: DB CHECK rejects (500 in route → handled as 400)
- Missing fields: 400
- Cap enforcement: 6th open report → 400, closing earlier reports allows new ones
- Admin queue: filter by status, by category; safety_concern sort priority
- Admin PATCH: status transitions, resolution values, `'blocked'` NOT in enum

**Phase 3 — Support:**

- Create support thread + first message in a single API call (atomic)
- Send message: user and admin
- Thread close: only admin
- Admin initiate: creates thread + first message + in-app notification to target user
- Own-thread-only access: user can't read other users' threads
- Blocked user can create/read/reply to own support threads
- Cap enforcement: 4th open thread → 400

**Phase 4-6:**

- Metrics endpoint: returns expected counts, cache header present
- Events endpoint: pagination, filtering
- Postings endpoint: type/status filters
- Admin layout: Server Component redirect on non-admin (rendering test)

### E2E (Playwright)

Add to `tasks/playwright-test-registry.md`:

- `admin-happy-path.spec.ts`: admin logs in, navigates through every admin page, performs a block on a test user, verifies the cascade by logging in as the test user and seeing `/blocked`, logs back in as admin and unblocks
- `support-blocked-user.spec.ts`: block a test user, verify they can still open a support thread, send a message, and see admin reply
- `report-submission.spec.ts`: crew reports another user from chat kebab, admin sees it in queue, resolves it

---

## 12. Relationship to Existing Systems

| System                | Impact                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT auth              | **Phase 0 requires Supabase dashboard action** to re-enable the custom access token hook with the new `is_admin` + `blocked` claims. Flag for human edit after `00096` ships.                                           |
| Push notifications    | Blocked users stop receiving pushes naturally (their engagements are cancelled). Block explicitly clears unread notifications.                                                                                          |
| Email notifications   | Same — email triggers gate on notification preferences and active engagements.                                                                                                                                          |
| Docky AI advisor      | Blocked users can't access Docky (auth guard blocks all non-support routes).                                                                                                                                            |
| Stripe subscriptions  | Blocking does not cancel subscriptions automatically. Block dialog requires admin to acknowledge Stripe status as a reminder. Automated cancellation is deferred.                                                       |
| Mobile app            | No admin routes in mobile. Blocking enforcement works via the same API auth guard. Support channel is web-only initially — mobile can display a "Contact support via web app" CTA on the blocked screen.                |
| Cron jobs             | Availability expiry and engagement-starts crons will skip blocked users naturally — availability cleared and engagements cancelled by the cascade.                                                                      |
| Realtime              | Open Realtime subs on blocked users are not forcibly disconnected. Counterparties can't send new messages (§3.9 RLS), so cached clients render stale state safely until refresh.                                        |
| Append-only invariant | Preserved. Scrub flow emits events, does not mutate historical payloads. The existing `admin_delete_person` RPC (which does delete events) is retained only as a service-role tool for test cleanup, never API-exposed. |

**Phase 1 + Phase 3 ordering constraint:** Phase 1 introduces blocking and a `/blocked` page. Blocked users need a recovery path. Two options:

- **Option A (recommended):** ship Phase 1, Phase 2, Phase 3 together as a single release. No partial blocking enforcement.
- **Option B:** ship Phase 1 alone with a `/blocked` page that has only a `mailto:support@dockwalker.com` link (no `/support`). Acceptable stopgap if Phase 3 is >2 weeks out.

The decision is recorded in `tasks/todo.md` when planning begins.

---

## 13. Open Questions (to decide before building)

These are genuinely ambiguous even after the stress test. Planning agent must raise to the user:

1. **Scrub + auth row:** do we ban (`ban_duration`) or delete (`auth.admin.deleteUser`)? Banning preserves the FK to `persons`; deleting requires persons to be cleaned up first (breaks append-only). Recommendation: ban. Confirm with user.
2. **Phase 1+3 bundling (§12):** Option A or B? Depends on Phase 3 timeline.
3. **`resolution = 'warned'` semantics:** does it surface to the user (as a support message), or is it purely an internal note? Recommendation: purely internal, visible in admin notes.
4. **Admin notes visibility on scrub:** when a user is scrubbed, are admin notes about them kept (audit retention) or deleted (privacy)? Recommendation: kept, with content rewritten to `'[content scrubbed]'`.
5. **Rate limit on report submission:** 5/hour is a proposal — confirm with user. Stage 90 rate limiter supports this.

---

## 14. Changelog from v1

Every change in this document relative to the original spec, with traceability to the stress test findings.

**Critical fixes:**

- **C1:** §2.8 and §5.2 now state clearly that `PERSON.DATA_SCRUBBED` scrubs projections only. Event payloads are retained as acknowledged residual trace. No UPDATE on events.
- **C2:** §1 now lists the existing DELETE route. §5.1 and §5.2 explicitly mark it as **replaced** in Phase 1. `admin_delete_person` becomes service-role-only, not API-exposed.
- **C3:** §0.1 — `requireAdmin` rewritten to DB-check `is_admin` regardless of fast path. Phase 0 prerequisite.
- **C4:** §0.2, §4.1, §4.2 — JWT hook extended with `blocked_at`, `requireDomainUser` checks blocked across all three resolution paths, middleware propagates `x-blocked` header.
- **C5:** §3.8 rewritten from scratch. Step 6 (selection revert) deleted as contradictory with Step 2. Permanent engagement handling folded into `ADMIN.ENGAGEMENT_CANCELLED` branches.
- **C6:** §3.8 — cascade runs at the API layer via `append_events_batch`, not via nested emission from the projection handler. `ADMIN.USER_BLOCKED` projection is now one line.

**High fixes:**

- **H1:** §4.2 — every "middleware" reference clarified as `lib/supabase/middleware.ts` with `proxy.ts` note.
- **H2:** §3.10 and Phase 3 migration checklist — `admin_delete_person` extended for new tables (separate migration `00100`, ships with Phase 3).
- **H3:** §3.11 — explicit FK `ON DELETE` table. Admin-authored FKs use `ON DELETE SET NULL`. Subject FKs use RESTRICT.
- **H4:** §3.7 — `cancelled_by` CHECK extended to include `'admin'`. Analytics stay clean.
- **H5:** §3.8 — system messages use blocking admin's `person_id` + `is_system = true`. Existing UI renders system messages without showing sender names.
- **H6:** §12 ordering constraint — Phase 1+3 bundled by default (Option A). Option B (mailto fallback) documented as stopgap.
- **H7:** §2.5, §6.1 — three layers of admin enforcement (proxy, Server Component layout redirect, API guard). No `useEffect` client-side check.
- **H8:** §3.8 — application status transitions for accepted/selected applications are explicit in `ADMIN.ENGAGEMENT_CANCELLED` handler branches.
- **H9:** §4.6 — self-block and admin-on-admin block both rejected at the API layer with tests.
- **H10:** §3.9 — messages INSERT RLS tightened to require `active_engagements.status = 'active'`. Closes cancellation race.

**Medium fixes:**

- **M1:** §3.3 — `CHECK (reporter_person_id != reported_person_id)` on reports table.
- **M2:** §3.3 — `CHECK (char_length(reason_text) <= 1000)` matches UI.
- **M3:** §5.3 — cap enforcement uses single-statement conditional INSERT, not TOCTOU.
- **M4:** §3.3 — `resolution` enum drops `'blocked'`. §5.2 explicitly separates resolution from block action.
- **M5:** §3.8 — block flow clears unread notifications. Unblock does not restore.
- **M6:** §7.2 — admin-initiated support thread notification mechanism specified (in-app + push, no email).
- **M7:** §6.2 — User Detail Profile section enumerates all current profile fields, including deck_name, desired_role, career status, smoker, visible_tattoos, sea_time.
- **M8:** §3.3, §6.2 — reports queue sort prioritises `safety_concern` via categorical priority + index.
- **M9:** §10 — rollback for `00099` explicitly drops `support_messages` from realtime publication.
- **M10:** §10 — rollback ordering for `aggregate_type` CHECK includes `DELETE FROM events` for affected aggregate_type before CHECK revert.
- **M11:** §2.4, §5.2 — metrics endpoint cached 60s server-side.
- **M12:** §2.6, §10 — `last_event_at` backfill explicitly marked as one-shot acceptable at launch scale.

**Low / polish:**

- **L1:** §3.3 — `'impersonation'` and `'duplicate_account'` added to report categories.
- **L2:** §6.2 — report detail is inline panel (decided).
- **L3:** §6.2 — `STALE_ENGAGEMENT_DAYS` constant at file top.
- **L4:** §3.3, §9 — `'warned'` semantics documented (informal, internal only).
- **L5:** §4.3 — `/blocked` page content specified.
- **L6:** §6.2 — `/admin/canonical` is add + edit only, no delete in V1.

**New content:**

- §0 — Phase 0 prerequisites section
- §2.7 — cascade architecture decision
- §2.8 — scrub vs purge distinction
- §3.8 — full API-layer event sequence with code samples
- §3.9 — messages RLS tightening
- §3.10 — admin_delete_person extension plan
- §3.11 — FK ON DELETE policy table
- §4.6 — admin self-protection
- §13 — open questions list

---

**End of spec v2.**
