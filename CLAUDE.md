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

**Onboarding:** API onboarding runs through `public.onboard_person(...)`, which appends `PERSON.CREATED` and `PROFILE.CREATED` atomically. `PROFILE.CREATED` is required before any domain action, enforced at the API layer and app middleware.

## Vessel Entity

First-class entity with IMO as immutable identity anchor. Employers/agents save vessels and reuse across postings.

**NDA vessels:** IMO stored server-side but only visible to posting employer and admins. Crew see metadata (size band, type) but never IMO. NDA access requests deferred to long-term contract integration.

## Event-Sourced Architecture

All domain state is derived from the append-only event log. Events are namespaced for future extension (e.g. `CONTRACT.*`).

**Documented exception:** `daywork_templates` is plain CRUD utility data for faster repeat posting. It is owner-scoped via RLS, reversible via migration rollback, and intentionally not part of the event ledger.

### Core Events

```
PERSON.CREATED / PERSON.HAT_CHANGED / PERSON.DEACTIVATED / PERSON.DATA_SCRUBBED
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

Opens ONLY after `DAYWORK.ACCEPTED`. Messages are append-only and retained server-side. Content is never deleted.

## Availability Model

Daily calendar with graceful auto-expiry. `AVAILABILITY.SET` carries expiry timestamp (default 7 days). Clearing dates is implemented as immediately expiring availability through the ledger, not direct deletion. System cross-references with accepted engagements.

## Geographic Location

Canonical hierarchy: Region -> City -> Port/Marina. No free text, exact matching. 55 ports/marinas across 7 launch regions.

## Sorting

Deterministic, transparent, no learned weights. Context-dependent defaults with user override. Sort factors: recency, proximity, role-aligned tenure. Always explicit and visible.

## GDPR and Account Deletion

`PERSON.DEACTIVATED` -> retention period -> `PERSON.DATA_SCRUBBED`. Abuse detection via one-way hash of device fingerprint (non-PII). Event structure retained for audit integrity.

## Correctness Criteria

1. Crew applies to a job in <5 seconds
2. Employer posts a job in <60 seconds
3. Employer accepts a candidate in 1-3 actions
4. Messaging opens only after acceptance
5. All domain states are event-derived, except `daywork_templates`
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
- No `TODO` comments in committed code (use Deferred Decisions in `BUILD_STATE.md`)
- Every migration has a corresponding rollback file
- Documentation freshness — code directory changes require corresponding `.md` file updates (skip with `SKIP_DOCS_CHECK=1` for pure refactors)
- Schema version check — `BUILD_STATE.md` version must match migration file count

## Test Requirements

Tests use Vitest + Testing Library. Located in `apps/web/__tests__/`.

**API layer** (`__tests__/api/`): Happy path, 401 unauth, 400 invalid input, edge cases.

**Component layer** (`__tests__/components/`): Renders without error, critical interactions, mobile viewport.

**Mocking strategy:** Mock `@/lib/supabase/server` with `vi.mock()`, call route handlers directly with mock `Request` objects.

## Documentation Governance

Claude Code MUST update documentation as part of every session's Close step.

> The product mission lives in [dockwalker_mission.md](./dockwalker_mission.md). Read it during Orient to stay aligned with product intent.

### File Rules

| File                       | Mode                                  | Update Trigger                                                                                                                  |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                | **Read-only**                         | Never edited by Claude Code. Human-edited only when architectural rules change.                                                 |
| `dockwalker_mission.md`    | **Read-only**                         | Never edited by Claude Code. Human-edited only.                                                                                 |
| `BUILD_STATE.md`           | **Append + Edit**                     | Every session that changes code. Append completed work, update schema version, update migration table, move deferred decisions. |
| `README.md` (root)         | **Edit when referenced code changes** | Monorepo structure changes, new packages, changed quick-start steps.                                                            |
| `apps/web/README.md`       | **Edit when referenced code changes** | New/removed RPCs, new env vars, new scripts, changed setup steps.                                                               |
| `packages/types/README.md` | **Edit when referenced code changes** | New/changed/removed type exports.                                                                                               |
| `packages/db/README.md`    | **Edit when referenced code changes** | New/changed/removed DB helpers or RPCs.                                                                                         |
| `supabase/README.md`       | **Edit when referenced code changes** | New migrations, changed RPCs, changed conventions.                                                                              |
| `tasks/todo.md`            | **Read + Write**                      | Every session. Read at Orient, write checklist at Plan, mark complete during Implement, clean up at Close.                      |
| `tasks/lessons.md`         | **Read + Append**                     | Read at Orient. Append immediately after any user correction. Review and deduplicate periodically.                              |

### Catch-All Rules

- **New packages or top-level directories:** Create a `README.md` in the new directory and add it to the File Rules table above (human edit required — flag this in the Close step).
- **Deleted or renamed packages:** Flag in the Close step that the File Rules table needs a human update to remove or rename the entry.
- **Files not in the table** (e.g., auto-generated boilerplate like `apps/web/ios/App/CapApp-SPM/README.md`): No governance obligation unless they document project-specific behavior.

### What Counts as "a Session That Changes Code"

A session triggers `BUILD_STATE.md` updates if it changes **any committed source file** — application code, migrations, types, DB helpers, or configuration that affects build/runtime behavior (tsconfig, eslint config, package.json scripts).

Sessions that **only** change test files, `.md` files, or non-functional config (prettier, .gitignore) do NOT require a `BUILD_STATE.md` update unless they are part of a larger stage.

### Stage Conventions

Each entry in the Completed Stages list in `BUILD_STATE.md` represents a coherent unit of work — a feature, a set of related fixes, or an infrastructure change. Use one line per stage with a short description. Do not create a stage for trivial changes (single typo fix, config tweak). Bundle small related changes into one stage. Number sequentially from the last stage.

If a session changes code that an `.md` file documents, updating that `.md` file is part of the definition of done — the task is not complete without it.

## Session Protocol

### 1. Orient

Read these files in order:

1. `CLAUDE.md` (this file — architectural rules)
2. `BUILD_STATE.md` (current build progress, schema version, deferred decisions)
3. `dockwalker_mission.md` (product context and negative space)
4. `tasks/lessons.md` (past mistakes and project-specific patterns — do not repeat these)
5. `tasks/todo.md` (in-flight work from previous sessions)

Verify repo state matches Build State. If `tasks/todo.md` has incomplete items from a previous session, surface them to the user before starting new work.

### 2. Plan

State which task, expected files, done condition, and what will NOT be touched.

**Plan-first rule:** For any task touching 3+ files or requiring a migration, write a checklist to `tasks/todo.md` before writing code. Each checklist item should be a concrete, verifiable action (not "implement feature" but "add column X to table Y").

Wait for user confirmation before proceeding to implementation.

### 3. Implement

Build end-to-end, marking checklist items in `tasks/todo.md` as complete (`[x]`) as each is finished.

**Stop-and-replan rule:** If implementation diverges from the plan — unexpected dependency, scope creep, broken assumption — stop immediately. Update the checklist in `tasks/todo.md` with the revised plan. Get user confirmation before continuing.

**Lessons check:** Before editing any file, verify the change does not repeat a pattern documented in `tasks/lessons.md`.

A task is complete when: code implemented, tests written and passing, tsc + eslint pass, no console.log/TODO.

### 4. Present Changes

Provide plain-English summary: what changed, what could go wrong, what tests prove, what tests don't cover, architectural impact, domain impact.

### 5. Update Documentation

For every file changed in this session, check the Documentation Governance table. If any `.md` file references changed code, update it. Specifically:

1. Append completed work to `BUILD_STATE.md` (stage name + one-liner)
2. Update schema version in `BUILD_STATE.md` if migration applied
3. Update migration table in `BUILD_STATE.md` if migration added
4. Add any new deferred decisions to `BUILD_STATE.md`
5. If RPCs, env vars, or scripts changed, update `apps/web/README.md`
6. If shared types changed, update `packages/types/README.md`
7. If DB helpers changed, update `packages/db/README.md`
8. If migrations/rollbacks changed, update `supabase/README.md`
9. If monorepo structure changed, update root `README.md`
10. Move completed items in `tasks/todo.md` to the Done section
11. If the user corrected you during this session, append the pattern to `tasks/lessons.md`

A task is NOT complete until all applicable documentation is updated.

### 6. Close

State what was built, suggest commit message, confirm pre-commit passes. Confirm all documentation updates from step 5 were applied.

Verify: `tasks/todo.md` reflects current state (no stale in-progress items). `tasks/lessons.md` captures any new lessons from this session.

### Self-Improvement Rule

After ANY correction from the user — wrong assumption, missed edge case, repeated mistake, style preference — append the pattern to `tasks/lessons.md` **immediately**, before continuing work. Do not wait until the Close step. The correction is the trigger; the lesson must be written before the next line of code.

## Human Review Checklist

1. Does this touch the ledger or IMO anchor logic?
2. Does this add/modify a database table? What happens on rollback?
3. Does this change auth or RLS? Who can access what?
4. What input would make the new tests fail?
5. Did anything regress in the existing test suite?

## Two-Agent Workflow

When running two terminals simultaneously, agents operate in distinct roles. Role is assigned by the user's opening message, not by this file.

### Planning Agent (read-only on source code)

- Explores codebase, researches questions, reviews implementation output, drafts test cases
- Writes ONLY to `tasks/todo.md` and `tasks/lessons.md`
- Never edits source files, migrations, types, or tests
- Populates `tasks/todo.md` with detailed checklists before implementation starts

### Implementation Agent (executes the plan)

- Reads `tasks/todo.md` at Orient — this is the work spec
- Reads `tasks/lessons.md` at Orient — these are guardrails
- Marks checklist items `[x]` as completed during Implement
- Follows the full Session Protocol (Orient through Close)

### File Access by Role

| File               | Planning Agent | Implementation Agent |
| ------------------ | -------------- | -------------------- |
| `tasks/todo.md`    | Read + Write   | Read + Mark Complete |
| `tasks/lessons.md` | Read + Write   | Read + Append        |
| Source code        | Read only      | Read + Write         |
| `BUILD_STATE.md`   | Read only      | Append + Edit        |

On single-agent days, one agent fulfills both roles — writes its own checklist, then implements it.

---

## Build State

Build state is tracked in [BUILD_STATE.md](./BUILD_STATE.md). Claude Code updates that file — not this one — at the end of every session.
