# Supabase — DockWalker Database Layer

PostgreSQL database managed via Supabase CLI. All tables have Row Level Security enabled.

## Directory Structure

```
config.toml        Supabase local dev configuration (project_id: dockwalker_only)
migrations/        Forward migrations (numbered sequentially)
rollbacks/         Corresponding rollback for every migration (*.down.sql)
seed/              Canonical lookup data (roles, certs, locations, etc.)
```

## Migration Conventions

- Migrations are numbered `00001_`, `00002_`, etc.
- Every migration in `migrations/` MUST have a corresponding rollback in `rollbacks/` with the same number and a `.down.sql` suffix.
- Rollbacks must fully reverse the forward migration.
- Current schema version: see [BUILD_STATE.md](../BUILD_STATE.md) for the latest version and migration table.

## Local Development

```bash
npx supabase start          # Start local Supabase stack
npx supabase db reset        # Apply all migrations + seed data
npx supabase stop            # Stop local stack
```

## Remote (Linked Project)

```bash
npx supabase db push         # Apply pending migrations to linked remote
```

## RPCs

The app depends on these Postgres functions in the `public` schema:

| RPC                                           | Migration | Purpose                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `append_event`                                | 00005     | Appends event to ledger + updates projections atomically                                                                                                                                                                                                                                          |
| `onboard_person`                              | 00007     | Atomic `PERSON.CREATED` + `PROFILE.CREATED`                                                                                                                                                                                                                                                       |
| `check_no_overlap`                            | 00007     | Validates no date conflicts before crew acceptance                                                                                                                                                                                                                                                |
| `check_no_overlap_excluding`                  | 00018     | Like check_no_overlap but with explicit dates + engagement exclusion                                                                                                                                                                                                                              |
| `apply_projection` (DAYWORK.RELISTED)         | 00019     | RELISTED handler now updates dates/working_days when present in payload                                                                                                                                                                                                                           |
| `apply_projection` (WORK_STARTED)             | 00020     | Handles `ENGAGEMENT.WORK_STARTED` and `ENGAGEMENT.WORK_STARTED_CONFIRMED` events                                                                                                                                                                                                                  |
| `append_events_batch`                         | 00021     | Processes array of events in single transaction for atomic multi-event writes                                                                                                                                                                                                                     |
| `apply_projection` (CANCELLED_BY_CREW)        | 00022     | Structured crew cancellation — writes `cancelled_by`, `cancellation_reason_category`, `cancellation_reason_text` to `active_engagements`                                                                                                                                                          |
| `apply_projection` (CHECKLIST.\*)             | 00023     | Handles `CHECKLIST.SET` (upsert into `engagement_checklists`, resets acknowledgements) and `CHECKLIST.ITEM_TOGGLED` (add/remove from `acknowledged_item_ids`)                                                                                                                                     |
| `apply_projection` (AVAILABILITY.SET)         | 00024     | Writes `city_id` and `not_available` on availability windows; not-available expires existing windows and inserts marker row; normal set clears not-available markers                                                                                                                              |
| `apply_projection` (AVAILABILITY.SET port_id) | 00025     | Adds `port_id` column to `availability_windows`; updates AVAILABILITY.SET handler to write optional `port_id` on both normal and not-available paths                                                                                                                                              |
| `user_preferences` table                      | 00026     | CRUD user preferences (`profile_visible` boolean). Owner-only RLS. Not event-sourced — follows `daywork_templates` precedent.                                                                                                                                                                     |
| `clear_availability_dates`                    | 00007     | Clears availability via immediate-expiry ledger entries                                                                                                                                                                                                                                           |
| `get_vessel_public`                           | 00007     | Returns vessel data with NDA-safe field filtering (includes `loa_meters` since 00027, `vessel_type` and `vessel_operation` since 00029)                                                                                                                                                           |
| `apply_projection` (VESSEL LOA)               | 00027     | Writes `loa_meters` on `VESSEL.CREATED` insert and `VESSEL.UPDATED` update                                                                                                                                                                                                                        |
| `apply_projection` (EXPERIENCE.\*)            | 00028     | Handles `EXPERIENCE.ADDED` (insert into `crew_experiences`), `EXPERIENCE.UPDATED` (partial update), `EXPERIENCE.REMOVED` (delete). Also handles extended `PROFILE.CREATED/UPDATED` with green crew fields                                                                                         |
| `apply_projection` (EXPERIENCE enhancements)  | 00029     | Renames `vessel_type` → `vessel_operation` + new `vessel_type` (motor\|sail) on vessels; renames `charter_or_private` → `vessel_operation`, `rotation_type` → `contract_type`, `rotation_details` → `contract_details` on crew_experiences; updates all projection handlers with new column names |
| `daywork_invitations` table + events          | 00030     | `daywork_invitations` table with RLS + indexes; `DAYWORK.INVITED/INVITATION_ACCEPTED/INVITATION_DECLINED` event handlers; revocation on `DAYWORK.ACCEPTED`, `CANCELLED_BY_EMPLOYER`, `RELISTED`; auto-accept on `DAYWORK.APPLIED` when matching pending invitation exists                         |
| `derive_experience_profile`                   | 00031     | Auto-derives `experience_bracket_id` (from total days) and `vessel_size_exposure_ids` (distinct vessel size bands) on profile after `EXPERIENCE.ADDED/UPDATED/REMOVED`                                                                                                                            |
| `get_vessel_public` (NDA reveal)              | 00032     | Reveals IMO to crew with active engagement on a daywork linked to the NDA vessel (joins `active_engagements` + `dayworks`)                                                                                                                                                                        |
| `device_tokens` table                         | 00033     | `device_tokens` table with RLS, unique `(person_id, token)`, platform enum (apns/fcm/web). CRUD utility data, not event-sourced.                                                                                                                                                                  |

