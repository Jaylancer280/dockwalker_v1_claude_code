# CLAUDE.md — DockWalker Architectural Source of Truth

> Read this file in full before touching any code. It is not optional background reading.

## Project Overview

DockWalker is a two-sided hiring app for the superyacht industry covering daywork (1-14 day engagements, browsed one card at a time on the crew side and reviewed Tinder-style on the employer side) and permanent positions (structured hiring with shortlisting and negotiation). Daywork brings users in. Permanent makes them stay.

**Out of scope:** generic cross-industry job board, reputation scoring, social network, vessel management, gamified career app, AI recommendation feeds.

## Stack — Locked In, Non-Negotiable

| Layer                 | Technology                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Web frontend + API    | Next.js 16 + TypeScript (`apps/web/`)                                                     |
| Database + Auth       | Supabase (PostgreSQL + RLS) (`supabase/`)                                                 |
| Shared types          | `packages/types/`                                                                         |
| DB helpers            | `packages/db/`                                                                            |
| Shared business logic | `packages/shared/` — pure TS, zero platform deps (units, languages, epaulettes, grouping) |
| Monorepo orchestrator | Turborepo (`turbo.json`)                                                                  |
| Hosting (web + API)   | Vercel                                                                                    |
| CI/CD                 | GitHub Actions                                                                            |
| Push notifications    | FCM HTTP v1 + APNs HTTP/2 (server-side, see `apps/web/src/lib/push-delivery.ts`)          |

**Web-only platform.** A native mobile app (`apps/mobile/`, Expo/React Native) was built then deleted on 2026-04-29 — see `docs/archive/mobile-web-split-spec.md` for the full record. The shared packages (`packages/types`, `packages/db`, `packages/shared`) stay because the cross-platform discipline is cheap and useful for future workers / edge functions / scripts. Do not add a new mobile target without explicit user instruction.

Never introduce a dependency that conflicts with the above. If a task cannot be built within this stack, stop and raise it explicitly.

## Core Architectural Invariants

These rules cannot be violated under any circumstances.

### 1. Append-Only Ledger

No `UPDATE` or `DELETE` on the events table. State changes are new rows, not mutations.

### 2. IMO Number as Truth Anchor

Every vessel is anchored to its IMO number. IMO is immutable once written. Required on every daywork and permanent posting.

### 3. RLS on Every Table

Every table must have Row Level Security policies before use. No exceptions.

### 4. Migrations Must Be Reversible

Every migration in `supabase/migrations/` must have a corresponding rollback in `supabase/rollbacks/`.

### 5. TypeScript Strict Mode

`strict: true` in all `tsconfig.json` files. No `any` types without explicit comment justification.

### 6. Shared Packages Stay Pure-TS

Pure TypeScript utilities (zero React, zero platform imports) belong in `packages/shared/`. The shared packages (`packages/types`, `packages/db`, `packages/shared`) are platform-agnostic on purpose — even with the web app as the only consumer today, the cross-platform discipline keeps them reusable for scripts, edge functions, or any future client without rework.

## User Types and Dual-Role Model

**Crew** — Onboarded with role, certs, experience. Selects initial hat (crew or employer). Can switch hats.

**Agency Agent** — Onboarded with agency data. Cannot switch hats (always agent). Verification deferred to later stage.

Single profile per person. Every event carries `role_context` (`crew` | `employer` | `agent`). Role-gating: crew hat cannot post jobs, employer hat cannot apply.

**Onboarding:** API onboarding runs through `public.onboard_person(...)`, which appends `PERSON.CREATED` and `PROFILE.CREATED` atomically. `PROFILE.CREATED` is required before any domain action, enforced at the API layer and app middleware.

## Vessel Entity

First-class entity with IMO as immutable identity anchor. Employers/agents save vessels and reuse across postings. Crew create vessels for experience entries. Vessel creation is shared between daywork and permanent post forms.

**NDA vessels:** IMO stored server-side but only visible to posting employer and admins. Crew see metadata (size band, type) but never IMO. NDA IMO is revealed to crew after acceptance (daywork) or selection (permanent) via `get_vessel_public` RPC. NDA access requests deferred.

## Event-Sourced Architecture

All domain state is derived from the append-only event log. Events are namespaced by domain. Daywork uses `DAYWORK.*`, permanent hiring uses `PERMANENT.*`. Each namespace has its own handlers in `apply_projection` with zero cross-contamination.

**Documented exceptions:** `daywork_templates` and `permanent_templates` are plain CRUD utility data for faster repeat posting. They are owner-scoped via RLS, reversible via migration rollback, and intentionally not part of the event ledger.

### Core Events

