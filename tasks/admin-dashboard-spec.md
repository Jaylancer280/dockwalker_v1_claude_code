# DockWalker Admin Dashboard — Feature Specification

> Implementation blueprint for the admin dashboard, user moderation, support channel, and platform health tooling.
> This document contains concrete decisions, not options. Follow it exactly.
>
> **Baseline:** Stage 205 (current) — admin API-only tooling from Stage 103
> **Admin screens:** Web-only — no admin routes in the mobile app
> **Design principle:** Functional and efficient, not pretty. Dense tables, click-through detail views, sidebar nav. Zero decorative UI.

## Progress Tracker

> Updated by the planning agent at the end of each session. A fresh agent reads this first.

| Phase                                | Status      | Notes                                                     |
| ------------------------------------ | ----------- | --------------------------------------------------------- |
| Phase 1 — Blocking + user moderation | NOT STARTED | Migration, events, cascade, enforcement, API routes       |
| Phase 2 — Reporting system           | NOT STARTED | Reports table, user-facing report flow, admin queue       |
| Phase 3 — Support channel            | NOT STARTED | Support threads + messages, user feedback, admin inbox    |
| Phase 4 — Admin dashboard UI         | NOT STARTED | Layout, pages, all read views, action panels              |
| Phase 5 — Platform health metrics    | NOT STARTED | Query-time aggregations, dashboard landing page           |
| Phase 6 — Event log browser          | NOT STARTED | Filterable raw event view, power-user tool                |
| Phase 7 — Intelligence layer (V2)    | NOT STARTED | Materialized metrics, anomaly detection, automated alerts |

**Last session:** N/A — spec created

---

## 1. What Exists Today (Stage 103)

Built in Stages 103-106. API-only, no frontend pages.

| Capability          | Route                                        | Notes                                          |
| ------------------- | -------------------------------------------- | ---------------------------------------------- |
| User list + search  | `GET /api/admin/users`                       | Paginated, search by name, filter by port      |
| User detail         | `GET /api/admin/users/:personId`             | Profile, subscription, event count             |
| Stuck engagements   | `GET /api/admin/engagements`                 | Finds active engagements older than N days     |
| Force-complete      | `POST /api/admin/engagements/:id/complete`   | Emits `ADMIN.ENGAGEMENT_COMPLETED`             |
| Canonical data CRUD | `GET/POST/PATCH /api/admin/canonical/:table` | 7 whitelisted reference tables                 |
| Auth guard          | `requireAdmin()`                             | Checks `persons.is_admin` per-request (no JWT) |

**Not built:** blocking, reporting, support channel, admin UI, metrics, event browser, force-cancel, posting moderation, admin notes, message visibility, last-active tracking.

---

## 2. Architecture Decisions

### 2.1 Blocking vs Deactivation

Two distinct mechanisms. Both set a timestamp on `persons`. They are independent and non-overlapping.

| Mechanism        | Initiated by | Reversible | Purpose                      | Column           |
| ---------------- | ------------ | ---------- | ---------------------------- | ---------------- |
| **Blocking**     | Admin        | Yes        | Abuse/safety enforcement     | `blocked_at`     |
| **Deactivation** | User         | No         | Account deletion (GDPR path) | `deactivated_at` |

Blocking is event-sourced (`ADMIN.USER_BLOCKED`, `ADMIN.USER_UNBLOCKED`). Deactivation remains as-is (`PERSON.DEACTIVATED`).

### 2.2 Reports Table — CRUD, Not Event-Sourced

Reports are operational workflow data (like templates, preferences, device tokens). They are not domain state. A report being "open" or "dismissed" is admin workflow, not a user's domain state. CRUD table with RLS, not in the event ledger.

The _action taken_ on a report (blocking a user) IS event-sourced via `ADMIN.USER_BLOCKED`.

### 2.3 Support Channel — Separate Tables

Support threads and messages live in their own tables, not in the engagement-scoped `messages` table. Reasons:

- `messages.engagement_id` is `NOT NULL` and FK-constrained — support has no engagement
- Support conversations have different lifecycle (no acceptance gate, no ratings phase)
- Admin sees all threads; engagement messages are participant-scoped
- Reusing the same Realtime subscription pattern is trivial without sharing the table

Support events (`SUPPORT.THREAD_OPENED`, `SUPPORT.MESSAGE_SENT`) go to the event ledger for audit. The tables are CRUD for operational data.

### 2.4 Metrics — Query-Time for V1

At launch scale (hundreds of users, thousands of events), all metrics are computed at query time from existing projection tables and the events table. No materialized views, no summary tables, no background jobs.

When query-time gets slow (tens of thousands of events), introduce materialized views (Phase 7).

### 2.5 Admin UI — Server Components + Minimal Client

Admin pages are Next.js server components where possible. No SWR, no client-side data fetching unless required for interactivity (action dialogs, filters). Dense HTML tables, not card grids. Functional forms, not polished UI.

Admin layout lives under `apps/web/src/app/(admin)/admin/` — a separate route group from the main app `(app)` group. Shares the same auth but has its own sidebar layout.

### 2.6 Last-Active Tracking

Add `last_event_at` column to `persons`. Updated by `apply_projection` on every event for the acting `person_id`. Cheap write, enables sorting and filtering users by activity without scanning the events table.

---

## 3. Database Schema Changes

### 3.1 New Column: `persons.blocked_at`

```sql
ALTER TABLE public.persons ADD COLUMN blocked_at timestamptz;
```

Nullable. Set by `ADMIN.USER_BLOCKED` projection, cleared by `ADMIN.USER_UNBLOCKED` projection.

### 3.2 New Column: `persons.last_event_at`

```sql
ALTER TABLE public.persons ADD COLUMN last_event_at timestamptz;
```

Updated by `apply_projection` on every event where `p_person_id` is not null.

### 3.3 New Table: `reports`

```sql
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_person_id uuid NOT NULL REFERENCES public.persons(id),
  reported_person_id uuid NOT NULL REFERENCES public.persons(id),
  engagement_id uuid REFERENCES public.active_engagements(id),
  reason_category text NOT NULL CHECK (reason_category IN (
    'harassment', 'fraud', 'inappropriate_content',
    'safety_concern', 'spam', 'other'
  )),
  reason_text text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'reviewing', 'dismissed', 'actioned'
  )),
  admin_person_id uuid REFERENCES public.persons(id),
  admin_notes text,
  resolution text CHECK (resolution IN ('dismissed', 'warned', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_reported ON public.reports(reported_person_id);
```

RLS: authenticated users can INSERT (reporter_person_id = auth.uid()). Authenticated users can SELECT own reports (reporter_person_id = auth.uid()). Admin access via service client.

### 3.4 New Table: `user_notes`

```sql
CREATE TABLE public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.persons(id),
  admin_person_id uuid NOT NULL REFERENCES public.persons(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_notes_person ON public.user_notes(person_id);
```

RLS: no user access. Admin-only via service client.

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

RLS: authenticated users can SELECT/INSERT where person_id = auth.uid(). Admin access via service client.

### 3.6 New Table: `support_messages`

```sql
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id),
  sender_person_id uuid REFERENCES public.persons(id),
  is_platform boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_thread ON public.support_messages(thread_id);
```

`sender_person_id` is the actual person who sent the message. `is_platform` indicates whether it displays as "DockWalker" (true) or shows the user's name (false). When admin sends as DockWalker: `sender_person_id = admin's person_id`, `is_platform = true`. When user sends: `sender_person_id = user's person_id`, `is_platform = false`.

