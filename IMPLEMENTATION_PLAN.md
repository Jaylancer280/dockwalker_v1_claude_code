# DockWalker — Phase 1 Implementation Plan

## Context

DockWalker is a greenfield superyacht daywork hiring app. No code exists yet. This plan establishes the build order from zero to a deployable Phase 1 product.

**Tech stack:** Next.js + TypeScript, Supabase (Postgres + Auth), Vercel, GitHub Actions, Capacitor (native mobile wrapper), GitHub monorepo.

**Architecture:** Event-sourced with append-only events table and projection tables. Projections updated **synchronously within the same DB transaction** as the event write (via Postgres functions called from the API layer). This avoids projection drift, retry logic, and failure modes. Async event processing deferred until scale demands it.

---

## Aggregate Definitions

Events reference an aggregate. The aggregates are:

- **Person** (`aggregate_type: 'person'`, `aggregate_id: person_id`) — for `PERSON.*`, `PROFILE.*`
- **Vessel** (`aggregate_type: 'vessel'`, `aggregate_id: vessel_id`) — for `VESSEL.*`
- **Daywork** (`aggregate_type: 'daywork'`, `aggregate_id: daywork_id`) — for `DAYWORK.*`
- **Application** (`aggregate_type: 'application'`, `aggregate_id: '{crew_person_id}:{daywork_id}'`) — for `APPLICATION.*`, `ENGAGEMENT.*`. Note: the `aggregate_id` in events uses this composite string for readability, but the `applications` projection table uses a UUID PK with a composite unique constraint on `(crew_person_id, daywork_id)`. Never parse the aggregate_id string to extract components — always join via the projection table.
- **Message** (`aggregate_type: 'message'`, `aggregate_id: engagement_id`) — for `MESSAGE.*`

---

## Build Order

### Stage 1: Monorepo Scaffolding

- Init GitHub monorepo:
  ```
  /apps/web          — Next.js app (frontend + API routes)
  /packages/types    — Shared TypeScript types (events, domain models, enums)
  /packages/db       — Supabase client, migrations, seed data
  /supabase          — Supabase config, migrations (supabase CLI)
  ```
- Configure: TypeScript, ESLint, Prettier, path aliases
- Set up Supabase project (local dev via `supabase init` + `supabase start`)
- Set up Tailwind CSS + mobile-first component approach
- Basic GitHub Actions: lint + type-check on PR

### Stage 2: Database Schema + Event Infrastructure

- **Events table** (append-only):
  ```sql
  id (uuid), event_type (text), aggregate_id (text), aggregate_type (text),
  role_context (text), payload (jsonb), person_id (uuid), created_at (timestamptz)
  ```
- **Event-writing utility:** `appendEvent()` implemented as a Postgres function (or called from API route within a single transaction) that:
  1. Inserts into `events` table
  2. Calls projection-update logic in the same transaction
  3. Returns the event ID
- **Canonical data seeds** (research and propose actual marina lists for approval):
  - Regions → Cities → Ports/Marinas lookup tables
  - Yacht roles (Deckhand, Stewardess/Steward, Engineer, Chef, Bosun, First Mate, Captain, etc.)
  - Certification types (STCW Basic Safety, ENG1, Food Safety/Hygiene, Powerboat Level 2, etc.)
  - Experience brackets (e.g. 0-6mo, 6-12mo, 1-2yr, 2-5yr, 5yr+)
  - Vessel types (private, charter)
  - Vessel size bands (e.g. 24-30m, 30-40m, 40-50m, 50-60m, 60-80m, 80m+)
- **Projection tables (initial):**
  - `persons` — auth-linked identity
  - `profiles` — crew or agent data, current hat
  - `vessels` — IMO (immutable PK), name, type, size, nda_flag, owner_person_id
  - `dayworks` — active postings
  - `applications` — current state per crew+daywork pair
  - `availability_windows` — crew daily availability with expiry
- **RLS policies** on all tables. **Vessel NDA is a critical correctness requirement** — see Verification section.

### Stage 3: Auth + Onboarding

- Supabase Auth: email + phone sign-up (social login deferred)
- Onboarding flow:
  1. Sign up → `PERSON.CREATED`
  2. Select identity type: Crew or Agent
  3. Type-specific profile form → `PROFILE.CREATED`
  4. (Crew only) Select initial hat: "I'm looking for work" / "I'm looking to hire"
- Profile pages: crew profile (role, certs, experience, vessel size exposure) and agent profile (agency, location, specialization)
- API routes: `POST /api/onboarding/profile`, `PATCH /api/profile`

### Stage 4: Vessel Management