## Daywork Status Lifecycle

```
active -> in_progress -> completed | cancelled
active -> cancelled  (unfilled posting cancelled by employer)
```

When an applicant is accepted (`DAYWORK.ACCEPTED`), the daywork moves to `in_progress`. This hides it from discovery and blocks new applications. Remaining pending/shortlisted applicants are auto-rejected. The employer can then mark it complete or cancel it.

An `active` posting with no accepted applicant can only be cancelled — the complete API rejects `active` status with 400. Only `in_progress` postings (with an accepted crew member) can be marked as completed.

## Application State Machine

```
Applied -> Viewed -> Shortlisted | Accepted | Rejected | Withdrawn | Superseded -> Completed | Cancelled
```

`DAYWORK.SHORTLISTED` (migration 00010) moves an application to the `shortlisted` status. Shortlisted applications can still be accepted or rejected. Auto-supersede on acceptance also covers `shortlisted` applications. Withdrawal covers `shortlisted` status. On acceptance, all other pending/shortlisted applications for the same daywork are auto-rejected (migration 00011).

## Crew Completion Confirmation

After an employer marks a daywork as complete (`DAYWORK.COMPLETED`), the crew member can confirm or dispute via the ledger:

- `ENGAGEMENT.COMPLETION_CONFIRMED` — crew agrees the work was completed
- `ENGAGEMENT.COMPLETION_DISPUTED` — crew disputes the completion

The `active_engagements.crew_completion_status` column tracks this (`confirmed` | `disputed` | NULL). The daywork remains `completed` regardless of crew response — both events are recorded for audit/truth purposes.

## Engagement Ratings

After completion, both parties can rate the job/interaction (not the user). Ratings are private DockWalker intelligence — never shown to the other party.

- `ENGAGEMENT.RATED_BY_CREW` — crew rates pay accuracy, meals accuracy, role accuracy, working days accuracy, vessel condition (1-5), would-work-on-vessel-again, communication accuracy, overall match (1-5)
- `ENGAGEMENT.RATED_BY_EMPLOYER` — employer rates skills-as-advertised, certifications verified, punctuality, would-rehire, communication accuracy, overall match (1-5)

The `engagement_ratings` table stores one rating per person per engagement (UNIQUE constraint). Crew must confirm/dispute completion before rating. Employer can rate immediately after marking complete.

## Structured Employer Cancellation (Migration 00018)

Employer cancellation of in-progress engagements now requires a structured reason:

- `cancellation_reason_category` — one of: `vessel_leaving`, `crew_requirements_changed`, `vessel_operational`, `other`
- `cancellation_reason_text` — free text (required for `other`)
- `relist_requested` — whether employer wants to relist the job
- `relist_reason_category` — private relist reason (never shown to crew)

**Postponement flow:** Employers can propose new dates instead of cancelling outright. If crew has a scheduling conflict, the engagement auto-cancels and the daywork is relisted. Otherwise crew can approve or reject via system messages in chat.

**Cancellation ratings:** Both parties can rate cancelled engagements with a lighter form. Crew rates notice_given, communication, overall match. Employer rates communication, overall match.