RLS: thread participants can SELECT. INSERT via service client only (routed through API).

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;`

### 3.7 New Events

Update the `events` table `aggregate_type` CHECK constraint to include `'support'`.

| Event                        | Aggregate Type | Payload                                                        | Projection                                          |
| ---------------------------- | -------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `ADMIN.USER_BLOCKED`         | `admin`        | `{ person_id, reason_category, reason_text, admin_person_id }` | Set `persons.blocked_at = now()`, cascade (see 3.8) |
| `ADMIN.USER_UNBLOCKED`       | `admin`        | `{ person_id, reason_text, admin_person_id }`                  | Clear `persons.blocked_at = NULL`                   |
| `ADMIN.ENGAGEMENT_CANCELLED` | `admin`        | `{ engagement_id, daywork_id, reason, admin_person_id }`       | Set engagement + daywork status, system messages    |
| `SUPPORT.THREAD_OPENED`      | `support`      | `{ thread_id, person_id, subject, is_admin_initiated }`        | Audit no-op (thread created via CRUD)               |
| `SUPPORT.MESSAGE_SENT`       | `support`      | `{ message_id, thread_id, sender_person_id, is_platform }`     | Audit no-op (message created via CRUD)              |

### 3.8 Blocking Cascade — What `ADMIN.USER_BLOCKED` Projection Does

The projection handler for `ADMIN.USER_BLOCKED` must perform these steps atomically:

1. **Set `persons.blocked_at`** = `now()`
2. **Cancel active engagements** where blocked person is `crew_person_id` or `employer_person_id`:
   - Set `active_engagements.status = 'cancelled'`
   - Set `cancelled_by = 'employer'` (system-initiated, treated as employer-side for flow purposes)
   - Set `cancellation_reason_category = 'other'`
   - Set `cancellation_reason_text = 'Account suspended by DockWalker'`
   - Insert system message into `messages`: "This engagement has been cancelled by DockWalker."
3. **Withdraw pending applications** where blocked person is `crew_person_id`:
   - Set `applications.status = 'withdrawn'` for statuses in (`applied`, `viewed`, `shortlisted`)
4. **Hide active postings** where blocked person is `poster_person_id` (daywork) or `employer_person_id` (permanent):
   - Set `dayworks.status = 'cancelled'` for active/in_progress dayworks
   - Set `permanent_postings.status = 'cancelled'` for active/in_negotiation postings
5. **Clear availability** where blocked person has active availability windows:
   - Delete from `availability_windows` where `person_id` = blocked person
6. **Close permanent selections** where blocked person is selected candidate:
   - Revert any `selected` status applications to `shortlisted`

`ADMIN.USER_UNBLOCKED` only clears `blocked_at`. It does NOT restore cancelled engagements, withdrawn applications, or cancelled postings. Those are gone. The user starts fresh.

---

## 4. Enforcement Points — Where Blocking Takes Effect

### 4.1 Auth Guard (`requireDomainUser`)

Add `blocked_at` check alongside the existing `deactivated_at` check:

```typescript
if (person.blocked_at) {
  return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 });
}
```

This blocks ALL API actions for blocked users.

### 4.2 Middleware

Blocked users navigating the app are redirected to `/blocked` — a static page explaining the suspension with a "Contact support" link (which opens a support thread if the support channel is built, or shows an email address).

### 4.3 Discovery Feeds

No explicit exclusion needed in discover queries. Blocked users can't reach the discover API (auth guard rejects them). Their postings are cancelled by the cascade (Section 3.8), so they won't appear in feeds.

### 4.4 Realtime

Blocked users' existing Realtime subscriptions are not forcibly disconnected. Their Supabase JWT remains valid until expiry. But they can't send messages (API guard blocks POST), and the cascade has already cancelled their engagements. On next page load, middleware redirects to `/blocked`.

---

## 5. API Routes

### 5.1 Existing Routes — No Changes

| Route                                        | Notes                                                  |
| -------------------------------------------- | ------------------------------------------------------ |
| `GET /api/admin/users`                       | Keep as-is. Add `blocked` filter param.                |
| `GET /api/admin/users/:personId`             | Keep as-is. Add blocked_at, last_event_at to response. |
| `POST /api/admin/engagements/:id/complete`   | Keep as-is.                                            |
| `GET/POST/PATCH /api/admin/canonical/:table` | Keep as-is.                                            |

### 5.2 New Admin Routes

| Route                                     | Method | Purpose                                                                                                                                                     |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/admin/users/:personId`              | DELETE | Hard-delete user. Calls `admin_delete_person` RPC (cleans all child data in FK order), then `auth.admin.deleteUser`. Irreversible. Self-deletion prevented. |
| `/api/admin/users/:personId/block`        | POST   | Block user. Body: `{ reason_category, reason_text }`. Emits `ADMIN.USER_BLOCKED`.                                                                           |
| `/api/admin/users/:personId/unblock`      | POST   | Unblock user. Body: `{ reason_text }`. Emits `ADMIN.USER_UNBLOCKED`.                                                                                        |
| `/api/admin/users/:personId/notes`        | GET    | List admin notes for user.                                                                                                                                  |
| `/api/admin/users/:personId/notes`        | POST   | Add admin note. Body: `{ content }`.                                                                                                                        |
| `/api/admin/users/:personId/events`       | GET    | User's complete event timeline. Paginated, filterable by event type.                                                                                        |
| `/api/admin/users/:personId/engagements`  | GET    | All engagements (active + historical) for user.                                                                                                             |
| `/api/admin/users/:personId/postings`     | GET    | All daywork + permanent postings by user.                                                                                                                   |
| `/api/admin/users/:personId/applications` | GET    | All applications by user (daywork + permanent).                                                                                                             |
| `/api/admin/engagements`                  | GET    | **Extend existing.** Add filters: status, date range, person_id. Remove stuck-only constraint.                                                              |
| `/api/admin/engagements/:id`              | GET    | Engagement detail with full message history.                                                                                                                |
| `/api/admin/engagements/:id/cancel`       | POST   | Force-cancel engagement. Body: `{ reason }`. Emits `ADMIN.ENGAGEMENT_CANCELLED`.                                                                            |
| `/api/admin/postings`                     | GET    | All postings (daywork + permanent). Filterable by type, status, date, poster.                                                                               |
| `/api/admin/postings/:id/hide`            | POST   | Hide a posting from discovery. Body: `{ reason }`. Sets status to `cancelled`.                                                                              |
| `/api/admin/reports`                      | GET    | Report queue. Filterable by status. Sorted by created_at DESC.                                                                                              |
| `/api/admin/reports/:id`                  | GET    | Report detail with reporter + reported user context.                                                                                                        |
| `/api/admin/reports/:id`                  | PATCH  | Update report. Body: `{ status, admin_notes, resolution }`.                                                                                                 |
| `/api/admin/support`                      | GET    | All support threads. Filterable by status. Sorted by updated_at DESC.                                                                                       |
| `/api/admin/support/:threadId`            | GET    | Thread messages.                                                                                                                                            |
| `/api/admin/support/:threadId`            | POST   | Send message as DockWalker. Body: `{ content }`.                                                                                                            |
| `/api/admin/support/:threadId/close`      | POST   | Close thread.                                                                                                                                               |
| `/api/admin/support/initiate`             | POST   | Admin opens thread for a user. Body: `{ person_id, subject, content }`.                                                                                     |
| `/api/admin/metrics`                      | GET    | Platform health summary (computed at query time).                                                                                                           |
| `/api/admin/events`                       | GET    | Raw event log. Paginated, filterable by type, person, aggregate, date range.                                                                                |

