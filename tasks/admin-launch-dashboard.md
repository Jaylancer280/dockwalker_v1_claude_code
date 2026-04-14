# Admin Launch Dashboard — V1 Spec

> Lean admin dashboard for launch. Visibility, moderation, support, and user cleanup.
> For the full-featured admin spec (reporting system, intelligence layer, anomaly detection), see `tasks/admin-dashboard-spec.md`.
>
> **Baseline:** Stage 208 (current) — admin API-only tooling from Stage 103, plus `admin_delete_person` RPC (00095)
> **Design:** Functional, dense, desktop-only. No decorative UI.
>
> **Isolation principle:** Zero contamination to existing app. See §Isolation Decisions below.

## Progress Tracker

| Phase                                  | Status      | Notes                               |
| -------------------------------------- | ----------- | ----------------------------------- |
| Phase 0 — Fix admin auth               | NOT STARTED | requireAdmin broken, no proxy guard |
| Phase 1 — Blocking + user deletion fix | NOT STARTED | Migration, cascade, enforcement     |
| Phase 2 — Dashboard UI                 | NOT STARTED | Layout, all pages, action panels    |
| Phase 3 — Support channel              | NOT STARTED | User-facing contact, admin inbox    |

---

## What Exists Today

| Capability          | Route                                        | Status                                                               |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| User list + search  | `GET /api/admin/users`                       | Working (if admin check bypassed)                                    |
| User detail         | `GET /api/admin/users/:personId`             | Working                                                              |
| User delete         | `DELETE /api/admin/users/:personId`          | **Broken** — Supabase `auth.admin.deleteUser` fails due to FK chains |
| Stuck engagements   | `GET /api/admin/engagements`                 | Working                                                              |
| Force-complete      | `POST /api/admin/engagements/:id/complete`   | Working                                                              |
| Canonical data CRUD | `GET/POST/PATCH /api/admin/canonical/:table` | Working                                                              |
| Auth guard          | `requireAdmin()`                             | **Broken** — header fast path hardcodes `is_admin: false`            |

**`admin_delete_person` RPC** (migration 00095): exists as service-role-only function. Deletes in FK order including events. Works from SQL but not exposed correctly via the API route.

**Not built:** blocking, dashboard UI, support channel, event browser, metrics overview, proxy guard for `/admin/*`.

---

## Isolation Decisions

Zero contamination to the existing web app. Every change is either additive (new files/routes) or a no-op for existing users.

| Shared file                    | Change                                                              | Why it's safe                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `require-admin.ts`             | Rewrite to DB-check `is_admin`                                      | Only called by `/api/admin/*` routes — no non-admin route uses it                                                                                                   |
| `require-domain-user.ts`       | **NOT TOUCHED**                                                     | Blocked check uses a new standalone guard instead                                                                                                                   |
| `middleware.ts`                | Additive `if` block for `/admin/*` redirect + blocked user redirect | Admin guard: no existing route starts with `/admin`. Blocked guard: no current user has `blocked_at` set, so the block is a no-op for the entire existing userbase. |
| `apply_projection` (migration) | New `ADMIN.*` event handlers + `last_event_at` write                | New handlers only fire on new event types that don't exist yet. `last_event_at` is an additive UPDATE after the CASE block. Existing handlers untouched.            |
| Messages INSERT RLS            | **NOT CHANGED**                                                     | Deferred to future hardening pass. Chat UI already disables input on cancelled engagements.                                                                         |
| Admin UI (`(admin)/admin/`)    | Entirely new route group                                            | No overlap with existing routes                                                                                                                                     |
| Admin API (`/api/admin/`)      | Already isolated                                                    | Existing routes updated, new routes added — all behind `requireAdmin()`                                                                                             |

---

## Phase 0 — Fix Admin Auth

### 0.1 Fix `requireAdmin`

**Problem:** `require-domain-user.ts` line 37 hardcodes `is_admin: false` in the header fast path. Since the JWT hook (migration 00078) populates middleware headers on every request, the fast path always fires. Every admin route gets 403.

**Fix:** Rewrite `require-admin.ts` to always DB-check `is_admin`:

```typescript
// lib/auth/require-admin.ts
import { NextResponse } from 'next/server';
import { requireDomainUser, type DomainUser } from './require-domain-user';

type AdminGuardResult = { ok: true; value: DomainUser } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard;

  const { data, error } = await guard.value.supabase
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

  guard.value.person.is_admin = true;
  return guard;
}
```

Admin traffic is low volume — one extra query is fine.

### 0.2 Proxy guard for `/admin/*`

Non-admins can currently render admin page scaffolding before client-side guards run.

**Fix:** Extend `lib/supabase/middleware.ts` `updateSession()`:

```typescript
// After existing deactivation/onboarding checks:
if (path.startsWith('/admin')) {
  // Check is_admin from JWT claims — best effort at the edge.
  // The real gate is requireAdmin() in every API route.
  const isAdmin = appMeta?.is_admin === true;
  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
}
```

This relies on the existing JWT hook's `is_admin` claim. If the claim isn't present (older session), the redirect fires — safe default.

### 0.3 Acceptance criteria

- `GET /api/admin/users` responds 200 for an admin user
- `GET /api/admin/users` responds 403 for a non-admin user
- Navigating to `/admin` as a non-admin redirects to `/`

---

## Phase 1 — Blocking + User Deletion Fix

### 1.1 Migration: `blocked_at` + `last_event_at` + new event handlers

Single migration file. Changes:

**Schema:**

- Add `blocked_at timestamptz` to `persons`
- Add `last_event_at timestamptz` to `persons`
- Backfill: `UPDATE persons SET last_event_at = (SELECT MAX(created_at) FROM events WHERE person_id = persons.id)`
- Extend `active_engagements.cancelled_by` CHECK to include `'admin'`

**apply_projection updates:**

- `ADMIN.USER_BLOCKED` — sets `persons.blocked_at = now()`
- `ADMIN.USER_UNBLOCKED` — clears `persons.blocked_at = NULL`
- `ADMIN.ENGAGEMENT_CANCELLED` — cancels engagement, updates applications + posting status, inserts system message (daywork + permanent branches)
- `ADMIN.POSTING_HIDDEN` — sets daywork/permanent posting status to `'cancelled'`
- `last_event_at = now()` write at end of every event case where `p_person_id IS NOT NULL`

### 1.2 Blocking enforcement (isolated — zero contamination)

**`requireDomainUser` is NOT touched.** Instead:

**New standalone guard: `checkNotBlocked(personId, supabase)`** in `lib/auth/check-not-blocked.ts`. A simple function that queries `persons.blocked_at` and returns `{ blocked: boolean }`. Called only from:

- The new admin block/unblock/delete routes (to prevent acting on self)
- `middleware.ts` blocked redirect (additive `if` block)

**Middleware addition:** A single additive `if` block in `updateSession()` that checks `blocked_at` via a lightweight DB query when the user has a session. This block only fires for users who have been blocked — no current user has `blocked_at` set, so it's a no-op for the entire existing userbase. Blocked users are redirected to `/blocked`.

**Wiring into all routes (deferred):** Once blocking is validated in production, a follow-up step adds the blocked check to `requireDomainUser` for full enforcement. This is a separate, small change — not part of the launch dashboard build.

**`/blocked` page:** Simple static page — "Your account is suspended. For urgent issues, email support@dockwalker.com." The email fallback works until WhatsApp or in-app support is available.

**Messages INSERT RLS: NOT changed.** The existing chat UI already disables input on cancelled engagements. RLS tightening is defense-in-depth for a future hardening pass.

### 1.3 Block API route

`POST /api/admin/users/:personId/block`

Body: `{ reason_category, reason_text }`

Reason categories: `harassment`, `fraud`, `safety_concern`, `spam`, `impersonation`, `other`

**Cascade logic (API-layer, not projection):**

1. Query active engagements where user is crew or employer
2. Query pending applications (`status IN ('applied', 'viewed', 'shortlisted')`)
3. Query active postings (daywork + permanent) owned by user
4. Query future availability windows

