# Permanent Jobs — Product & Technical Spec

> **Status:** Draft v5 — final review incorporated
> **Created:** 2026-03-19 | **v2:** zero contamination | **v3:** negotiation stage | **v4:** second stress test | **v5:** final review
> **Prerequisite:** Stage 126 complete (daywork codebase clean)
> **Scope:** MVP permanent job listings alongside daywork at launch

---

## Revision Notes

**v1 → v2:** Separate `permanent_postings` table and `PERMANENT.*` event namespace instead of shared `dayworks` table. Zero daywork contamination.

**v2 → v3:** Stress-tested spec. Key changes:

- **Single position per posting** — deliberate hiring, not batch hiring.
- **Negotiation stage** — selecting a candidate no longer auto-rejects others. Shortlisted crew stay in `shortlisted` until employer explicitly confirms placement or reverts.
- **No invitations at launch** — headhunting risks agency trust.
- **Applied tab unified** — crew see both types in one list. Toggle only affects Browse.
- **Post page routing** — choice screen before form.

**v3 → v4:** Second stress test. Key fixes:

- **`PERMANENT.WITHDRAWN`** replaces `APPLICATION.WITHDRAWN` reuse — avoids modifying existing handler (contamination fix).
- **`PERMANENT.ENGAGEMENT_CLOSED`** replaces generic `ENGAGEMENT.CLOSED` — keeps all permanent events in the permanent namespace, prevents accidental daywork scope.
- **Dropped `selected_person_id`** from posting table — sync risk across 5 handlers. Query on demand instead.
- **Cancellation during negotiation auto-closes engagement** — prevents orphaned active engagement on a cancelled posting.
- **Placement keeps engagement active** — crew needs the chat for logistics after being placed.
- **Review page negotiation state** — banner + badge on selected candidate.
- **Messages API dual join** — additive LEFT JOIN, `type` field in response.
- **Mine badge** — count of postings with `applied`-status applications (no state tracking needed).
- **Applied tab** — `Promise.all` both APIs, error if either fails.

**v4 → v5:** Final review. Key changes:

- **Removed all competition metrics from crew view.** No "Candidate under consideration" indicator, no live shortlist counts on discovery cards. Crew see only their own application states: Under review / Shortlisted / Position closed.
- **Shortlist cap shown once on posting card** (e.g., "Shortlist: up to 5 candidates") as process transparency, not live count. Shortlist notification includes position: "You've been shortlisted (1 of 5)."
- **`PERMANENT.VIEWED` deferred.** Applications go `applied → shortlisted` directly. Review page is scrollable, not card-stack. New-applicant notifications route to review page.
- **"Posted X days ago"** added to discovery cards.
- **Post page choice screen** gets explicit copy: "Daywork — Short-term cover, 1-14 days" / "Permanent — Long-term position, structured hiring."
- **Vessel creation shared flow** — "Create vessel" inline route shared between daywork and permanent post forms.
- **`PROFILE.UPDATED` handler extension clarified** — profile is entity-scoped, not hat-scoped. Writing new nullable columns is the handler doing its job, not contamination.
- **RLS policies** explicitly required for all new tables.
- **Security hardening** — all permanent routes must match daywork rigidity (try/catch, safe JSON, hat validation, input validation).

---

## Why

DockWalker currently serves daywork only — short-term engagements (1-14 days) with a swipe-to-hire mechanic. This addresses a real gap but targets a small slice of the superyacht workforce: primarily green crew and dockwalkers.

Most superyacht crew are in permanent or rotational positions. Without permanent job listings, experienced crew have no reason to open the app, and employers can't use it for their most common hiring need.

**Daywork brings them. Permanent makes them stay.**

Green crew also want permanent jobs — daywork pays the bills while they search for a long-term position. Without permanent listings, they'll keep checking WhatsApp groups alongside DockWalker, and eventually stop opening the app.

Permanent jobs also feed the Docky AI advisor — career guidance becomes dramatically more valuable when the app covers the full spectrum of yacht work.

---

## Core Principles (Unchanged)

These carry over from daywork. Permanent jobs do not introduce any exceptions.

- **Truth-centric** — no ratings, no rankings, no reputation scores
- **No shaming/faming** — rejection feedback is factual, never judgmental
- **Append-only ledger** — all state changes are events
- **Transparent filtering** — no hidden algorithmic biasing
- **Cert enforcement is declaration-based** — DockWalker does not own or verify certificates online; crew declare what they hold, and misrepresentation is a bannable offence

---

## Design Philosophy

This spec was shaped by three stress tests and a full codebase audit. The decisions below aren't arbitrary — they follow repeating principles. A fresh implementation agent should internalise these before writing code:

**Protect daywork at all costs.** Daywork is the working product with 716 tests and 126 stages of validated behaviour. Every architectural decision prioritises zero contamination — separate table, separate namespace, separate routes, separate components. Where systems must share (applications, engagements, messages, profiles), the sharing is additive (nullable columns, LEFT JOINs, OR branches) and verified against every existing query. If a permanent feature risks breaking daywork, the feature is redesigned, not the daywork code.

**Crew see only their own state.** No competition metrics, no live shortlist counts, no "candidate under consideration" indicators. Crew see: Under review → Shortlisted → Selected → Position filled/closed. What other candidates are doing is invisible. This prevents the anxiety spiral that damages crew trust and disadvantages green crew — the exact user segment DockWalker exists to serve.

**The shortlist is a pipeline, not a one-shot decision.** Selection opens a negotiation, not a hire. Shortlisted candidates are preserved as fallback. The employer can confirm placement, revert to the shortlist, or cancel — without losing qualified candidates. This mirrors how yachting hiring actually works: a captain talks to one person, checks references, and either proceeds or moves to the next.

**Every employer action is an explicit truth event.** Applied → Shortlisted → Selected → Placement Confirmed are all deliberate employer decisions recorded in the ledger. No implicit state changes, no auto-transitions. This feeds the intelligence layer — conversion rates, revert rates, time-to-placement — all derivable from event timestamps without adding tracking events.

**Salary is informational, not transactional.** Salary ranges are displayed transparently on cards. There is no bidding, no negotiation mechanic, no salary comparison tool. In-app salary negotiation is explicitly out of scope. The platform shows what the employer is offering; everything else happens in chat.

**Intelligence is a byproduct, not a feature.** `PERMANENT.APPLICATION_BLOCKED` is the only intelligence-specific event. Everything else — cert gap analysis, career progression patterns, geographic demand — is derived from existing truth events. No tracking infrastructure, no analytics tables, no user behaviour logging. The ledger is the intelligence layer.

---

## Zero-Contamination Architecture

### The Rule

**No existing daywork table is structurally modified.** The `dayworks` table keeps all its NOT NULL constraints, CHECK constraints, and column types exactly as they are today. No columns are added, removed, or made nullable on `dayworks` or `daywork_templates`.

**No existing event handler is modified.** All new event types live in the `PERMANENT.*` namespace with their own handlers in `apply_projection`. Existing handlers are character-identical before and after.

### How