### 5.3 New User-Facing Routes

| Route                    | Method | Purpose                                                                                        |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `/api/reports`           | POST   | Submit a report. Body: `{ reported_person_id, engagement_id?, reason_category, reason_text }`. |
| `/api/reports`           | GET    | List own submitted reports.                                                                    |
| `/api/support`           | GET    | List own support threads.                                                                      |
| `/api/support`           | POST   | Open new support thread. Body: `{ subject?, content }`.                                        |
| `/api/support/:threadId` | GET    | Thread messages (own threads only).                                                            |
| `/api/support/:threadId` | POST   | Send message in own thread. Body: `{ content }`.                                               |

---

## 6. Admin Dashboard UI

### 6.1 Layout

Route group: `apps/web/src/app/(admin)/admin/`

Sidebar navigation (fixed left, collapsed on smaller screens):

```
Overview        /admin
Users           /admin/users
Reports         /admin/reports
Engagements     /admin/engagements
Postings        /admin/postings
Support         /admin/support
Events          /admin/events
Canonical       /admin/canonical
```

Badge counts on Reports (open count) and Support (open thread count).

Layout component: `AdminLayout` with sidebar + main content area. No bottom nav. No mobile optimization — admin is desktop-only.

Admin layout guard: check `is_admin` on mount, redirect non-admins to `/`.