Build event batch via `append_events_batch`:

- `ADMIN.USER_BLOCKED` (first — sets `blocked_at`)
- One `ADMIN.ENGAGEMENT_CANCELLED` per active engagement
- One `ADMIN.POSTING_HIDDEN` per active posting
- One `AVAILABILITY.SET` (not_available) if future availability exists

Pending applications withdrawn via direct update (no individual events needed).

Unread notifications cleared via direct delete.

**Guards:** Self-block rejected (400). Admin-on-admin rejected (400).

### 1.4 Unblock API route

`POST /api/admin/users/:personId/unblock`

Body: `{ reason_text }`

Emits `ADMIN.USER_UNBLOCKED`. Does NOT restore cascaded state — user starts fresh.

### 1.5 Fix user deletion

**Replace** `DELETE /api/admin/users/:personId`:

Old behavior: calls `admin_delete_person` RPC then `auth.admin.deleteUser` — fails because FK chains break.

New behavior:

1. Emit `PERSON.DATA_SCRUBBED` + `PERSON.DEACTIVATED` via `append_events_batch`
2. Ban auth row: `auth.admin.updateUserById(id, { ban_duration: '876000h' })` (~100 years)
3. Do NOT call `admin_delete_person` — event rows preserved for audit

The existing `PERSON.DATA_SCRUBBED` handler (migration 00081) already scrubs profiles + advisor data. The `admin_delete_person` RPC stays available via Supabase SQL editor for manual test-user cleanup.

Self-deletion prevented. Admin-deletion prevented.

### 1.6 Phase 1 tests

- Block/unblock happy path
- Cascade: engagements cancelled (`cancelled_by = 'admin'`), applications withdrawn, postings cancelled, availability cleared, system messages inserted
- Permanent engagement cascade (separate test)
- Auth guard rejects blocked user on domain routes
- Unblock does not restore cascaded state
- Self-block and admin-on-admin block rejected (400)
- Delete (scrub): emits batched events, bans auth row, event rows preserved
- `last_event_at` updated on event append

---

## Phase 2 — Dashboard UI

### 2.1 Layout

Route group: `apps/web/src/app/(admin)/admin/`

Sidebar nav (fixed left):

```
Overview        /admin
Users           /admin/users
Engagements     /admin/engagements
Postings        /admin/postings
Support         /admin/support        (Phase 3)
Events          /admin/events
Canonical       /admin/canonical
```

**Guards (three layers):**

1. `proxy.ts` redirects non-admins (Phase 0)
2. `layout.tsx` Server Component calls `requireAdmin()` and `redirect('/')` on failure
3. Every admin API route calls `requireAdmin()`

No bottom nav. No mobile optimization.

### 2.2 New API routes for dashboard pages

| Route                                     | Method | Purpose                                                                      |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `/api/admin/users/:personId/events`       | GET    | User's complete event timeline. Paginated, filterable by event type.         |
| `/api/admin/users/:personId/engagements`  | GET    | All engagements for user (crew + employer side).                             |
| `/api/admin/users/:personId/postings`     | GET    | All daywork + permanent postings by user.                                    |
| `/api/admin/users/:personId/applications` | GET    | All applications by user (daywork + permanent).                              |
| `/api/admin/engagements/:id`              | GET    | Engagement detail with full message history (service-client bypasses RLS).   |
| `/api/admin/postings`                     | GET    | All postings. Filterable by type, status, date, poster.                      |
| `/api/admin/metrics`                      | GET    | Overview counts. Cached 60s server-side.                                     |
| `/api/admin/events`                       | GET    | Raw event log. Paginated, filterable by type, person, aggregate, date range. |

**Update existing routes:**

- `GET /api/admin/users` — add `blocked` filter, return `blocked_at` + `last_event_at`
- `GET /api/admin/users/:personId` — include `blocked_at`, `last_event_at`
- `GET /api/admin/engagements` — extend with status/date/person/type filters (not just stuck-only)

### 2.3 Pages

#### `/admin` — Overview

Metric grid (query-time counts, cached 60s):