- Vessel CRUD (employer/agent only): create vessel with required IMO, name, type, size
- NDA flag: when set, IMO hidden from all non-owner, non-admin queries
- **NDA RLS test required before building on top** (see Verification)
- Vessel selector on daywork posting form (pick existing or create new)
- API routes: `POST /api/vessels`, `GET /api/vessels` (owner's vessels)

### Stage 5: Daywork Posting (Employer Side)

- Post daywork form: role, location (dropdown from canonical), duration (start/end date), vessel (from Stage 4), required certs, experience bracket, optional day rate, meals, notes
- `DAYWORK.POSTED` event → projection into `dayworks` table
- My postings dashboard: list of active/completed postings
- Cancel posting → `DAYWORK.CANCELLED_BY_EMPLOYER`
- API routes: `POST /api/daywork`, `GET /api/daywork/mine`, `POST /api/daywork/:id/cancel`

### Stage 6: Availability Calendar

- Daily calendar UI: tap/drag to set available days, bulk-set ("this week", "next 2 weeks")
- Expiry: availability auto-expires after configurable period if not refreshed
- `AVAILABILITY.SET` events with date range + expiry timestamp
- Cross-reference with accepted engagements to show true availability
- API routes: `GET /api/availability`, `POST /api/availability`

### Stage 7: Job Discovery + Apply (Crew Side) — Swipe Mechanic

- Card stack UI: one job at a time, swipe right = apply, swipe left = pass, tap = expand details
- Filtering: role, certs, location, date range (availability filter depends on Stage 6 data)
- Sorting: context-dependent defaults (proximity or recency), user-switchable
- Apply flow: single-tap confirm, optional 250-char message → `DAYWORK.APPLIED`
- **Withdraw:** crew can withdraw pending application → `APPLICATION.WITHDRAWN`
- Only show jobs where crew meets cert/role requirements and has availability on the posted dates
- Hide jobs where crew already applied or was superseded
- API routes: `GET /api/daywork/discover`, `POST /api/daywork/:id/apply`, `POST /api/daywork/:id/withdraw`

### Stage 8: Applicant Review (Employer Side) — Swipe Mechanic

- Card stack UI: one applicant at a time per posting, swipe right = accept, swipe left = reject
- Applicant card: role history, certs, availability, location, experience bands, past daywork count
- Accept → command validation (check no overlapping accepted engagement for this crew on these dates) → `DAYWORK.ACCEPTED` → auto-supersede crew's other overlapping pending applications (`APPLICATION.SUPERSEDED`)
- Reject → `DAYWORK.REJECTED`
- Viewed tracking → `DAYWORK.VIEWED` on card render
- API routes: `GET /api/daywork/:id/applicants`, `POST /api/daywork/:id/applicants/:crewId/accept`, `.../reject`

### Stage 9: Messaging

- Chat UI: opens only for accepted crew+daywork pairs (derived from `active_engagements` projection)
- Materialized `active_engagements` projection table for fast eligibility checks
- Real-time: poll or Supabase Realtime subscription on messages table
- `MESSAGE.SENT` events, messages projection table
- UI-level hide (one-sided), no server delete
- API routes: `GET /api/messages/:engagementId`, `POST /api/messages/:engagementId`

### Stage 10: Engagement Lifecycle

- Post-acceptance cancellation flows:
  - Crew cancels → `ENGAGEMENT.CANCELLED_BY_CREW`
  - Employer cancels → `ENGAGEMENT.CANCELLED_BY_EMPLOYER`
- Mark complete → `DAYWORK.COMPLETED`
- State machine enforcement at API layer (validate transitions)

### Stage 11: Capacitor + PWA

- Add Capacitor to the monorepo
- Configure iOS + Android projects
- Push notifications (via Capacitor plugin)
- Haptic feedback on swipe actions
- App store build pipeline (GitHub Actions)

### Stage 12: Polish + Deploy

- Vercel deployment config
- Environment variables management (Supabase keys, etc.)
- Error handling, loading states, empty states
- Mobile-first responsive design pass
- GitHub Actions: lint, type-check, build, deploy on merge to main

---

## Verification

### NDA Vessel RLS (Critical — Stage 4, before any vessel features are built on top)

Write and run an explicit test:

1. Create a vessel with `nda_flag: true` as employer user
2. Query vessels as a crew user → assert IMO is NOT returned
3. Query vessels as the owning employer → assert IMO IS returned
4. Query vessels as admin → assert IMO IS returned
5. This test must pass before Stage 5 begins

### Event Transaction Integrity (Stage 2)

Verify that `appendEvent()` + projection update are atomic:

1. Trigger an event write that intentionally fails projection update
2. Assert neither the event nor the projection was written (full rollback)

### Overlap Superseding (Stage 8)

1. Crew applies to Job A (dates: Mar 5-8) and Job B (dates: Mar 6-10)
2. Employer A accepts crew → `DAYWORK.ACCEPTED`
3. Assert crew's application to Job B is auto-superseded (`APPLICATION.SUPERSEDED`)
4. Assert crew no longer appears in Job B's applicant stack

### Double-Booking Prevention (Stage 8)

1. Crew is accepted for Job A (dates: Mar 5-8)
2. Employer B attempts to accept same crew for Job C (dates: Mar 7-10)
3. Assert acceptance is rejected at command validation layer

---

## What to Build First

**Stages 1–3** are the foundation. Start here:

1. Scaffold the monorepo
2. Set up Supabase with the events table, canonical data (including researched port/marina lists), and projection tables
3. Wire up auth and the onboarding flow

This gives a working app where users can sign up, create profiles, and select their role — the skeleton everything else hangs on.