### 6.2 Pages

#### `/admin` — Overview

Platform health numbers in a simple grid:

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

**Action items — Open reports** (most recent 5, link to full queue):
| Reporter | Reported | Category | Submitted | → |

**Action items — Stale engagements** (active > 14 days, link to full list):
| Crew | Employer | Job | Days active | → |

#### `/admin/users` — User List

Searchable, filterable table:

**Filters:** identity type, current hat, blocked/active/all, port, text search (display name)
**Sort:** last active (default), created date, display name
**Columns:** Display name | Type | Hat | Port | Created | Last active | Status | →

Click row → `/admin/users/:personId`

#### `/admin/users/:personId` — User Detail

The hub page. Everything about one user.

**Header:** Display name, identity type, hat, status (active/blocked/deactivated), created date, last active.

**Action bar:** Block/Unblock button, "Delete User" button (red, confirmation dialog — irreversible hard delete of all user data + auth record), "Add note" button, "Open support thread" button.

**Sections (vertical stack, all expanded by default):**

1. **Profile** — All profile fields. Role, certs, experience bracket, location, nationality, visas, bio, languages, availability status, avatar. Read-only.

2. **Admin Notes** — Chronological list. Each note: admin name, date, content. "Add note" form at bottom.

3. **Reports** — Reports filed against this user AND reports filed by this user (two sub-tables). Status, category, date, link to report detail.

4. **Event Timeline** — Complete event history from `events` table. Filterable by event type. Paginated. Shows: timestamp, event_type, payload summary. Most recent first.

5. **Engagements** — All engagements (crew side + employer side). Columns: counterparty, job, dates, status. Link to engagement detail.

6. **Postings** — All daywork + permanent postings. Columns: type, role, port, dates, status, application count. Link to posting detail.

7. **Applications** — All applications submitted (daywork + permanent). Columns: job, status, applied date.

8. **Support Threads** — Any support threads for this user. Link to thread.

#### `/admin/reports` — Report Queue

**Filters:** status (open/reviewing/dismissed/actioned/all)
**Sort:** created_at DESC (default)
**Columns:** Reporter | Reported | Category | Status | Submitted | →

Click row → report detail panel (can be inline expansion or separate page):

- Reporter's message (reason_text)
- Link to reported user's detail page
- Link to engagement (if engagement_id present) with message history
- Action form: status dropdown, admin notes textarea, resolution dropdown, Save button

#### `/admin/engagements` — Engagement List

**Filters:** status (active/completed/cancelled/closed/all), type (daywork/permanent), date range, person search
**Sort:** created_at DESC (default), days_active for active
**Columns:** Crew | Employer | Job # | Type | Dates | Status | Days active | →

Click row → `/admin/engagements/:id`

#### `/admin/engagements/:id` — Engagement Detail

**Header:** Status badge, job reference, type (daywork/permanent), dates.

**Action bar:** Force-complete, Force-cancel (active engagements only).

**Sections:**

1. **Parties** — Crew name (link to user detail), Employer name (link to user detail).
2. **Job Details** — Role, vessel, port, rate/salary, dates, positions.
3. **Status History** — Derived from events: accepted, work started, completed/cancelled, rated. Timeline view.
4. **Messages** — Full message history. Read-only. System messages styled differently. Admin can see everything.
5. **Ratings** — If rated, show both crew and employer ratings.