| Concern         | Daywork (unchanged)       | Permanent (new)                         |
| --------------- | ------------------------- | --------------------------------------- |
| Posting table   | `dayworks`                | `permanent_postings` (new table)        |
| Templates table | `daywork_templates`       | `permanent_templates` (new table)       |
| Event namespace | `DAYWORK.*`               | `PERMANENT.*` (new namespace)           |
| Discovery API   | `/api/daywork/discover`   | `/api/permanent/discover` (new route)   |
| Post API        | `/api/daywork` POST       | `/api/permanent` POST (new route)       |
| Apply API       | `/api/daywork/:id/apply`  | `/api/permanent/:id/apply` (new route)  |
| Review API      | `/api/daywork/:id/review` | `/api/permanent/:id/review` (new route) |
| Mine API        | `/api/daywork/mine`       | `/api/permanent/mine` (new route)       |

### What IS Shared (safely)

| Shared resource                | Why it's safe                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events` table                 | Same ledger backbone, different namespace. No handler overlap.                                                                                                                    |
| `append_event` / `appendEvent` | Generic RPC — accepts any event type. No daywork-specific logic.                                                                                                                  |
| `applications` table           | Extended with `permanent_posting_id` (nullable). Daywork supersede logic keys off `daywork_id` — permanent rows (NULL `daywork_id`) are invisible to it. Verified in stress test. |
| `active_engagements` table     | Extended with `permanent_posting_id` (nullable). XOR constraint: exactly one of `daywork_id` / `permanent_posting_id` is set. Messages work identically.                          |
| `messages` table               | Engagement-scoped. Type-agnostic. No changes.                                                                                                                                     |
| `profiles` table               | Extended with permanent availability columns. Additive — no existing columns changed.                                                                                             |
| Vessel entity, lookups         | Read-only references. No changes.                                                                                                                                                 |
| Push/email/notification infra  | Delivery layer. New event types added to `push-triggers.ts` alongside existing ones.                                                                                              |
| Auth, RLS patterns             | Same patterns, new policies on new tables.                                                                                                                                        |

---

## What a Permanent Posting Is

A permanent posting lives in its own table (`permanent_postings`) with its own columns and constraints. It shares vessel, role, and location references with daywork but has a fundamentally different schema.

### Single Position Rule

**Every permanent posting is for exactly one position.** This is deliberate, considered hiring — not batch staffing. If an employer needs two engineers, they create two separate postings with their own shortlists and hiring funnels. This keeps the negotiation stage clean: one selected candidate per posting, one fallback shortlist.

### `permanent_postings` Table Schema

| Column                       | Type            | Constraint                                                                 | Notes                                          |
| ---------------------------- | --------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `id`                         | `uuid`          | PK, default gen_random_uuid()                                              |                                                |
| `employer_person_id`         | `uuid`          | FK → persons, NOT NULL                                                     | Posting owner                                  |
| `vessel_id`                  | `uuid`          | FK → vessels, NOT NULL                                                     | IMO-anchored vessel                            |
| `role_id`                    | `integer`       | FK → yacht_roles, NOT NULL                                                 |                                                |
| `port_id`                    | `integer`       | FK → ports, NOT NULL                                                       | Hierarchical location                          |
| `start_date`                 | `date`          | NOT NULL                                                                   | Ideal start. If <= today, displayed as "ASAP". |
| `salary_min`                 | `numeric(10,2)` | NOT NULL                                                                   | If exact: salary_min = salary_max              |
| `salary_max`                 | `numeric(10,2)` | NOT NULL                                                                   |                                                |
| `salary_currency`            | `text`          | NOT NULL, CHECK (EUR/USD/GBP/AED)                                          |                                                |
| `salary_period`              | `text`          | NOT NULL, CHECK (monthly/annual)                                           |                                                |
| `live_aboard`                | `boolean`       | NOT NULL                                                                   | Replaces daywork meals                         |
| `required_certification_ids` | `integer[]`     | NOT NULL DEFAULT '{}'                                                      | Hard-gated for apply                           |
| `experience_bracket_id`      | `integer`       | FK → experience_brackets, nullable                                         |                                                |
| `shortlist_cap`              | `integer`       | NOT NULL, DEFAULT 5                                                        | Max shortlist size                             |
| `notes`                      | `text`          | nullable                                                                   | Free text                                      |
| `status`                     | `text`          | NOT NULL, DEFAULT 'active', CHECK (active/in_negotiation/filled/cancelled) |                                                |
| `job_number`                 | `serial`        | UNIQUE                                                                     | Human-readable reference (PM-00001)            |
| `created_at`                 | `timestamptz`   | NOT NULL, DEFAULT now()                                                    |                                                |
| `updated_at`                 | `timestamptz`   | NOT NULL, DEFAULT now()                                                    |                                                |

**No `positions_available`, `positions_filled`, or `selected_person_id` columns.** Always 1 position. Status transitions handle lifecycle. The currently selected candidate is queried on demand from `applications WHERE status = 'selected'`.

### `permanent_templates` Table Schema

Same columns minus `status`, `job_number`, `created_at`, `updated_at`. Adds `template_name text NOT NULL`. CRUD utility data, not event-sourced (same precedent as `daywork_templates`).

### Salary Display Logic

- If `salary_min = salary_max` → display as exact: "€5,000/month"
- If `salary_min < salary_max` → display as range: "€3,500 – €5,500/month"
- Currency symbol from existing `currencySymbol()` utility

### Job Reference Prefix

Permanent postings use `PM-XXXXX` prefix (vs `DW-XXXXX` for daywork). Separate serial sequence.

### Past Start Dates

Allowed. If `start_date <= today`, the card displays "ASAP" instead of the date. This signals urgency without requiring the employer to update their posting daily.

### NDA Vessels

Same behavior as daywork. Vessel name hidden on cards, metadata (size band, type) visible. IMO revealed after selection (extend `get_vessel_public` RPC to check permanent engagements alongside daywork).

### Duplicate Postings

An employer can post both a daywork job and a permanent job for the same vessel + role simultaneously. This is legitimate — they might want a temporary deckhand now AND a permanent one for next month. No server-side prevention. Cards show the type badge (DW/PM) clearly.

---

## Discovery UX

### Toggle, Not Tabs

Top of the Discover page: `[Daywork | Permanent]` toggle.

- **Daywork mode** — existing swipe card stack + existing tabs (Browse / Applied / Invitations). **Zero changes to existing components.**
- **Permanent mode** — scrollable job feed (Browse only). **New `<PermanentJobFeed>` component.**

**The toggle only affects Browse.** The Applied tab shows both daywork and permanent applications in a unified list with clear type badges (DW-XXXXX / PM-XXXXX), fetched via `Promise.all` from both APIs (error if either fails). The Invitations tab remains daywork-only (permanent invitations are not part of launch).

### Permanent Job Cards (Scrollable)

Each card in the permanent feed shows:

- Role name + department + epaulette badge
- Vessel name (or "NDA Vessel"), type (M/Y / S/Y), size band, LOA
- Location (port, city, region)
- Salary (exact or range) + period
- Live aboard badge
- Required certifications (listed, not just count)
- Experience bracket
- Start date (or "ASAP")
- Shortlist capacity ("Shortlist: up to X candidates") — static, set at post time, not a live count
- Job reference number (PM-XXXXX)
- "Posted by {name}" (tappable to profile overlay)
- "Posted X days ago" — relative timestamp from `created_at`

**No competition metrics on cards.** No live shortlist fill count, no "candidate under consideration" indicator. Crew see only the posting details and their own application state.

**Tap** → expands to full detail view with notes, vessel details, employer profile link.

**"Apply" button** → explicit action (no swipe), with optional message (250 chars). Cert-gated (see below).