```
PERSON.CREATED / PERSON.HAT_CHANGED / PERSON.DEACTIVATED / PERSON.DATA_SCRUBBED
PROFILE.CREATED / PROFILE.UPDATED
AGENT.VERIFIED (placeholder, deferred)
VESSEL.CREATED / VESSEL.UPDATED
AVAILABILITY.SET
DAYWORK.POSTED / DAYWORK.APPLIED / DAYWORK.VIEWED / DAYWORK.SHORTLISTED
DAYWORK.ACCEPTED / DAYWORK.REJECTED / DAYWORK.COMPLETED
DAYWORK.EXTENDED / DAYWORK.INVITED / DAYWORK.RELISTED
DAYWORK.POSITIONS_UPDATED / DAYWORK.INVITATION_ACCEPTED / DAYWORK.INVITATION_DECLINED
DAYWORK.CANCELLED_BY_EMPLOYER
APPLICATION.WITHDRAWN / APPLICATION.SUPERSEDED
EXPERIENCE.ADDED / EXPERIENCE.UPDATED / EXPERIENCE.REMOVED
CHECKLIST.SET / CHECKLIST.ITEM_TOGGLED
ENGAGEMENT.CANCELLED_BY_CREW / ENGAGEMENT.CANCELLED_BY_EMPLOYER
ENGAGEMENT.POSTPONEMENT_PROPOSED / ENGAGEMENT.POSTPONEMENT_ACCEPTED / ENGAGEMENT.POSTPONEMENT_REJECTED
ENGAGEMENT.WORK_STARTED / ENGAGEMENT.WORK_STARTED_CONFIRMED
ENGAGEMENT.COMPLETION_CONFIRMED / ENGAGEMENT.COMPLETION_DISPUTED
ENGAGEMENT.RATED_BY_CREW / ENGAGEMENT.RATED_BY_EMPLOYER
ENGAGEMENT.CANCELLATION_RATED_BY_CREW / ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER
MESSAGE.SENT
PERMANENT.POSTED / PERMANENT.APPLIED / PERMANENT.APPLICATION_BLOCKED
PERMANENT.SHORTLISTED / PERMANENT.REJECTED / PERMANENT.SELECTED
PERMANENT.PLACEMENT_CONFIRMED / PERMANENT.SELECTION_REVERTED
PERMANENT.WITHDRAWN / PERMANENT.CANCELLED_BY_EMPLOYER
PERMANENT.ENGAGEMENT_CLOSED
ADMIN.ENGAGEMENT_COMPLETED / ADMIN.CANONICAL_ADDED / ADMIN.CANONICAL_UPDATED
```

### Daywork Application State Machine

```
Applied -> Viewed -> Shortlisted -> Accepted | Rejected | Withdrawn | Superseded -> Completed | Cancelled
```

Note: `Shortlisted` is optional — employer can accept directly from `Viewed` or `Applied`.

### Permanent Application State Machine

```
Applied -> Shortlisted -> Selected -> (Placement confirmed or Reverted)
Applied -> Rejected | Withdrawn | Not Selected
Shortlisted -> Selected | Rejected | Withdrawn | Not Selected
Selected -> Not Selected (reverted) | Withdrawn
```

### Cancellation Semantics

- `APPLICATION.WITHDRAWN` — crew pulls out pre-acceptance
- `APPLICATION.SUPERSEDED` — system auto-withdraws overlapping pending applications
- `DAYWORK.CANCELLED_BY_EMPLOYER` — employer cancels posting
- `ENGAGEMENT.CANCELLED_BY_CREW` — crew backs out post-acceptance
- `ENGAGEMENT.CANCELLED_BY_EMPLOYER` — employer rescinds post-acceptance
- `PERMANENT.WITHDRAWN` — crew withdraws permanent application (also reverts selection if selected)
- `PERMANENT.CANCELLED_BY_EMPLOYER` — employer cancels permanent posting (also closes engagement if in negotiation)
- `PERMANENT.ENGAGEMENT_CLOSED` — either party closes permanent engagement conversation

## Date Overlap Resolution

Crew can apply to overlapping jobs. Resolved at acceptance time:

1. Engagement confirmed immediately
2. Pending overlapping applications auto-superseded (`APPLICATION.SUPERSEDED`)
3. `check_no_overlap()` prevents double-booking at command layer

Permanent postings have no date overlap resolution. Crew can apply to unlimited permanent jobs simultaneously — there are no date-based conflicts to resolve. This is by design: permanent hiring cycles are longer and crew legitimately interview with multiple employers.

## Messaging

Opens after `DAYWORK.ACCEPTED` (daywork) or `PERMANENT.SELECTED` (permanent). Messages are append-only and retained server-side. Content is never deleted.

## Engagement Lifecycle

Post-acceptance, engagements follow a multi-phase lifecycle with structured actions:

```
Active → Work Started (mutual 2-party confirmation) → Completed (employer marks → crew confirms/disputes) → Rated
Active → Postponement Proposed → Accepted (dates updated) | Rejected (engagement cancelled)
Active → Cancelled by Crew | Cancelled by Employer (structured reasons + optional relist) → Cancellation Rated
```

**Cancellations** require structured reason categories (employer: vessel_leaving, crew_requirements_changed, vessel_operational, other; crew: personal_reasons, found_other_work, unsafe_conditions, other). Employer can request relist. Crew cancellation requires employer response (relist or accept).

**Ratings** are context-aware: completed engagements get a full form (crew rates pay/meals/role/days/vessel; employer rates skills/certs/punctuality), cancelled engagements get a lighter form (crew adds notice_given). Both contexts include communication_accuracy (boolean) and overall_match (1-5). Ratings use yes/no/partial strings and booleans, not numeric scales (except overall_match and vessel_condition).

**Permanent engagements** have additional actions: placement confirmation, selection revert, engagement close.

## Availability Model (daywork only)

Rolling 14-day calendar with dual expiry. Crew selects 1-14 days of availability from a forward-looking window. Two independent mechanisms determine validity:

1. **Per-date shrinkage** — each date falls off the calendar as it moves into the past. The window shrinks daily. If all selected dates are now past, availability gracefully returns to "not set."
2. **7-day activity refresh** — the entire availability window expires 7 days after the user last set or refreshed it, regardless of how many future dates remain. This prevents stale profiles from appearing active in the discover feed. User receives a nudge notification before expiry.

Both conditions must be satisfied for a crew member to appear available: at least one selected date must be in the future AND the last refresh must be within 7 days. Clearing dates is implemented as immediately expiring availability through the ledger, not direct deletion. System cross-references with accepted engagements.

Permanent availability is profile-level, not date-based: `immediate`, `after_notice` (with `notice_period_days`), or `not_looking`. It is informational for employers, not an enforcement gate — except `not_looking` which excludes from the permanent discovery feed.

## Geographic Location

Canonical hierarchy: Region -> City -> Port/Marina. No free text, exact matching. 55 ports/marinas across 7 launch regions.

## Sorting

Deterministic, transparent, no learned weights. Context-dependent defaults with user override. Sort factors: recency, proximity, role-aligned tenure. Always explicit and visible.

## GDPR and Account Deletion

`PERSON.DEACTIVATED` -> retention period -> `PERSON.DATA_SCRUBBED`. Abuse detection via one-way hash of device fingerprint (non-PII). Event structure retained for audit integrity.

## Correctness Criteria

### Web + shared

1. Crew applies to a job in <5 seconds
2. Employer posts a job in <60 seconds
3. Employer accepts a candidate in 1-3 actions
4. Messaging opens only after acceptance or selection
5. All domain states are event-derived, except documented CRUD utility tables (templates, preferences, device tokens, checklists, subscriptions, advisor data, read cursors)
6. No scoring, ranking, or hidden algorithmic biasing
7. All filters are explicit and visible
8. Events namespaced; `PERMANENT.*` uses separate types sharing the event ledger backbone
9. Employer posts a permanent role in <90 seconds
10. Crew applies to a permanent role in <10 seconds
11. Cert hard-gate blocks unqualified permanent applications server-side
12. Shortlist cap is enforced at projection layer
13. Permanent events use `PERMANENT.*` namespace — zero daywork handler modification

---

## Pre-Commit Hook Requirements

All must pass before any commit is accepted:

- `turbo run type-check` — zero TypeScript errors across all workspaces (web + packages)
- `turbo run lint` — ESLint zero warnings, zero errors across all workspaces
- All tests pass (`vitest run` in `apps/web/`)
- No `console.log` in committed code (excluding test files)
- No `TODO` comments in committed code (use Deferred Decisions in `BUILD_STATE.md`)
- Every migration has a corresponding rollback file
- Documentation freshness — code directory changes require corresponding `.md` file updates (skip with `SKIP_DOCS_CHECK=1` for pure refactors)
- Schema version check — `BUILD_STATE.md` version must match migration file count

## Test Requirements

### Web (`apps/web/__tests__/`)

Tests use Vitest + Testing Library.

**API layer** (`__tests__/api/`): Happy path, 401 unauth, 400 invalid input, edge cases.

**Component layer** (`__tests__/components/`): Renders without error, critical interactions, narrow-viewport responsive checks.

**Mocking strategy:** Mock `@/lib/supabase/server` with `vi.mock()`, call route handlers directly with mock `Request` objects.

### E2E (`apps/web/e2e/`)

Playwright tests run by the testing agent. Registry in `tasks/playwright-test-registry.md`.

## Documentation Governance

Claude Code MUST update documentation as part of every session's Close step.