#### `/admin/postings` — Postings List

**Filters:** type (daywork/permanent), status, date range, poster search
**Columns:** Job # | Type | Role | Port | Dates | Status | Applications | Poster | →

Click row → posting detail (inline or page): full posting fields + application list.

#### `/admin/support` — Support Inbox

**Filters:** status (open/closed/all)
**Sort:** updated_at DESC
**Columns:** User | Subject | Status | Messages | Last updated | →

Click row → `/admin/support/:threadId`

#### `/admin/support/:threadId` — Support Thread

Chat-style message list. User messages on the left, DockWalker messages on the right.

**Footer:** Text input + "Send as DockWalker" button. "Close thread" button in header.

**Sidebar:** User info summary (name, type, hat, status) with link to full user detail.

#### `/admin/events` — Event Log Browser

**Filters:** event type (dropdown of all types), person_id (text input), aggregate_type, date range
**Sort:** created_at DESC
**Pagination:** cursor-based, 50 per page
**Columns:** Timestamp | Event type | Person | Aggregate | Payload (truncated, expandable)

Click row → expand to show full payload JSON.

#### `/admin/canonical` — Reference Data

Already exists as API. Build a simple UI:

Tabs for each table (regions, cities, ports, yacht_roles, certifications, experience_brackets, vessel_size_bands).

Each tab: table of all rows with an "Add" button and inline edit capability.

---

## 7. User-Facing UI for Reports and Support

### 7.1 Report Flow

**Where the report button appears:**

1. **Chat kebab menu** — "Report user" option. Pre-fills `engagement_id` and `reported_person_id` (the counterparty).
2. **Profile overlay** — "Report" link at the bottom. Pre-fills `reported_person_id`. No engagement context.

**Report dialog:** Modal with:

- Reason category dropdown (harassment, fraud, inappropriate content, safety concern, spam, other)
- Reason text textarea (required, max 1000 chars)
- Submit button

After submission: toast confirmation "Report submitted. We'll review it shortly."

No report detail view for users — they submit and move on. Admin handles it.

### 7.2 Support / Feedback Channel

**Entry points:**

1. **Settings page** — "Contact DockWalker" / "Send feedback" row. Links to `/support`.
2. **Blocked page** — "Contact support" link. Links to `/support`.
3. **Future: help icon** in the app header (deferred).

**`/support` page (user-facing):**

List of own support threads (most users will have 0-1). "New message" button to start a thread.

Click thread → chat view. User messages on right, DockWalker messages on left. Standard chat input.

**New thread flow:** Subject (optional), message content (required). Creates thread + first message.

---

## 8. Implementation Phases

### Phase 1 — Blocking + User Moderation

**Migration:**

- Add `blocked_at` and `last_event_at` to `persons`
- Update `apply_projection` with `ADMIN.USER_BLOCKED` cascade handler
- Update `apply_projection` with `ADMIN.USER_UNBLOCKED` handler
- Update `apply_projection` to set `last_event_at` on every event
- Add `ADMIN.ENGAGEMENT_CANCELLED` handler
- Extend `aggregate_type` CHECK for `'support'`
- Create `user_notes` table with RLS

**API routes:**

- `POST /api/admin/users/:personId/block`
- `POST /api/admin/users/:personId/unblock`
- `GET/POST /api/admin/users/:personId/notes`
- `POST /api/admin/engagements/:id/cancel`

**Enforcement:**

- `requireDomainUser` — add `blocked_at` check
- Middleware — redirect blocked users to `/blocked`
- `/blocked` static page

**Tests:** Block/unblock happy path, cascade verification (engagements cancelled, applications withdrawn, postings hidden, availability cleared), auth guard rejection, unblock does not restore cascaded state.

### Phase 2 — Reporting System

**Migration:**

- Create `reports` table with RLS