New event types: `ENGAGEMENT.POSTPONEMENT_PROPOSED`, `ENGAGEMENT.POSTPONEMENT_ACCEPTED`, `ENGAGEMENT.POSTPONEMENT_REJECTED`, `DAYWORK.RELISTED`, `ENGAGEMENT.CANCELLATION_RATED_BY_CREW`, `ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER`.

**System messages:** The `messages` table now has an `is_system` boolean column. System messages are rendered centered in the chat UI, not as chat bubbles.

## Structured Crew Cancellation (Migration 00022)

Crew cancellation of in-progress engagements now requires a structured reason:

- `reason_category` — one of: `personal_reasons`, `found_other_work`, `unsafe_conditions`, `other`
- `reason_text` — free text (required for `other`, max 250 chars)

New `cancelled_by` column tracks who initiated the cancellation (`crew`, `employer`, or `postponement`). When crew cancels, the daywork stays `in_progress` — the employer must decide whether to relist or cancel the posting via `POST /api/engagements/:id/respond-crew-cancel`.

A system message is posted to the chat thread with the crew's reason.

## Pre-Arrival Checklist (Migration 00023)

Employers can set a pre-arrival checklist for engaged crew via `CHECKLIST.SET` events. The `engagement_checklists` table stores:

- `items` (JSONB) — array of `{ id, label, value }` objects representing checklist items
- `acknowledged_item_ids` (text[]) — item IDs the crew has checked off

Crew acknowledges items individually via `CHECKLIST.ITEM_TOGGLED` events (`item_id` + `checked` boolean). When the employer updates the checklist (`CHECKLIST.SET`), all acknowledgements are reset. Both events use `aggregateType: 'checklist'` with `aggregateId` = engagement ID.

RLS: engagement participants can read their checklist. Writes go through the service client.

## Currency Support

Daywork postings carry a `currency` field (CHECK: `EUR`, `USD`, `GBP`, `AED`). Default is `EUR`. The `day_rate` column is NOT NULL — every posting requires a day rate. Templates also support currency (nullable, defaults to `EUR`).

## Job Reference Numbers

Every daywork posting receives a sequential `job_number` (SERIAL UNIQUE) auto-assigned on row creation. Displayed as `DW-00001` format in the UI. This is a projection column for human-readable reference — the event ledger UUID remains the canonical identity.

## Seed Data

`seed/001_canonical_data.sql` populates the canonical lookup tables: 7 regions, 31 cities, 55 ports/marinas, 20 yacht roles, 20 certifications, 5 experience brackets, and 6 vessel size bands.

`seed/002_test_profiles.sql` creates two fully onboarded test accounts for local development:

| Account  | Email | Password   | Hat      | Profile                                                                                                       |
| -------- | ----- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Employer | `e@1` | `12345678` | employer | "Profile One" — Captain, 5+ yrs, Port Vauban. Owns M/Y Serenity (IMO 9876543). Has 3 active daywork postings. |
| Crew     | `c@1` | `12345678` | crew     | "Profile Two" — Deckhand, 2-5 yrs, Port Vauban. 14-day availability window.                                   |

`seed/003_advanced_scenarios.sql` adds 3 jobs in various lifecycle states using the same test accounts:

| Job    | Role       | Port              | Status      | State                                                                    |
| ------ | ---------- | ----------------- | ----------- | ------------------------------------------------------------------------ |
| DW-004 | Deckhand   | Port Hercules     | active      | Crew applied → viewed → shortlisted (awaiting decision)                  |
| DW-005 | Engineer   | Vieux Port Cannes | in_progress | Accepted, 4 messages exchanged, engagement active                        |
| DW-006 | Stewardess | Port de Nice      | completed   | Full lifecycle: accepted → messages → completed → confirmed → both rated |

`config.toml` references all three seed files. Seed data is applied automatically during `npx supabase db reset`.

## Message Hiding (Removed)

Migration 00016 removed message hiding (`hidden_by` column + `MESSAGE.HIDDEN` event handler). Messages are append-only and always visible to both engagement participants. This aligns with the truth-centric architecture — no content suppression.

## PostgREST Join Notes

`applications.crew_person_id` and `active_engagements.{crew,employer}_person_id` each have two FKs: one to `persons.id` (for referential integrity) and one to `profiles.person_id` (for PostgREST embedded selects). When using Supabase's `.select()` with nested profile data, use the explicit FK hint syntax, e.g. `profiles!applications_crew_person_id_profiles_fkey(display_name)`.
