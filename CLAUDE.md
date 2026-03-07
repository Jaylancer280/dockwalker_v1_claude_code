# CLAUDE.md — DockWalker Architectural Source of Truth

> Read this file in full before touching any code. It is not optional background reading.

## Project Overview

DockWalker is a two-sided, real-time daywork hiring app for the superyacht industry. Crew seeking short-term work (1-14 day engagements) are matched with employers who need immediate cover via a Tinder-like swipe mechanic.

**Out of scope:** full-time hiring marketplace, reputation scoring, social network, vessel management, gamified career app, AI recommendation feeds.

## Stack — Locked In, Non-Negotiable

| Layer                 | Technology                                |
| --------------------- | ----------------------------------------- |
| Frontend + API routes | Next.js 16 + TypeScript (`apps/web/`)     |
| Database + Auth       | Supabase (PostgreSQL + RLS) (`supabase/`) |
| Shared types          | `packages/types/`                         |
| DB helpers            | `packages/db/`                            |
| Hosting               | Vercel                                    |
| CI/CD                 | GitHub Actions                            |
| Native mobile         | Capacitor (iOS + Android)                 |
| Push notifications    | APNs (iOS) + FCM (Android)                |

Never introduce a dependency that conflicts with the above. If a task cannot be built within this stack, stop and raise it explicitly.

## Core Architectural Invariants

These rules cannot be violated under any circumstances.

### 1. Append-Only Ledger

No `UPDATE` or `DELETE` on the events table. State changes are new rows, not mutations.

### 2. IMO Number as Truth Anchor

Every vessel is anchored to its IMO number. IMO is immutable once written. Required on every daywork posting.

### 3. RLS on Every Table

Every table must have Row Level Security policies before use. No exceptions.

### 4. Migrations Must Be Reversible

Every migration in `supabase/migrations/` must have a corresponding rollback in `supabase/rollbacks/`.

### 5. TypeScript Strict Mode

`strict: true` in tsconfig.json. No `any` types without explicit comment justification.

### 6. Capacitor Day-One

Every frontend slice must be Capacitor-compatible. iOS and Android are not post-launch concerns.

## User Types and Dual-Role Model

**Crew** — Onboarded with role, certs, experience. Selects initial hat (crew or employer). Can switch hats.

**Agency Agent** — Onboarded with agency data. Cannot switch hats (always agent). Verification deferred to later stage.

Single profile per person. Every event carries `role_context` (`crew` | `employer` | `agent`). Role-gating: crew hat cannot post jobs, employer hat cannot apply.

**Onboarding:** `PERSON.CREATED` -> `PROFILE.CREATED` -> hat selection -> user can act. `PROFILE.CREATED` required before any domain action, enforced at API layer.

## Vessel Entity

First-class entity with IMO as immutable identity anchor. Employers/agents save vessels and reuse across postings.

**NDA vessels:** IMO stored server-side but only visible to posting employer and admins. Crew see metadata (size band, type) but never IMO. NDA access requests deferred to long-term contract integration.

## Event-Sourced Architecture

All state derived from append-only event log. Events are namespaced for future extension (e.g. `CONTRACT.*`).

### Core Events

```
PERSON.CREATED / PERSON.DEACTIVATED / PERSON.DATA_SCRUBBED
PROFILE.CREATED / PROFILE.UPDATED
AGENT.VERIFIED (placeholder, deferred)
VESSEL.CREATED / VESSEL.UPDATED
AVAILABILITY.SET
DAYWORK.POSTED / DAYWORK.APPLIED / DAYWORK.VIEWED
DAYWORK.ACCEPTED / DAYWORK.REJECTED / DAYWORK.COMPLETED
APPLICATION.WITHDRAWN / APPLICATION.SUPERSEDED
DAYWORK.CANCELLED_BY_EMPLOYER
ENGAGEMENT.CANCELLED_BY_CREW / ENGAGEMENT.CANCELLED_BY_EMPLOYER
MESSAGE.SENT
```

### Application State Machine

```
Applied -> Viewed -> Accepted | Rejected | Withdrawn | Superseded -> Completed | Cancelled
```

### Cancellation Semantics