**API routes:**

- `POST /api/reports` (user submits report)
- `GET /api/reports` (user lists own reports)
- `GET /api/admin/reports` (admin queue)
- `GET /api/admin/reports/:id` (report detail)
- `PATCH /api/admin/reports/:id` (admin updates report)

**UI (user-facing):**

- Report button in chat kebab menu
- Report link on profile overlay
- Report submission dialog

**Tests:** Report submission, duplicate prevention (optional), admin queue filtering, report resolution flow.

### Phase 3 — Support Channel

**Migration:**

- Create `support_threads` table with RLS
- Create `support_messages` table with RLS
- Add `support_messages` to Supabase Realtime publication
- Add `SUPPORT.THREAD_OPENED` and `SUPPORT.MESSAGE_SENT` audit event handlers

**API routes:**

- User-facing: `GET/POST /api/support`, `GET/POST /api/support/:threadId`
- Admin: `GET /api/admin/support`, `GET/POST /api/admin/support/:threadId`, `POST /api/admin/support/:threadId/close`, `POST /api/admin/support/initiate`

**UI (user-facing):**

- `/support` page (thread list + chat view)
- "Contact DockWalker" entry point in settings

**Tests:** Thread creation, message send/receive, admin reply as DockWalker, thread close, Realtime subscription.

### Phase 4 — Admin Dashboard UI

No new migrations or API routes. This phase builds the frontend for everything from Phases 1-3 plus existing admin APIs.

**Layout:**

- `(admin)/admin/layout.tsx` — sidebar nav + admin guard
- `/admin` — overview page
- `/admin/users` — user list
- `/admin/users/[personId]` — user detail hub
- `/admin/reports` — report queue
- `/admin/engagements` — engagement list
- `/admin/engagements/[id]` — engagement detail with messages
- `/admin/postings` — postings list
- `/admin/support` — support inbox
- `/admin/support/[threadId]` — support thread
- `/admin/canonical` — reference data UI

**New admin API routes for the hub page:**

- `GET /api/admin/users/:personId/events`
- `GET /api/admin/users/:personId/engagements`
- `GET /api/admin/users/:personId/postings`
- `GET /api/admin/users/:personId/applications`
- `GET /api/admin/engagements/:id` (with messages)
- `GET /api/admin/postings`
- `GET /api/admin/postings/:id/hide`
- `GET /api/admin/metrics`
- `GET /api/admin/events`

### Phase 5 — Platform Health Metrics

**API:**

- `GET /api/admin/metrics` — returns all overview metrics, computed at query time

**UI:**

- Wire metrics into the `/admin` overview page
- Add action item tables (open reports, stale engagements)

### Phase 6 — Event Log Browser

**API:**

- `GET /api/admin/events` — paginated, filtered event log

**UI:**

- `/admin/events` page with filter controls and expandable payload rows

---

## 9. Explicitly Deferred (Phase 7 / V2)

These are known gaps that are not addressed in Phases 1-6. They belong in a future intelligence layer.

| Item                                            | Why deferred                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Device fingerprinting / multi-account detection | Complex, requires client-side fingerprint collection. Low priority at launch scale — niche industry, bad actors recognizable by profile data. |
| Automated anomaly detection                     | Requires population baselines that don't exist at launch. Need data first.                                                                    |
| Materialized metric views                       | Query-time is fast enough at launch scale. Introduce when event table exceeds ~50k rows.                                                      |
| Time-limited suspensions (auto-unblock)         | Admin can manually unblock. Automation is a convenience, not a necessity.                                                                     |
| Bulk admin actions                              | One-at-a-time is fine for 1-2 admins at launch scale.                                                                                         |
| GDPR data export automation                     | Manual export via SQL is acceptable initially. Automate when request volume justifies it.                                                     |
| Admin email/push alerts on new reports          | Badge counts on dashboard are sufficient when admin checks daily.                                                                             |
| Cross-engagement message search                 | Heavy feature. Admin can search per-user via the event timeline.                                                                              |
| Warning system (formal, tracked)                | Admin notes + support messages serve this purpose informally. Formalize if abuse patterns warrant structured escalation.                      |
| Cancellation rate / rating outlier flagging     | Intelligence layer. Requires materialized per-user stats and population comparison.                                                           |
| Onboarding funnel / retention metrics           | Analytics layer. Vercel Analytics covers basic page views. Cohort analysis is V2.                                                             |
| Content moderation (word filters, auto-flag)    | Manual moderation is appropriate at launch scale.                                                                                             |