### Filters (Permanent Mode)

| Filter             | Type              | Notes                                       |
| ------------------ | ----------------- | ------------------------------------------- |
| Role               | dropdown          | Same yacht_roles lookup                     |
| Location           | LocationPicker    | Same hierarchical picker                    |
| Salary min         | number input      | Filters salary_max >= input                 |
| Live aboard        | yes/no/any toggle |                                             |
| Certification      | dropdown          | Same certs lookup                           |
| Experience bracket | dropdown          | Same brackets lookup                        |
| Vessel size band   | dropdown          | Post-fetch filter (same pattern as daywork) |

**Not included** (daywork-only): date range, working days.

### Sort Order

Default: most recently posted first. No other sort options in MVP. Recency is fair and transparent — no algorithmic weighting.

### Pagination

Cursor-based, same pattern as daywork discover (Stage 86). Load 20 postings per page. Scroll to bottom triggers next page fetch.

---

## Certification Hard-Gating

### The Rule

For permanent postings, crew **cannot apply** if they do not hold all required certifications declared on the posting.

This is a hard server-side check, not a UI hint. The apply route checks:

```
crew.certification_ids ⊇ posting.required_certification_ids
```

If the crew is missing any required cert → append `PERMANENT.APPLICATION_BLOCKED` event (intelligence record, no state change) → return 403 with a clear response listing the missing cert names.

### UI Treatment

Before the apply button, if the crew is missing certs:

- Apply button disabled
- Message: "This role requires [cert names]. Update your profile to apply."
- Links to profile edit (cert section)

### Cert Updates After Apply

If crew removes a declared cert from their profile after applying, the existing application stays valid. The cert check is at apply-time only — not retroactive. The employer sees the crew's current profile at review time and can reject if certs no longer match.

### Rationale

For daywork, certs are soft (advisory) because urgency matters more. For permanent, they are hard because the stakes are higher and the hiring process is deliberate.

---

## Permanent Availability Model

### Profile-Level, Not Date-Based

Daywork uses a 14-day rolling window with 7-day expiry. This doesn't apply to permanent job seekers — a crew member on a 3:3 rotation who is permanently employed but open to better offers doesn't have "available dates."

New columns on `profiles` (additive — no existing columns changed):

| Column                   | Type      | Values                                                   |
| ------------------------ | --------- | -------------------------------------------------------- |
| `permanent_availability` | `text`    | `'immediate' \| 'after_notice' \| 'not_looking' \| null` |
| `notice_period_days`     | `integer` | e.g., 30, 60, 90. Only relevant when `after_notice`.     |
| `currently_employed`     | `boolean` | Displayed on applicant cards.                            |

### Display on Applicant Cards (Employer View)

- "Available immediately" (green)
- "Available — 30 day notice period" (amber)
- "Currently employed — 60 day notice period" (amber)
- `not_looking` → crew with this status are excluded from permanent discovery

### Not a Gate

Unlike daywork availability (which blocks applications server-side), permanent availability is **information for the employer**, not an enforcement mechanism. A crew member with a 90-day notice period can still apply. The employer decides if they can wait.

Exception: `not_looking` excludes from the permanent feed entirely (server-side filter).

### UI

Profile page gains a "Career status" section (crew hat only) — visually separate from "Daywork availability":

- Toggle: "Open to permanent opportunities"
- If yes: "Available immediately" / "Available after notice period" (+ days input)
- "Currently employed" checkbox

---

## The Permanent Hiring Funnel (MVP)

```
EMPLOYER POSTS PERMANENT JOB
  salary, certs (hard gate), live_aboard, shortlist_cap
  posting status: active
      │
      ▼
CREW BROWSE SCROLLABLE FEED
  cert-gated apply, optional message
  application status: applied
      │
      ▼
EMPLOYER REVIEWS APPLICATIONS (scrollable list, not card stack)
  sees availability info, certs, experience
  review page shows banner during negotiation: "Currently in negotiation with {name}"
      │
      ▼
SHORTLIST (capped)
  crew see "Shortlisted (1 of 5)" in notification
  crew see "Shortlisted" badge on their application card
  shortlisted crew do NOT see when another candidate is selected
      │
      ▼
SELECT CANDIDATE — NEGOTIATION BEGINS
  posting status → in_negotiation
  selected crew: application → selected, engagement opens, chat active
  other shortlisted: STAY in shortlisted (not rejected, not notified)
  selected candidate shown on Shortlist tab with "In negotiation" badge (employer view only)
      │
      ├──► CONFIRM PLACEMENT
      │      employer declares "Placement successful"
      │      posting status → filled
      │      engagement STAYS ACTIVE (crew needs chat for logistics)
      │      remaining shortlisted → not_selected ("This role has been filled")
      │      either party can close engagement later when communication is done
      │
      ├──► REVERT SELECTION
      │      employer declares "Not proceeding with this candidate"
      │      engagement closed (not_successful)
      │      selected application → not_selected
      │      posting status → active (back to shortlist)
      │      employer can select another shortlisted candidate
      │
      ├──► CREW WITHDRAWS
      │      crew closes engagement (withdrew)
      │      engagement closed
      │      selected application → withdrawn
      │      posting status → active (back to shortlist)
      │      employer can select another shortlisted candidate
      │
      └──► EMPLOYER CANCELS POSTING
             posting status → cancelled
             if in_negotiation: engagement also closed (not_successful)
             all pending/shortlisted → rejected
             selected (if any) → not_selected
```

### Why This Funnel

This mirrors real-world yachting hiring. A captain shortlists candidates, picks one to talk to, checks references and certs informally in chat, and either confirms or moves on to the next candidate. The shortlist is a pipeline, not a one-shot decision.

### Cross-Type Overlap

A crew member can have active daywork engagements AND permanent applications/negotiations simultaneously. This is by design — crew commonly do daywork while interviewing for permanent positions. There is no cross-type overlap check. The crew manages their own commitments and communicates via chat. Crew cancellation of daywork "found other work" already exists for exactly this scenario.

### Multiple Permanent Applications

A crew member can apply to unlimited permanent postings simultaneously. No limit, no overlap check. Permanent hiring is a longer process and crew legitimately interview with multiple employers. Crew's responsibility to manage.

---

## Event Types (`PERMANENT.*` Namespace)

All permanent events live in the `PERMANENT.*` namespace. **No existing event types are reused or modified.** This ensures zero contamination of existing `apply_projection` handlers.

