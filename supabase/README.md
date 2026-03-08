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

| RPC                        | Migration | Purpose                                                  |
| -------------------------- | --------- | -------------------------------------------------------- |
| `append_event`             | 00005     | Appends event to ledger + updates projections atomically |
| `onboard_person`           | 00007     | Atomic `PERSON.CREATED` + `PROFILE.CREATED`              |
| `check_no_overlap`         | 00007     | Validates no date conflicts before crew acceptance       |
| `clear_availability_dates` | 00007     | Clears availability via immediate-expiry ledger entries  |
| `get_vessel_public`        | 00007     | Returns vessel data with NDA-safe field filtering        |

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

## Currency Support

Daywork postings carry a `currency` field (CHECK: `EUR`, `USD`, `GBP`, `AED`). Default is `EUR`. The `day_rate` column is NOT NULL — every posting requires a day rate. Templates also support currency (nullable, defaults to `EUR`).

## Seed Data

`seed/001_canonical_data.sql` populates the canonical lookup tables: 7 regions, 31 cities, 55 ports/marinas, 20 yacht roles, 20 certifications, 5 experience brackets, and 6 vessel size bands.

`seed/002_test_profiles.sql` creates two fully onboarded test accounts for local development:

| Account  | Email | Password   | Hat      | Profile                                                                                                       |
| -------- | ----- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Employer | `e@1` | `12345678` | employer | "Profile One" — Captain, 5+ yrs, Port Vauban. Owns M/Y Serenity (IMO 9876543). Has 3 active daywork postings. |
| Crew     | `c@1` | `12345678` | crew     | "Profile Two" — Deckhand, 2-5 yrs, Port Vauban. 14-day availability window.                                   |

`config.toml` references both seed files. Seed data is applied automatically during `npx supabase db reset`.

## Message Hiding (Removed)

Migration 00016 removed message hiding (`hidden_by` column + `MESSAGE.HIDDEN` event handler). Messages are append-only and always visible to both engagement participants. This aligns with the truth-centric architecture — no content suppression.

## PostgREST Join Notes

`applications.crew_person_id` and `active_engagements.{crew,employer}_person_id` each have two FKs: one to `persons.id` (for referential integrity) and one to `profiles.person_id` (for PostgREST embedded selects). When using Supabase's `.select()` with nested profile data, use the explicit FK hint syntax, e.g. `profiles!applications_crew_person_id_profiles_fkey(display_name)`.