> The product mission lives in [dockwalker_mission.md](./dockwalker_mission.md). Read it during Orient to stay aligned with product intent.

### File Rules

| File                        | Mode                                  | Update Trigger                                                                                                                  |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                 | **Read-only**                         | Never edited by Claude Code. Human-edited only when architectural rules change.                                                 |
| `dockwalker_mission.md`     | **Read-only**                         | Never edited by Claude Code. Human-edited only.                                                                                 |
| `BUILD_STATE.md`            | **Append + Edit**                     | Every session that changes code. Append completed work, update schema version, update migration table, move deferred decisions. |
| `README.md` (root)          | **Edit when referenced code changes** | Monorepo structure changes, new packages, changed quick-start steps.                                                            |
| `apps/web/README.md`        | **Edit when referenced code changes** | New/removed RPCs, new env vars, new scripts, changed setup steps.                                                               |
| `packages/types/README.md`  | **Edit when referenced code changes** | New/changed/removed type exports.                                                                                               |
| `packages/db/README.md`     | **Edit when referenced code changes** | New/changed/removed DB helpers or RPCs.                                                                                         |
| `packages/shared/README.md` | **Edit when referenced code changes** | New/changed/removed shared utilities.                                                                                           |
| `supabase/README.md`        | **Edit when referenced code changes** | New migrations, changed RPCs, changed conventions.                                                                              |
| `tasks/todo.md`             | **Read + Write**                      | Every session. Read at Orient, write checklist at Plan, mark complete during Implement, clean up at Close.                      |
| `tasks/lessons.md`          | **Read + Append**                     | Read at Orient. Append immediately after any user correction. Review and deduplicate periodically.                              |

### Catch-All Rules

- **New packages or top-level directories:** Create a `README.md` in the new directory and add it to the File Rules table above (human edit required — flag this in the Close step).
- **Deleted or renamed packages:** Flag in the Close step that the File Rules table needs a human update to remove or rename the entry.
- **Files not in the table** (e.g., auto-generated boilerplate): No governance obligation unless they document project-specific behavior.

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

For `BUILD_STATE.md`, read only § Current Schema Version, § Deferred Decisions, § In Progress, and the last 5 entries in § Completed Stages. The full stage history is for audit, not for Orient.

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

## Three-Agent Workflow

Agents operate in distinct roles assigned by the user's opening message. Full operating manuals live in `tasks/planning-agent.md`, `tasks/implementation-agent.md`, and `tasks/playwright-agent.md`.

### Planning Agent (read-only on source code)

- Explores codebase, researches questions, reviews implementation output
- Writes to `tasks/todo.md`, `tasks/lessons.md`, `tasks/playwright-test-registry.md` (PLANNED scenarios), `tasks/playwright-suggestions.md`
- Never edits source files, migrations, types, or tests
- Populates `tasks/todo.md` with detailed checklists before implementation starts
- Triages testing agent findings before promoting to todo

### Implementation Agent (executes the plan)

- Reads `tasks/todo.md` at Orient — this is the work spec
- Reads `tasks/lessons.md` at Orient — these are guardrails
- Marks checklist items `[x]` as completed during Implement
- Follows the full Session Protocol (Orient through Close)

### Testing Agent (verifies implementation)

- Runs Playwright E2E tests against the running app
- Updates `tasks/playwright-test-registry.md` with run results
- Writes findings to `tasks/playwright-suggestions.md` for planning agent triage
- Logs regressions to `## Playwright Failures` section in `tasks/todo.md`
- Can modify seed data in `supabase/seed/` and E2E specs in `apps/web/e2e/`

### File Access by Role

| File                                | Planning Agent          | Implementation Agent | Testing Agent                     |
| ----------------------------------- | ----------------------- | -------------------- | --------------------------------- |
| `tasks/todo.md`                     | Write checklists        | Mark `[x]` complete  | Write `## Playwright Failures`    |
| `tasks/lessons.md`                  | Read + Write            | Read + Append        | Read only                         |
| `tasks/playwright-suggestions.md`   | Promote/reject          | Read only            | Write suggestions                 |
| `tasks/playwright-test-registry.md` | Add `PLANNED` scenarios | Read only            | Update run results, add scenarios |
| Source code                         | Read only               | Read + Write         | Read only                         |
| `BUILD_STATE.md`                    | Read only               | Append + Edit        | Read only                         |
| `apps/web/e2e/*`                    | Read only               | Read only            | Read + Write                      |
| `supabase/seed/*`                   | Read only               | Read + Write         | Read + Write                      |

On single-agent days, one agent fulfills both planning and implementation roles.

---

## Build State

Build state is tracked in [BUILD_STATE.md](./BUILD_STATE.md). Claude Code updates that file — not this one — at the end of every session.