| Event                             | Aggregate Type | Payload                                                                                               | Handler                                                                                                                                                                                                                                     |
| --------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERMANENT.POSTED`                | `permanent`    | All posting fields                                                                                    | Insert into `permanent_postings`                                                                                                                                                                                                            |
| `PERMANENT.APPLIED`               | `permanent`    | `crew_person_id`, `message`, `permanent_posting_id`                                                   | Insert into `applications` with `permanent_posting_id`, status `applied`                                                                                                                                                                    |
| `PERMANENT.APPLICATION_BLOCKED`   | `permanent`    | `crew_person_id`, `permanent_posting_id`, `missing_certification_ids`                                 | No state change. Append-only intelligence record. Crew attempted to apply but was blocked by cert requirements. Feeds Docky cert gap analysis.                                                                                              |
| `PERMANENT.SHORTLISTED`           | `permanent`    | `crew_person_id`                                                                                      | Update application status → `shortlisted`, enforce cap                                                                                                                                                                                      |
| `PERMANENT.REJECTED`              | `permanent`    | `crew_person_id`                                                                                      | Update application status → `rejected`                                                                                                                                                                                                      |
| `PERMANENT.SELECTED`              | `permanent`    | `crew_person_id`                                                                                      | Update application → `selected`, create engagement (with `permanent_posting_id`), set posting `status` → `in_negotiation`                                                                                                                   |
| `PERMANENT.PLACEMENT_CONFIRMED`   | `permanent`    |                                                                                                       | Set posting `status` → `filled`. Remaining shortlisted/applied → `not_selected` with generic rejection. Engagement stays active.                                                                                                            |
| `PERMANENT.SELECTION_REVERTED`    | `permanent`    |                                                                                                       | Close engagement (`not_successful`). Set selected application → `not_selected`. Set posting `status` → `active`.                                                                                                                            |
| `PERMANENT.WITHDRAWN`             | `permanent`    | `crew_person_id`                                                                                      | Set application → `withdrawn`. If application was `selected`: close engagement (`withdrew`), set posting `status` → `active`.                                                                                                               |
| `PERMANENT.CANCELLED_BY_EMPLOYER` | `permanent`    | `reason`                                                                                              | Set posting → `cancelled`. Reject all pending/shortlisted/applied. If posting was `in_negotiation`: also close engagement (`not_successful`), set selected application → `not_selected`.                                                    |
| `PERMANENT.ENGAGEMENT_CLOSED`     | `permanent`    | `outcome` (`successful_placement` / `not_successful` / `withdrew`), `closed_by` (`crew` / `employer`) | Update engagement status → closed with outcome. If `withdrew` by crew: also set posting `status` → `active` (same as revert).                                                                                                               |
| `PROFILE.UPDATED`                 | existing       | Extended payload with `permanent_availability`, `notice_period_days`, `currently_employed`            | The profile is entity-scoped, not hat-scoped. Writing new nullable columns to the same profile row is the handler doing its job — not contamination. New fields default to NULL if absent from payload. Existing profile writes unaffected. |

**`PERMANENT.VIEWED` deferred.** Applications go directly from `applied` to `shortlisted` or `rejected`. The employer review page is a scrollable list (not a card stack), so there's no implicit "viewed" gesture. New-applicant notifications route to the review page and clear on open. Add `VIEWED` post-MVP if crew request "has the employer seen my application?" visibility.

### Why No Reuse of `APPLICATION.WITHDRAWN` or `ENGAGEMENT.CLOSED`

`APPLICATION.WITHDRAWN` has an existing handler in `apply_projection` that sets `status = 'withdrawn'` — and nothing else. For permanent withdrawals, we also need to close the engagement and revert the posting status. Modifying the existing handler would violate zero contamination. `PERMANENT.WITHDRAWN` has its own handler that does both.

`ENGAGEMENT.CLOSED` would be a new generic event type that could accidentally be fired on daywork engagements by a future bug. `PERMANENT.ENGAGEMENT_CLOSED` keeps it scoped — the handler explicitly operates on `permanent_posting_id` and no-ops if absent.

### Aggregate Type

New value `'permanent'` added to `events_aggregate_type_check` CHECK constraint.

### Posting Status Machine

```
active → in_negotiation (on SELECTED)
in_negotiation → filled (on PLACEMENT_CONFIRMED)
in_negotiation → active (on SELECTION_REVERTED or WITHDRAWN)
active → cancelled (on CANCELLED_BY_EMPLOYER)
in_negotiation → cancelled (on CANCELLED_BY_EMPLOYER — also closes engagement)
```

### Application Status Machine (Permanent)

```
applied → shortlisted → selected → (stays selected until placement/revert/cancel)
applied → rejected (employer rejects)
applied → withdrawn (PERMANENT.WITHDRAWN)
applied → not_selected (on PLACEMENT_CONFIRMED or CANCELLED_BY_EMPLOYER)
shortlisted → selected | rejected | withdrawn | not_selected
selected → not_selected (on SELECTION_REVERTED or CANCELLED_BY_EMPLOYER)
selected → withdrawn (PERMANENT.WITHDRAWN by crew)
```

### Crew-Visible Application States

Crew see only these states on their application cards:

- **Under review** — application submitted, not yet shortlisted (`applied` status)
- **Shortlisted** — employer added to shortlist (`shortlisted` status)
- **Selected** — in negotiation, chat open (`selected` status)
- **Position filled** — another candidate was placed (`not_selected` status)
- **Position closed** — posting cancelled (`rejected` or `not_selected` via cancellation)
- **Withdrawn** — crew withdrew (`withdrawn` status)

No competition metrics. No "X candidates ahead of you." No "employer is considering someone else."

### How to Query the Currently Selected Candidate

No `selected_person_id` column. Instead:

```sql
SELECT crew_person_id FROM applications
WHERE permanent_posting_id = $1 AND status = 'selected'
LIMIT 1
```

Single indexed query. Zero sync risk across handlers.

---

## Shortlist Mechanics

### Cap

Employer declares `shortlist_cap` at posting time (default 5).

**Crew see:**

- On the posting card: "Shortlist: up to X candidates" — static capacity, not live fill count
- On shortlist notification: "You've been shortlisted (1 of 5)" — their position gives context
- On their application card: "Shortlisted" badge

**Crew do NOT see:** how many candidates are currently shortlisted, whether another candidate is selected, or when selection is reverted. From their perspective, they stay in "Shortlisted" until:

- They are selected (notification + engagement opens)
- The role is filled (notification: "This role has been filled")
- Their application is rejected by the employer
- The posting is cancelled

### Enforcement

`PERMANENT.SHORTLISTED` handler in `apply_projection` counts existing shortlisted + selected applications for the posting. If count >= cap, the shortlist attempt is a no-op.

API layer also pre-checks and returns 400 with clear message: "Shortlist is full (X of Y)".

### Monetisation (Deferred)

- Free tier: 5 shortlist spots per posting (hardcoded default)
- Paid tier: increased cap — deferred until Stripe products are configured
- Cap is not editable after posting in MVP

---

## Engagement Lifecycle (Permanent)

### Simpler Than Daywork

Permanent engagements do NOT have:

- Work started confirmation
- Postponement
- Completion confirmation
- Ratings
- Pre-arrival checklist

### The Arc (MVP)

1. **Selection** → engagement created, status `active`, message thread opens, posting enters `in_negotiation`
2. **Negotiation** → employer and crew chat, exchange info, discuss terms
3. **Resolution** → one of:
   - Employer confirms placement → `PERMANENT.PLACEMENT_CONFIRMED` (engagement stays active for logistics)
   - Employer reverts selection → `PERMANENT.SELECTION_REVERTED` (engagement closed)
   - Crew withdraws → `PERMANENT.WITHDRAWN` (engagement closed, posting reverts)
   - Employer cancels posting → `PERMANENT.CANCELLED_BY_EMPLOYER` (engagement closed if exists)
4. **Post-placement** → engagement remains active for ongoing communication (start logistics, documents)
5. **Close** → either party closes via `PERMANENT.ENGAGEMENT_CLOSED` when communication is complete

### Chat Actions (Permanent Engagement)

**During negotiation (posting = `in_negotiation`):**

Kebab menu — Employer: "Confirm placement" / "Not proceeding" / "View profile" / "Cancel posting"
Kebab menu — Crew: "Withdraw" / "View profile"

**After placement confirmed (posting = `filled`, engagement still active):**

Kebab menu — Employer: "Close conversation" / "View profile"
Kebab menu — Crew: "Close conversation" / "View profile"

**Confirmation dialogs:**

- "Confirm placement" → "Confirm that {name} has been placed as {role}? This will close the posting and notify other shortlisted candidates."
- "Not proceeding" → "Not proceeding with {name}? This will close the conversation and return you to the shortlist."
- "Close conversation" → "Close this conversation? It will move to your message history."

### Post-Close

- Engagement thread moves to History tab in messages
- If placement confirmed: posting → `filled`, shortlisted → `not_selected` with notification, engagement stays active
- If reverted/withdrew: posting → `active`, employer returns to review page with remaining shortlist
- If engagement closed after placement: thread becomes read-only in History

---

## `applications` Table Extension

Add two nullable columns:

| Column                 | Type                           | Notes                         |
| ---------------------- | ------------------------------ | ----------------------------- |
| `permanent_posting_id` | `uuid` FK → permanent_postings | NULL for daywork applications |
| `rejection_reason`     | `text`                         | Generic message only in MVP   |

Add new status values to the CHECK constraint:

- `selected` — employer chose this candidate for negotiation
- `not_selected` — another candidate was placed, or selection reverted, or posting cancelled

### XOR Enforcement

`CHECK ((daywork_id IS NOT NULL) != (permanent_posting_id IS NOT NULL))` — every application belongs to exactly one type.

### Why Daywork Supersede Is Safe

The daywork `DAYWORK.ACCEPTED` handler supersedes overlapping applications via:

```sql
WHERE crew_person_id = ... AND daywork_id IN (
  SELECT d2.id FROM dayworks d2 JOIN dayworks d1 ON ...
  WHERE d2.start_date <= d1.end_date AND d2.end_date >= d1.start_date
)
```

Permanent applications have `daywork_id = NULL`. NULL fails the `IN (...)` subquery. Permanent applications are invisible to daywork supersede logic. **Zero contamination.**

---

## `active_engagements` Table Extension

Add one nullable column:

| Column                 | Type                           | Notes                        |
| ---------------------- | ------------------------------ | ---------------------------- |
| `permanent_posting_id` | `uuid` FK → permanent_postings | NULL for daywork engagements |

### XOR Enforcement

`CHECK ((daywork_id IS NOT NULL) != (permanent_posting_id IS NOT NULL))` — every engagement belongs to exactly one type.

Add `outcome` column:

| Column    | Type                                                        | Notes                              |
| --------- | ----------------------------------------------------------- | ---------------------------------- |
| `outcome` | `text` CHECK (successful_placement/not_successful/withdrew) | NULL until closed. Permanent only. |

### Messages API — Dual Join

The conversations API (`GET /api/messages`) gains a LEFT JOIN to `permanent_postings` alongside the existing `dayworks` join. The response object gains a `type: 'daywork' | 'permanent'` field. Client renders the appropriate summary card based on type.

This is the one additive change to an existing route. The existing daywork join is untouched — the permanent join is added alongside it.

### Messages Table

No changes. Permanent engagements appear in the same messages list. The chat page detects which FK is set and renders the appropriate summary card:

- `daywork_id` set → existing daywork summary (role, vessel, dates, day rate, meals)
- `permanent_posting_id` set → new permanent summary (role, vessel, salary, live aboard, start date)

---

## API Routes (All New)

```
POST   /api/permanent                    — Create permanent posting
GET    /api/permanent/discover           — Scrollable feed (crew)
GET    /api/permanent/mine               — Employer's permanent postings
GET    /api/permanent/applications       — Crew's permanent applications
POST   /api/permanent/:id/apply          — Cert-gated application
GET    /api/permanent/:id/review         — Applicants + shortlist (scrollable list)
POST   /api/permanent/:id/shortlist      — Shortlist a candidate
POST   /api/permanent/:id/select         — Select candidate (enters negotiation)
POST   /api/permanent/:id/reject         — Reject a candidate
POST   /api/permanent/:id/confirm        — Confirm placement (fills posting)
POST   /api/permanent/:id/revert         — Revert selection (back to shortlist)
POST   /api/permanent/:id/cancel         — Cancel posting
POST   /api/permanent/:id/withdraw       — Crew withdraws application (PERMANENT.WITHDRAWN)
POST   /api/permanent/engagements/:id/close — Close permanent engagement (PERMANENT.ENGAGEMENT_CLOSED)
GET    /api/permanent/templates           — List permanent templates
POST   /api/permanent/templates           — Save permanent template
PATCH  /api/permanent/templates/:id       — Update permanent template
DELETE /api/permanent/templates/:id       — Delete permanent template
```

**No changes to any existing `/api/daywork/*` routes.**

**Hat validation:** All employer routes validate `person.current_hat` is `'employer'` or `'agent'`. Crew routes (apply, withdraw) require `'crew'`. Same pattern as daywork.

**Close route namespacing:** `/api/permanent/engagements/:id/close` instead of `/api/engagements/:id/close` to avoid scope ambiguity. The route knows it's permanent-only.

### Security Hardening (Non-Negotiable)

Every permanent route must match daywork code quality:

- **Top-level try/catch** on every handler
- **Safe `request.json()`** with `.catch(() => ({}))` on all POST/PATCH routes
- **Hat validation** — `current_hat` check before any business logic
- **Input validation** — all required fields checked, types verified, lengths bounded
- **Ownership validation** — employer can only modify own postings
- **Status guards** — handlers check current posting/application status before transitions
- **Supabase error handling** — destructure `{ data, error }`, never discard error

### RLS Policies (Required)

All new tables must have Row Level Security enabled before use:

**`permanent_postings`:**

- SELECT: authenticated users can read `active` and `in_negotiation` postings. Owner can read all own postings (any status).
- INSERT/UPDATE: via `apply_projection` (service role) only.
- DELETE: never.

**`permanent_templates`:**

- SELECT/INSERT/UPDATE/DELETE: owner only (`employer_person_id = auth.uid()`).

**`applications` (existing table, new policy for permanent):**

- Existing daywork RLS unchanged. New: crew can read own permanent applications. Employer can read applications on own permanent postings.

---

## UI Components (All New)

| Component                        | Location                | Notes                                                                            |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `<PermanentJobFeed>`             | discover page           | Scrollable list with pagination, replaces swipe stack when toggle is "Permanent" |
| `<PermanentJobCard>`             | discover page           | Salary, certs, live-aboard, shortlist capacity (static), "Posted X days ago"     |
| `<PermanentJobDetail>`           | discover page           | Expanded detail view on tap                                                      |
| `<PostingTypeSelector>`          | post page               | Choice screen: "Daywork" or "Permanent" cards with descriptions                  |
| `<PermanentPostForm>`            | post page               | Salary, certs, live-aboard, shortlist cap fields                                 |
| `<PermanentReviewPage>`          | `/permanent/:id/review` | Applicants + Shortlist tabs, cap indicator, negotiation banner + badge           |
| `<PermanentMineSection>`         | mine page               | Toggle with badge count (postings with `applied`-status applications)            |
| `<PermanentSummaryCard>`         | chat page               | Salary, live-aboard, start date (rendered when `permanent_posting_id` is set)    |
| `<PermanentAvailabilitySection>` | profile page            | "Career status" header, toggle + notice period + employed                        |
| `<ConfirmPlacementDialog>`       | chat page               | Confirmation before finalizing hire                                              |
| `<RevertSelectionDialog>`        | chat page               | Confirmation before returning to shortlist                                       |
| `<CloseConversationDialog>`      | chat page               | Confirmation before closing post-placement conversation                          |

**No changes to existing daywork components.**

---

## Navigation Changes

### Bottom Nav (No Change)

The navbar items stay the same.

| Hat      | Nav Items                               | Change                                                                      |
| -------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Crew     | Discover / Messages / Docky / Profile   | Discover gains daywork/permanent toggle (Browse only)                       |
| Employer | Post Job / My Jobs / Messages / Profile | Post gains type selector screen. My Jobs gains permanent toggle with badge. |

### Discover Page (Crew)

- Toggle at top: `[Daywork | Permanent]` — affects Browse only
- **Daywork Browse:** existing swipe stack, unchanged
- **Permanent Browse:** new scrollable feed
- **Applied tab:** unified list of both types via `Promise.all` (DW/PM type badge on each card, error if either API fails)
- **Invitations tab:** daywork only (permanent invitations excluded from launch)

### Post Page (Employer)

- Choice screen: two cards with explicit copy:
  - **"Daywork"** — "Short-term cover, 1-14 days, hire today"
  - **"Permanent"** — "Long-term position, structured hiring with shortlist"
- Selecting either navigates to the appropriate form
- "Back" button returns to choice screen at any point
- No risk of losing input (forms are completely separate)
- Both forms require a vessel — if employer has no vessels, show "Create vessel" inline flow (shared between daywork and permanent — the only pooled UI component in the app)

### Mine Page (Employer)

- Top-level toggle: `[Daywork | Permanent]`
- Badge count on the inactive toggle: count of postings with applications in `applied` status (not yet viewed — no state tracking needed, single query)
- **Daywork tabs:** Active / In Progress / Done / Templates (unchanged)
- **Permanent tabs:** Active / In Negotiation / Filled / Cancelled / Templates

### Messages

No structural change. Permanent engagements appear in the same message list with the same Active/History tab logic. Response includes `type` field. Chat summary card adapts based on type.

---

## Notifications

Reuse the existing push/email/in-app delivery infrastructure. Add new event mappings to `push-triggers.ts`:

| Event                             | Recipient                | Title                                                     |
| --------------------------------- | ------------------------ | --------------------------------------------------------- |
| `PERMANENT.APPLIED`               | Employer                 | "New application for {role}"                              |
| `PERMANENT.SHORTLISTED`           | Crew                     | "You've been shortlisted for {role}"                      |
| `PERMANENT.SELECTED`              | Crew                     | "You've been selected for {role} — check your messages"   |
| `PERMANENT.REJECTED`              | Crew                     | "Update on your {role} application"                       |
| `PERMANENT.PLACEMENT_CONFIRMED`   | Selected crew            | "Congratulations — your placement as {role} is confirmed" |
| `PERMANENT.PLACEMENT_CONFIRMED`   | Non-selected shortlisted | "The {role} position has been filled"                     |
| `PERMANENT.SELECTION_REVERTED`    | Previously selected crew | "The employer is reviewing other candidates for {role}"   |
| `PERMANENT.CANCELLED_BY_EMPLOYER` | All applicants           | "{role} posting has been closed"                          |
| `PERMANENT.ENGAGEMENT_CLOSED`     | Other party              | "Conversation closed"                                     |

No broadcast notifications for permanent postings in MVP — permanent is deliberate, not urgent.

---

## Deferred to Post-MVP

These features are designed but not built in the initial implementation. Each can be added incrementally without touching MVP code.

| Feature                      | Why deferred                                                                                    | Trigger to build                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Employer invitations**     | Headhunting risks agency trust at launch.                                                       | Post-launch, when agency relationships are established.        |
| **Reasoned rejection**       | Generic message sufficient for MVP.                                                             | When employers report generic rejections feel impersonal.      |
| **Comparison tool**          | Employers can open profile overlays manually.                                                   | When employers with 5+ shortlisted report difficulty choosing. |
| **Cert upload window**       | Requires Storage lifecycle + cleanup cron.                                                      | When employers need to verify certs before finalising.         |
| **Weekly check-in cron**     | Another cron + notification type.                                                               | When abandoned permanent engagements appear in real data.      |
| **Downloadable reports**     | CSV/PDF export.                                                                                 | When captains/HODs need offline comparison.                    |
| **Negotiation timeout**      | Auto-revert after N days.                                                                       | When ghosted selections become a pattern.                      |
| **`PERMANENT.VIEWED` event** | Review is scrollable list, no implicit view gesture.                                            | When crew request "has the employer seen my application?"      |
| **App feature guide**        | On-signup slideshow/overlay showing screenshotted features. General UX, not permanent-specific. | Before public launch to crew.                                  |

---

## Implementation Staging (High-Level)

> Detailed checklists will be written to `tasks/todo.md` before each stage.

### Pre-Implementation: Daywork Hardening (Stage 126b)

Before any permanent code is written, harden the 10 existing daywork engagement routes against accidental use with permanent engagement IDs. Add `AND daywork_id IS NOT NULL` to the engagement lookup query in each route. This ensures permanent engagement IDs return 404 instead of silently firing daywork events.

Routes to guard:

- `cancel-employer`, `cancel-crew`, `respond-crew-cancel`
- `propose-postponement`, `respond-postponement`, `relist-with-dates`
- `work-started`, `confirm-completion`, `rate`
- `checklist`, `checklist/toggle`

This is a defensive daywork change, not a permanent feature. Protects daywork independently.

### Staging Table

| Stage    | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Existing files modified                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **126b** | Daywork engagement route hardening — add `daywork_id IS NOT NULL` guard to 10 engagement routes (cancel-employer, cancel-crew, respond-crew-cancel, propose-postponement, respond-postponement, relist-with-dates, work-started, confirm-completion, rate, checklist, checklist/toggle)                                                                                                                                                                       | **11 daywork engagement routes** (one-line guard each)                                                                                        |
| **127**  | Schema + types + events — `permanent_postings` table, `permanent_templates` table, profile availability columns, `applications` + `active_engagements` extensions (additive columns + XOR constraints), application status CHECK update (`selected`, `not_selected`), `PERMANENT.*` event types + payloads in type system, `apply_projection` additions (new handlers only, existing handlers character-identical), aggregate_type CHECK update (`permanent`) | **Zero app files** — migration + types only                                                                                                   |
| **128**  | Post API + form — `POST /api/permanent`, `PostingTypeSelector`, `PermanentPostForm`, permanent templates CRUD, shared vessel creation inline flow                                                                                                                                                                                                                                                                                                             | Post page gains type selector (minimal edit)                                                                                                  |
| **129**  | Discover API + scrollable UI — `GET /api/permanent/discover` with own exclusion query (applications WHERE `permanent_posting_id`), `PermanentJobFeed` + `PermanentJobCard` + `PermanentJobDetail`, toggle on discover page, cursor pagination, "Posted X days ago", shortlist capacity display (static), no competition metrics                                                                                                                               | Discover page gains toggle (minimal edit)                                                                                                     |
| **130**  | Apply + cert hard-gate + availability — `POST /api/permanent/:id/apply` (cert superset check + `PERMANENT.APPLICATION_BLOCKED`), `PermanentAvailabilitySection` on profile, `PROFILE.UPDATED` extended payload, availability route permanent engagement context                                                                                                                                                                                               | Profile page gains "Career status" section. **Availability route** gains LEFT JOIN to `permanent_postings` for engagement role display.       |
| **131**  | Crew applications — `GET /api/permanent/applications`, unified Applied tab with type badges via `Promise.all`, `PERMANENT.WITHDRAWN`                                                                                                                                                                                                                                                                                                                          | Discover page Applied tab shows both types (minimal edit)                                                                                     |
| **132**  | Review + shortlist + select — `GET /api/permanent/:id/review` (scrollable list, no card stack), shortlist (capped), select (enters negotiation, creates engagement), `PermanentReviewPage` with negotiation banner + badge (employer-only view). **Profile view context** updated to check permanent relationships alongside daywork.                                                                                                                         | **Profile view route** gains permanent relationship check (additive OR branch). Otherwise new page + routes.                                  |
| **133**  | Negotiation resolution — confirm/revert routes, `ConfirmPlacementDialog`, `RevertSelectionDialog`, posting status transitions, cancellation-during-negotiation engagement close                                                                                                                                                                                                                                                                               | **Zero** — new routes + components                                                                                                            |
| **134**  | Mine page — `GET /api/permanent/mine`, `PermanentMineSection` with toggle + badge count, permanent tabs (Active/In Negotiation/Filled/Cancelled/Templates)                                                                                                                                                                                                                                                                                                    | Mine page gains toggle (additive)                                                                                                             |
| **135**  | Chat integration — `PermanentSummaryCard`, permanent-specific kebab menu (negotiation vs post-placement actions), `CloseConversationDialog`, NDA reveal for permanent engagements (`get_vessel_public` extended). **Messages context API** gains LEFT JOIN to `permanent_postings` with nested selects (role, vessel, salary). **Messages list API** gains LEFT JOIN to `permanent_postings` + `type` field in response.                                      | **Messages context route** (dual join). **Messages list route** (dual join + type field). Chat page gains summary card variant + menu branch. |
| **136**  | Notifications + polish — push/email for permanent events, **push-triggers** gains permanent event handlers + `permanent_posting_id` resolution for PM-XXXXX job numbers. **Engagement-starts cron** resolves role from permanent_postings when `daywork_id` is null. **GDPR export** includes permanent applications, engagements, and postings. **Admin engagements** includes `permanent_posting_id` in response. Empty states, edge cases, documentation.  | **push-triggers.ts**, **engagement-starts cron**, **account/export**, **admin/engagements** (all additive modifications).                     |

### Existing-File Modification Summary

Files modified across all stages (excluding Stage 126b which is pre-implementation daywork hardening):

| Existing file                                                           | Stage | Change                                                                                      |
| ----------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `packages/types/src/events.ts`                                          | 127   | Add `PERMANENT.*` event types + payloads to `EventPayloadMap`, `EventType`, `AggregateType` |
| `packages/types/src/models.ts`                                          | 127   | Add `PermanentPosting`, `PermanentTemplate` interfaces                                      |
| `packages/types/src/enums.ts`                                           | 127   | Add permanent-related enums if needed                                                       |
| Post page (`daywork/post/page.tsx`)                                     | 128   | Add `PostingTypeSelector` as entry screen                                                   |
| Discover page (`discover/page.tsx`)                                     | 129   | Add toggle between daywork swipe stack and `PermanentJobFeed`                               |
| Profile page (`profile/page.tsx`)                                       | 130   | Add "Career status" section                                                                 |
| Availability route (`api/availability/route.ts`)                        | 130   | Add LEFT JOIN to `permanent_postings` for engagement role context                           |
| Discover Applied tab                                                    | 131   | `Promise.all` fetch from both APIs, type badges                                             |
| Profile view route (`api/profile/[personId]/route.ts`)                  | 132   | Add permanent relationship check (OR branch on permanent_postings join)                     |
| Messages context route (`api/messages/[engagementId]/context/route.ts`) | 135   | Add LEFT JOIN to `permanent_postings` with nested selects                                   |
| Messages list route (`api/messages/route.ts`)                           | 135   | Add LEFT JOIN to `permanent_postings` + `type` field                                        |
| Chat page (`messages/[engagementId]/page.tsx`)                          | 135   | Branch on engagement type for summary card + kebab menu                                     |
| Mine page (`daywork/mine/page.tsx`)                                     | 134   | Add toggle with badge count                                                                 |
| `push-triggers.ts`                                                      | 136   | Add `PERMANENT.*` event handlers, `permanent_posting_id` resolution                         |
| Engagement-starts cron (`api/cron/engagement-starts/route.ts`)          | 136   | Resolve role from permanent_postings when `daywork_id` is null                              |
| GDPR export (`api/account/export/route.ts`)                             | 136   | Add permanent applications, engagements, postings to export                                 |
| Admin engagements (`api/admin/engagements/route.ts`)                    | 136   | Add `permanent_posting_id` to response                                                      |

**Total existing files modified:** 17 (across stages 128-136) + 11 (Stage 126b hardening) = 28
**Total new files created:** ~30+ (routes, components, migration, rollback, tests)
**Daywork logic modified:** Zero. All existing-file changes are additive (LEFT JOINs, OR branches, new fields). No existing query filters, event handlers, or business logic is altered.

---

## What This Does NOT Change

- `dayworks` table — **zero column changes, zero constraint changes**
- `daywork_templates` table — **untouched**
- Daywork swipe mechanic — untouched
- Daywork engagement lifecycle — untouched (Stage 126b adds type guards, but no logic change)
- Daywork availability model (14-day rolling window) — untouched
- Daywork cert model (soft/advisory) — untouched
- Daywork API route logic — untouched (existing query filters, event handlers, and business logic identical)
- Daywork components — untouched
- Daywork supersede logic — untouched (permanent applications invisible to it — verified: NULL `daywork_id` fails the `IN(...)` subquery)
- Existing `apply_projection` handlers — **character-identical** before and after (documented exceptions: `PROFILE.UPDATED` + `get_vessel_public`)
- Existing event types — no reuse, no modification
- `permanent_opportunity` badge on daywork — stays as-is (separate concern from `PERMANENT.*` system)
- Existing Stripe scaffolding — untouched (monetisation deferred)
- Docky AI advisor — untouched (will benefit from `PERMANENT.APPLICATION_BLOCKED` intelligence without code changes)

### What This DOES Change in Existing Files

Shared infrastructure files gain additive modifications (LEFT JOINs, OR branches, new response fields). See "Existing-File Modification Summary" in staging section for the complete list. All modifications are:

- **Additive** — no existing queries, filters, or logic removed or altered
- **Null-safe** — permanent fields default to NULL in daywork contexts
- **Backward-compatible** — existing daywork UI reads the same response fields as before

---

## Resolved Decisions

| #   | Question                                 | Decision                                | Rationale                                                                                                                                     |
| --- | ---------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Downloadable comparison format           | **Deferred**                            | Build when employers with 5+ shortlisted report difficulty choosing                                                                           |
| 2   | Invitation pricing model                 | **Deferred**                            | Invitations excluded from launch entirely — agency trust risk                                                                                 |
| 3   | Should permanent postings expire?        | **No auto-expiry**                      | Stay active until employer cancels or position filled                                                                                         |
| 4   | Can employer re-open a closed posting?   | **No — create new**                     | Cleaner ledger. Old posting history stays intact.                                                                                             |
| 5   | Non-selected crew see rejection reason?  | **Generic only**                        | "This role has been filled" / "Another candidate was chosen"                                                                                  |
| 6   | Comparison tool for daywork?             | **Deferred**                            | Permanent only when built                                                                                                                     |
| 7   | Salary visibility                        | **Always visible**                      | Transparency is a core principle                                                                                                              |
| 8   | Event namespace                          | **`PERMANENT.*` — all events**          | No reuse of existing event types. Zero handler contamination.                                                                                 |
| 9   | Agency-specific features                 | **Same as employers**                   | Differentiate post-launch based on usage data                                                                                                 |
| 10  | Sort order                               | **Recency (newest first)**              | Fair, transparent, no algorithmic weighting                                                                                                   |
| 11  | Pagination                               | **Cursor-based, 20 per page**           | Same pattern as daywork discover                                                                                                              |
| 12  | Past start dates                         | **Allowed, displayed as "ASAP"**        | Signals urgency without daily updates                                                                                                         |
| 13  | NDA vessels                              | **Same as daywork**                     | Hidden on cards, revealed after selection                                                                                                     |
| 14  | Duplicate postings (DW + PM same vessel) | **Allowed**                             | Legitimate use case, clear type badges                                                                                                        |
| 15  | Cert update after apply                  | **Not retroactive**                     | Cert check at apply-time only                                                                                                                 |
| 16  | Hat validation                           | **All routes**                          | Same pattern as daywork — employer/agent for posting, crew for apply                                                                          |
| 17  | Viewed event                             | **Deferred**                            | Review is scrollable list, no implicit view gesture. See decision #32.                                                                        |
| 18  | Cross-type overlap                       | **No guard**                            | Crew manage own commitments. Daywork crew-cancel "found other work" handles this.                                                             |
| 19  | Multiple permanent applications          | **No limit**                            | Legitimate — longer hiring cycles mean parallel interviews                                                                                    |
| 20  | Positions per posting                    | **Always 1**                            | Deliberate hiring, not batch. Two positions = two postings.                                                                                   |
| 21  | `selected_person_id` on posting          | **Dropped**                             | Query on demand from applications. Zero sync risk.                                                                                            |
| 22  | Cancellation during negotiation          | **Auto-closes engagement**              | Prevents orphaned active engagement on cancelled posting.                                                                                     |
| 23  | Placement → engagement state             | **Stays active**                        | Crew needs chat for start logistics. Close explicitly later.                                                                                  |
| 24  | Discovery during negotiation             | **Visible, no indicator**               | Posting stays in feed during negotiation. No "candidate under consideration" — see decision #30. Crew can still apply.                        |
| 25  | Review during negotiation                | **Banner + badge**                      | "Currently in negotiation with {name}." Selected shown on shortlist with badge.                                                               |
| 26  | Applied tab implementation               | **`Promise.all` both APIs**             | Error if either fails. Unified list with type badges.                                                                                         |
| 27  | Mine badge definition                    | **Postings with `applied`-status apps** | Single query, no state tracking.                                                                                                              |
| 28  | Withdrawal event                         | **`PERMANENT.WITHDRAWN`**               | Separate from `APPLICATION.WITHDRAWN` to avoid handler contamination.                                                                         |
| 29  | Engagement close event                   | **`PERMANENT.ENGAGEMENT_CLOSED`**       | Scoped to permanent namespace. Cannot accidentally fire on daywork.                                                                           |
| 30  | Competition metrics on crew view         | **Removed entirely**                    | No live shortlist counts, no "candidate under consideration." Crew see only own states.                                                       |
| 31  | Shortlist count display                  | **Static capacity only**                | "Shortlist: up to 5" on card, "1 of 5" in notification. No live fill count.                                                                   |
| 32  | `PERMANENT.VIEWED`                       | **Deferred**                            | Review is scrollable list, not card stack. No implicit "viewed" gesture. Add post-MVP.                                                        |
| 33  | Posting age indicator                    | **"Posted X days ago"**                 | On all permanent cards. Lets crew self-filter stale postings.                                                                                 |
| 34  | Post choice screen copy                  | **Explicit descriptions**               | "Daywork — Short-term cover, 1-14 days" / "Permanent — Long-term position, structured hiring"                                                 |
| 35  | Vessel creation flow                     | **Shared between types**                | "Create vessel" inline from both post forms. Only pooled UI component.                                                                        |
| 36  | `PROFILE.UPDATED` handler                | **Not contamination**                   | Profile is entity-scoped. Writing new nullable columns is the handler's job.                                                                  |
| 37  | RLS on new tables                        | **Required**                            | Same rigor as daywork. Policies specified in schema section.                                                                                  |
| 38  | Security hardening                       | **Match daywork exactly**               | try/catch, safe JSON, hat validation, input validation, ownership checks, status guards on every route.                                       |
| 39  | Templates                                | **Full CRUD**                           | Agencies need complete template management. Not simplified for MVP.                                                                           |
| 40  | App feature guide                        | **Deferred**                            | Simple overlay/slideshow showing features on first use. Not part of permanent spec — general onboarding improvement.                          |
| 41  | Cert-blocked application intelligence    | **`PERMANENT.APPLICATION_BLOCKED`**     | Append-only, no state change. Captures missing cert IDs when crew is blocked from applying. Highest-value signal for Docky cert gap analysis. |

---

## Contamination Checklist (For Every Stage)

Before merging any permanent jobs stage, verify:

1. `npx vitest run` — all 716+ existing tests pass (no daywork test broken)
2. `npx tsc --noEmit` — zero errors
3. `npx eslint src/ --max-warnings 0` — zero warnings
4. `grep -r "daywork" <new-files>` — new permanent files should not import from or reference daywork-specific modules (except shared infrastructure like auth, events, push)
5. `git diff apps/web/src/app/api/daywork/` — should show ONLY the Stage 126b type guards (one-line addition per route), nothing else
6. `git diff supabase/migrations/ --name-only` — only new migration files, no edits to existing migrations
7. If `apply_projection` is replaced: diff new version against previous version line-by-line. Every existing handler must be character-identical. New `PERMANENT.*` handlers are appended, not interleaved.
8. For shared-file modifications (messages API, profile view, push-triggers, GDPR export, cron, admin): verify the existing code path still produces identical output for daywork engagements. The modification must be additive (LEFT JOIN, OR branch, null coalesce) — never replacing existing logic.
9. Verify all 10 daywork engagement routes have the `daywork_id IS NOT NULL` guard from Stage 126b — permanent engagement IDs must return 404, not silently process.

**Documented exceptions (2) for `apply_projection`:**

- **`PROFILE.UPDATED` handler:** Extended to write 3 new nullable columns (`permanent_availability`, `notice_period_days`, `currently_employed`). Safe because new columns default to NULL when absent from payload. Existing profile writes unaffected.
- **`get_vessel_public` RPC:** Extended to check `permanent_posting_id` on `active_engagements` alongside existing `daywork_id` check for NDA IMO reveal. Adds an OR branch to the engagement lookup query. Existing daywork NDA reveal path unchanged — the new branch is additive.