- `APPLICATION.WITHDRAWN` — crew pulls out pre-acceptance
- `APPLICATION.SUPERSEDED` — system auto-withdraws overlapping pending applications
- `DAYWORK.CANCELLED_BY_EMPLOYER` — employer cancels posting
- `ENGAGEMENT.CANCELLED_BY_CREW` — crew backs out post-acceptance
- `ENGAGEMENT.CANCELLED_BY_EMPLOYER` — employer rescinds post-acceptance

## Date Overlap Resolution

Crew can apply to overlapping jobs. Resolved at acceptance time:

1. Engagement confirmed immediately
2. Pending overlapping applications auto-superseded (`APPLICATION.SUPERSEDED`)
3. `check_no_overlap()` prevents double-booking at command layer

## Messaging

Opens ONLY after `DAYWORK.ACCEPTED`. All messages append-only, retained server-side. Users can hide (UI-level) but not delete.

## Availability Model

Daily calendar with graceful auto-expiry. `AVAILABILITY.SET` carries expiry timestamp (default 7 days). System cross-references with accepted engagements.

## Geographic Location

Canonical hierarchy: Region -> City -> Port/Marina. No free text, exact matching. 63 marinas across 7 launch regions.

## Sorting

Deterministic, transparent, no learned weights. Context-dependent defaults with user override. Sort factors: recency, proximity, role-aligned tenure. Always explicit and visible.

## GDPR and Account Deletion

`PERSON.DEACTIVATED` -> retention period -> `PERSON.DATA_SCRUBBED`. Abuse detection via one-way hash of device fingerprint (non-PII). Event structure retained for audit integrity.

## Correctness Criteria

1. Crew applies to a job in <5 seconds
2. Employer posts a job in <60 seconds
3. Employer accepts a candidate in 1-3 actions
4. Messaging opens only after acceptance
5. All states are event-derived
6. No scoring, ranking, or hidden algorithmic biasing
7. All filters are explicit and visible
8. Events namespaced; `CONTRACT.*` uses separate types sharing backbone

---

## Pre-Commit Hook Requirements

All must pass before any commit is accepted:

- `tsc --noEmit` — zero TypeScript errors
- ESLint — zero warnings, zero errors
- All tests pass (`vitest run`)
- No `console.log` in committed code (excluding test files)
- No `TODO` comments in committed code (use Deferred Decisions below)
- Every migration has a corresponding rollback file

## Test Requirements

Tests use Vitest + Testing Library. Located in `apps/web/__tests__/`.

**API layer** (`__tests__/api/`): Happy path, 401 unauth, 400 invalid input, edge cases.

**Component layer** (`__tests__/components/`): Renders without error, critical interactions, mobile viewport.

**Mocking strategy:** Mock `@/lib/supabase/server` with `vi.mock()`, call route handlers directly with mock `Request` objects.

## Session Protocol

### 1. Orient

Read this file. Verify repo state matches Build State below.

### 2. Confirm Scope

State which task, expected files, done condition, and what will NOT be touched. Wait for confirmation before writing code.

### 3. Implement

Build end-to-end. If scope changes needed, stop and report. A task is complete when: code implemented, tests written and passing, tsc + eslint pass, no console.log/TODO.

### 4. Present Changes

Provide plain-English summary: what changed, what could go wrong, what tests prove, what tests don't cover, architectural impact, domain impact.

### 5. Update State

Move task to Completed in Build State. Update schema version if migration applied. Add any deferred decisions.

### 6. Close

State what was built, suggest commit message, confirm pre-commit passes.

## Human Review Checklist

1. Does this touch the ledger or IMO anchor logic?
2. Does this add/modify a database table? What happens on rollback?
3. Does this change auth or RLS? Who can access what?
4. What input would make the new tests fail?
5. Did anything regress in the existing test suite?

---

## Build State

### Completed Stages

- [Stages 1-11] Core infrastructure, all API routes, all pages, bottom navbar, templates, chat
- [Stage 12] Polish + Deploy — error boundary, not-found page, loading states, fetch error handling

### Current Schema Version

v6 — daywork_templates (6 migrations applied)

### Deferred Decisions

- Agent verification process and verified badge
- NDA access request features (crew requesting NDA info)
- Vessel deactivation
- Internal metrics (availability reliability, engagement frequency)
- Push notification token registration to server

### In Progress

None

### Next Up

(Ordered queue — reorder as priorities shift)