| Metric                    | Query                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| Total users               | `COUNT(*) FROM persons WHERE deactivated_at IS NULL`                    |
| Active users (7d)         | `COUNT(*) FROM persons WHERE last_event_at > now() - interval '7 days'` |
| New signups (7d)          | `COUNT(*) FROM persons WHERE created_at > now() - interval '7 days'`    |
| Blocked users             | `COUNT(*) FROM persons WHERE blocked_at IS NOT NULL`                    |
| Active daywork postings   | `COUNT(*) FROM dayworks WHERE status = 'active'`                        |
| Active permanent postings | `COUNT(*) FROM permanent_postings WHERE status = 'active'`              |
| In-progress engagements   | `COUNT(*) FROM active_engagements WHERE status = 'active'`              |
| Open support threads      | `COUNT(*) FROM support_threads WHERE status = 'open'` (Phase 3)         |

Below: stale engagements table (active > 14 days).

#### `/admin/users` — User List

**Filters:** identity type, current hat, blocked/active/all, port, text search
**Sort:** last active (default), created date, display name
**Columns:** Display name | Type | Hat | Port | Created | Last active | Status | →

Click row → `/admin/users/:personId`

#### `/admin/users/:personId` — User Detail

**Header:** Display name, identity type, hat, status badge (active/blocked/deactivated), created, last active.

**Action bar:**

- Block / Unblock button (with confirmation dialog showing cascade preview: "X engagements, Y applications, Z postings will be cancelled")
- Delete User button (confirmation: "This removes PII and bans login. Cannot be undone from the UI.")
- Open support thread button (Phase 3)

**Sections (vertical stack):**

1. **Profile** — all profile fields, read-only
2. **Engagements** — all engagements (crew + employer side). Columns: counterparty, job, dates, status, type. Link to detail.
3. **Postings** — all daywork + permanent. Columns: type, role, port, dates, status, app count.
4. **Applications** — all applications (daywork + permanent). Columns: job, status, date.
5. **Event Timeline** — complete event history. Filterable by type. Paginated 50/page. Most recent first.

#### `/admin/engagements` — Engagement List

**Filters:** status, type (daywork/permanent), date range, person search
**Columns:** Crew | Employer | Job # | Type | Dates | Status | Days active | →

Click row → `/admin/engagements/:id`

#### `/admin/engagements/:id` — Engagement Detail

**Header:** Status badge, job reference, type, dates.
**Action bar:** Force-complete (daywork, active only), Force-cancel (active only).

**Sections:**

1. Parties — crew + employer (links to user detail)
2. Job details — role, vessel, port, rate/salary, dates, positions
3. Messages — full chat history, read-only
4. Ratings — if rated, show both sides

#### `/admin/postings` — Postings List

**Filters:** type, status, date range, poster search
**Columns:** Job # | Type | Role | Port | Dates | Status | Applications | Poster | →

#### `/admin/events` — Event Log Browser

**Filters:** event type, person_id, aggregate_type, date range
**Pagination:** cursor-based, 50/page
**Columns:** Timestamp | Event type | Person | Aggregate | Payload (truncated, expandable)

Click row → expand full payload JSON.

#### `/admin/canonical` — Reference Data

Tabs for each table (regions, cities, ports, yacht_roles, certifications, experience_brackets, vessel_size_bands).
Add + edit only. No delete in V1.

---

## Phase 3 — Support Channel

### 3.1 Migration

New tables:

**`support_threads`** — `id, person_id (FK persons), subject, status ('open'|'closed'), is_admin_initiated, created_at, updated_at`

RLS: authenticated users SELECT/INSERT own threads. Admin via service client.

**`support_messages`** — `id, thread_id (FK support_threads ON DELETE CASCADE), sender_person_id (FK persons ON DELETE SET NULL), is_platform boolean, content (max 4000), created_at`

RLS: thread participants can SELECT. No INSERT policy for authenticated — all inserts via API with service client.

Add `support_messages` to Supabase Realtime publication.

Add `'support'` to `events.aggregate_type` CHECK constraint.