---

## 10. Migration Checklist

Single migration file covering Phase 1-3 schema changes. Can be split if phases ship separately.

- [ ] Add `blocked_at timestamptz` to `persons`
- [ ] Add `last_event_at timestamptz` to `persons`
- [ ] Create `reports` table with indexes
- [ ] Create `user_notes` table with indexes
- [ ] Create `support_threads` table with indexes
- [ ] Create `support_messages` table with indexes
- [ ] RLS policies for all new tables
- [ ] Add `support_messages` to Supabase Realtime publication
- [ ] Extend `aggregate_type` CHECK to include `'support'`
- [ ] Update `apply_projection`: `ADMIN.USER_BLOCKED` with cascade
- [ ] Update `apply_projection`: `ADMIN.USER_UNBLOCKED`
- [ ] Update `apply_projection`: `ADMIN.ENGAGEMENT_CANCELLED`
- [ ] Update `apply_projection`: `SUPPORT.THREAD_OPENED` (audit no-op)
- [ ] Update `apply_projection`: `SUPPORT.MESSAGE_SENT` (audit no-op)
- [ ] Update `apply_projection`: set `last_event_at` on every event
- [ ] Backfill `last_event_at` from existing events (`UPDATE persons SET last_event_at = (SELECT MAX(created_at) FROM events WHERE person_id = persons.id)`)
- [ ] Rollback file (drops tables, removes columns, restores previous `apply_projection`)

---

## 11. Test Plan

### API Tests (Vitest)

**Phase 1:**

- Delete user: happy path (RPC + auth delete), non-admin 403, self-deletion 400, user not found 404, RPC failure 500, auth delete failure 500
- Block user: happy path, non-admin 403, already-blocked idempotency
- Block cascade: active engagements cancelled, pending applications withdrawn, active postings cancelled, availability cleared
- Unblock user: happy path, does not restore cascaded state
- Auth guard: blocked user gets 403 on all domain routes
- Force-cancel engagement: happy path, non-active engagement rejection
- Admin notes: CRUD
- `last_event_at` updated on event append

**Phase 2:**

- Submit report: happy path, missing fields 400, self-report prevention
- Admin report queue: filters, pagination
- Admin report update: status transitions, resolution values

**Phase 3:**

- Create support thread: happy path
- Send message: user and admin
- Thread close: only admin
- Admin initiate thread: creates thread + first message
- Own-thread-only access: user can't read other users' threads

**Phase 4-6:**

- Metrics endpoint: returns expected counts
- Events endpoint: pagination, filtering
- Postings endpoint: type/status filters

---

## 12. Relationship to Existing Systems

| System               | Impact                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push notifications   | No changes. Blocked users stop receiving pushes naturally (their engagements are cancelled, no more events trigger notifications for them).                      |
| Email notifications  | No changes. Same reasoning as push.                                                                                                                              |
| Docky AI advisor     | Blocked users can't access Docky (auth guard blocks all routes).                                                                                                 |
| Stripe subscriptions | Blocking does not cancel subscriptions. Admin must handle this manually via Stripe dashboard. Noted as a V2 automation candidate.                                |
| Mobile app           | No admin routes in mobile. Blocking enforcement works via the same API auth guard. Support channel is web-only initially.                                        |
| Cron jobs            | Cron jobs (availability expiry, engagement reminder) will skip blocked users naturally — their availability is cleared and engagements cancelled by the cascade. |