Add `SUPPORT.THREAD_OPENED` and `SUPPORT.MESSAGE_SENT` audit no-op handlers to `apply_projection`.

### 3.2 User-facing routes

All with `{ allowBlocked: true }` so blocked users can still contact support.

| Route                    | Method | Purpose                                                         |
| ------------------------ | ------ | --------------------------------------------------------------- |
| `/api/support`           | GET    | List own threads                                                |
| `/api/support`           | POST   | Open thread. Body: `{ subject?, content }`. Max 3 open threads. |
| `/api/support/:threadId` | GET    | Thread messages (own threads only)                              |
| `/api/support/:threadId` | POST   | Send message. Body: `{ content }`                               |

### 3.3 Admin routes

| Route                                | Method | Purpose                                                                                      |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| `/api/admin/support`                 | GET    | All threads. Filter by status. Sort by updated_at DESC.                                      |
| `/api/admin/support/:threadId`       | GET    | Thread messages                                                                              |
| `/api/admin/support/:threadId`       | POST   | Reply as DockWalker. Body: `{ content }`. Sets `is_platform = true`.                         |
| `/api/admin/support/:threadId/close` | POST   | Close thread                                                                                 |
| `/api/admin/support/initiate`        | POST   | Open thread for a user. Body: `{ person_id, subject, content }`. Push + in-app notification. |

### 3.4 User-facing UI

**Entry points:**

- Settings page: "Contact DockWalker" row → `/support`
- Blocked page: "Contact support" link → `/support` (replaces email fallback)

**`/support` page:** Thread list + "New message" button. Click thread → chat view. User messages right, DockWalker messages left.

### 3.5 Admin UI

Wire into dashboard sidebar. `/admin/support` shows inbox. `/admin/support/:threadId` shows chat with "Send as DockWalker" input and "Close thread" button. User info sidebar with link to user detail.

### 3.6 Update `/blocked` page

Replace `mailto:` fallback with link to `/support`.

### 3.7 Update `admin_delete_person` RPC

Extend to cover `support_threads`, `support_messages` in FK-order deletion for manual test-user cleanup.

---

## Migration Summary

| Phase | Migration                       | Content                                                                                           |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0     | None (code-only)                | Fix requireAdmin, add proxy guard                                                                 |
| 1     | `00097_admin_blocking.sql`      | `blocked_at`, `last_event_at`, `cancelled_by` CHECK, new event handlers, `last_event_at` backfill |
| 2     | None (code-only)                | Dashboard UI + new API routes                                                                     |
| 3     | `00098_support_channel.sql`     | `support_threads`, `support_messages`, RLS, Realtime, `aggregate_type` CHECK, audit handlers      |
| 3     | `00099_extend_admin_delete.sql` | Extend `admin_delete_person` for support tables                                                   |

Migration numbers are provisional — adjust to actual sequence at build time.

**Deployment:** `npx supabase db push` per project memory (no local Docker).

---

## Explicitly Not in V1

See `tasks/admin-dashboard-spec.md` for the full spec. Cut from launch:

- **Reports system** — users reporting other users. At launch scale, users message admin directly via support.
- **User notes** — admin can track via support threads or external notes.
- **JWT hook extension for `blocked_at`** — enforce blocking at API layer with DB check. JWT optimization is Phase 7.
- **Posting hide as standalone action** — blocking cascades postings. Manual hide via SQL if needed.
- **Materialized metrics** — query-time counts + 60s cache is fine at launch scale.
- **Automated anomaly detection** — no population baselines yet.
- **Time-limited suspensions** — admin unblocks manually.
- **Bulk actions** — one-at-a-time for 1-2 admins.
- **Device fingerprinting** — deferred.
- **Automatic Stripe cancellation on block** — admin handles manually.

---

## Decisions

1. **Scrub + auth row:** Ban (`ban_duration: '876000h'`). Preserves FK chains. Hard-delete is what exists today and is broken.
2. **Blocked user contact:** Email fallback (`mailto:support@dockwalker.com`) on `/blocked` page until WhatsApp notification API is sorted. In-app support channel (Phase 3) ships when ready but is not a blocker for Phases 0-2.
