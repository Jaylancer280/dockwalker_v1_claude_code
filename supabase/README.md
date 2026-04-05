# Supabase — DockWalker Database Layer

PostgreSQL database managed via Supabase CLI. All tables have Row Level Security enabled.

## Directory Structure

```
config.toml        Supabase local dev configuration (project_id: dockwalker_only)
migrations/        Forward migrations (numbered sequentially)
rollbacks/         Corresponding rollback for every migration (*.down.sql)
seed/              Canonical lookup data (roles, certs, locations, etc.)
templates/         Branded HTML email templates (confirmation, recovery, email_change)
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
| Vessel soft data separation                   | 00034     | Drops `vessel_operation` from vessels, drops `vessel_id` from templates, updates `apply_projection` and `get_vessel_public`                                                                                                                                                                       |
| Working day dates                             | 00035     | `working_day_dates date[]` on dayworks/templates; post-projection trigger for DAYWORK.POSTED                                                                                                                                                                                                      |
| Daywork extended                              | 00036     | `DAYWORK.EXTENDED` event handler via trigger: updates end_date, working_days, working_day_dates                                                                                                                                                                                                   |
| Missing aggregate types                       | 00037     | Adds `invitation` and `experience` to `events_aggregate_type_check` CHECK constraint                                                                                                                                                                                                              |
| Multi-crew positions                          | 00038     | `positions_available`/`positions_filled` on dayworks, `positions_available` on templates, full `apply_projection` rewrite with multi-crew fill logic, `DAYWORK.POSITIONS_UPDATED` handler, cascade cancel, no auto-revert                                                                         |
| Profile avatar                                | 00039     | `avatar_url` on profiles, `apply_projection` PROFILE.CREATED/UPDATED with avatar_url, `avatars` storage bucket with RLS (public read, owner write, 2MB max, JPEG/PNG/WebP)                                                                                                                        |
| Notifications + read cursors                  | 00040     | `message_read_cursors` table (composite PK), `notifications` table with type/title/body/deep_link/read, RLS on both, index for unread queries                                                                                                                                                     |
| Permanent opportunity                         | 00041     | `permanent_opportunity` boolean on dayworks/templates, `permanent_opportunity_accuracy` on engagement_ratings                                                                                                                                                                                     |
| Subscriptions                                 | 00042     | `subscriptions` table (person_id UNIQUE, stripe_customer_id UNIQUE, plan/status CHECK constraints), RLS owner read-only. Not event-sourced — Stripe-owned state.                                                                                                                                  |
| pgvector + MCA chunks                         | 00043     | pgvector extension, `mca_document_chunks` table with HNSW index + 1536-dim embeddings, `match_mca_documents` RPC for cosine similarity search, RLS read-only for authenticated users. Table deployed empty — MCA corpus ingestion deferred.                                                       |
| Advisor conversations + messages              | 00044     | `advisor_conversations` (person_id, title, timestamps) + `advisor_messages` (conversation FK, role user/assistant, content, sources JSONB, token counts). Cascade delete. Owner-only RLS. Not event-sourced — AI chat utility data.                                                               |
| Notification role context                     | 00045     | Adds `role_context` (crew/employer/agent CHECK) to `notifications`. Backfills by type. Replaces unread index to include role_context for hat-scoped badge queries.                                                                                                                                |
| Advisor usage tracking                        | 00046     | `advisor_usage` table (person_id + month UNIQUE, question_count). Owner read-only RLS. Tracks free tier Docky question limits (3/month). Not event-sourced — usage counter utility data.                                                                                                          |
| Advisor usage write policies                  | 00047     | Adds INSERT and UPDATE RLS policies to `advisor_usage`. Defensive hardening — owner can write own rows if regular client used accidentally.                                                                                                                                                       |
| Projection state guards                       | 00048     | Adds `AND status IN ('applied','viewed','shortlisted')` WHERE guards to DAYWORK.ACCEPTED/REJECTED in `apply_projection`; moves DAYWORK.EXTENDED handler into `apply_projection`; drops standalone trigger                                                                                         |
| Templates UPDATE policy                       | 00049     | Adds UPDATE RLS policy to `daywork_templates` — owner can update own templates                                                                                                                                                                                                                    |
| Admin role                                    | 00050     | Adds `is_admin` boolean to `persons` (default false), adds `'admin'` to `events_aggregate_type_check` CHECK constraint                                                                                                                                                                            |
| Admin projection                              | 00051     | Adds `ADMIN.ENGAGEMENT_COMPLETED` handler to `apply_projection` — same completion logic as `DAYWORK.COMPLETED` but reads daywork_id from payload                                                                                                                                                  |
| Messages Realtime                             | 00052     | Adds `messages` table to `supabase_realtime` publication. Enables Realtime subscriptions for instant message delivery on chat page.                                                                                                                                                               |
| Accept Race Guard                             | 00053     | Adds positions-full pre-check to DAYWORK.ACCEPTED handler in `apply_projection`. Concurrent accepts on a fully-filled daywork no-op instead of creating phantom fills.                                                                                                                            |
| Admin Canonical Projection                    | 00054     | Adds audit-only no-op handlers for `ADMIN.CANONICAL_ADDED` and `ADMIN.CANONICAL_UPDATED` in `apply_projection` (RAISE NOTICE instead of unknown event warning).                                                                                                                                   |
| Hybrid Roles                                  | 00055     | Expands department CHECK constraint to include `deck_engineering`, `deck_interior`, `galley_interior`. Inserts 3 hybrid roles: Deck/Engineer, Deck/Stew, Cook/Stew.                                                                                                                               |
| Invitation Source                             | 00056     | Adds `source` column (`direct`/`invitation`) to `applications`. Updates `apply_projection` DAYWORK.APPLIED handler: when `source = 'invitation'`, application is created as `shortlisted` instead of `applied`. Multi-crew invitation revocation unchanged (already position-gated).              |
| Nationality + Visas                           | 00057     | `nationalities` (40 entries, flag emoji) and `visa_types` (10 entries, region-grouped) canonical lookups with read-only RLS. `nationality_id` and `visa_ids` columns on `profiles`. Updated `apply_projection` PROFILE.CREATED/UPDATED handlers.                                                  |
| Unread Counts Function                        | 00058     | `get_unread_counts(uuid)` Postgres function — returns per-engagement unread message counts in a single query. Replaces N+1 COUNT loops in badge polling endpoints.                                                                                                                                |
| Permanent Jobs                                | 00059     | `permanent_postings` + `permanent_templates` tables, profile permanent availability columns, applications + engagements XOR extensions (`permanent_posting_id`, `outcome`), 12 `PERMANENT.*` handlers in `apply_projection`, `aggregate_type` + `application_status` CHECK updates                |
| NDA Reveal Permanent                          | 00060     | Extends `get_vessel_public` with permanent engagement OR branch for IMO reveal                                                                                                                                                                                                                    |
| Atomic Advisor Usage                          | 00061     | `increment_advisor_usage` RPC — atomic check-and-increment for free-tier Docky usage                                                                                                                                                                                                              |
| Remove Unused STCW Certs                      | 00062     | Removes 3 unused STCW certifications                                                                                                                                                                                                                                                              |
| Sea Time Columns                              | 00063     | `sea_time_days` and `sea_time_nautical_miles` on `crew_experiences` with supplementary trigger                                                                                                                                                                                                    |
| Desired Role + Auto Primary                   | 00064     | `desired_role_id` FK on profiles; `derive_experience_profile()` auto-derives `primary_role_id` from latest experience                                                                                                                                                                             |
| Deck Name                                     | 00065     | `deck_name VARCHAR(50)` on profiles with supplementary trigger                                                                                                                                                                                                                                    |
| Notification Preferences                      | 00066     | `email_enabled`, `push_jobs`, `push_applications`, `push_messages`, `push_reminders` boolean columns on `user_preferences` (all default true)                                                                                                                                                     |
| Career Status From Event                      | 00067     | Supplementary trigger `apply_career_status_from_event` writes career status fields from PROFILE.CREATED/UPDATED payloads                                                                                                                                                                          |
| Location City                                 | 00068     | `location_city_id` FK on profiles; supplementary trigger `apply_location_city_from_event` writes city from PROFILE events                                                                                                                                                                         |
| Required Languages                            | 00069     | `required_languages text[]` on dayworks, permanent_postings, templates; supplementary trigger writes from posting events                                                                                                                                                                          |
| Agent Activity Log                            | 00070     | `agent_activity_log` table with RLS for agent telemetry (market feed usage)                                                                                                                                                                                                                       |
| Fix Activity Log RLS                          | 00071     | INSERT restricted to agents, SELECT uses `is_admin` instead of nonexistent `identity_type='admin'`                                                                                                                                                                                                |
| Consolidate Triggers                          | 00072     | Merges 6 supplementary triggers into `apply_projection`; drops standalone trigger functions                                                                                                                                                                                                       |
| Availability Date Expiry                      | 00073     | Per-date availability expiry (`date + interval '1 day'`) instead of 7-day fixed window                                                                                                                                                                                                            |
| Vessels RLS Read Access                       | 00074     | 3 new SELECT policies: authenticated non-NDA read, engaged user NDA read, crew experience NDA read                                                                                                                                                                                                |
| Placement Confirmed Status                    | 00075     | `placement_confirmed` application status; PERMANENT.PLACEMENT_CONFIRMED marks selected application terminal                                                                                                                                                                                       |
| Seed Experience Brackets                      | 00076     | Seeds 5 experience bracket rows for production; idempotent `ON CONFLICT DO NOTHING`                                                                                                                                                                                                               |
| Permanent Post Fields                         | 00077     | Adds `contract_type`, `contract_details`, `description`, `meals`, `positions_available`, `positions_filled` to permanent_postings + templates; updates PERMANENT.POSTED handler                                                                                                                   |
| Custom Access Token Hook                      | 00078     | `custom_access_token_hook(jsonb)` — injects `person_id`, `current_hat`, `identity_type`, `onboarded`, `deactivated` into JWT `app_metadata`. Requires dashboard enablement (Auth → Hooks → Custom Access Token).                                                                                  |
| Batch Vessel Lookup                           | 00079     | `get_vessels_public_batch(uuid[])` — batch version of `get_vessel_public`, same NDA logic, `WHERE id = ANY(p_vessel_ids)`                                                                                                                                                                         |
| Smoker + Visible Tattoos                      | 00080     | Adds nullable `smoker boolean` and `visible_tattoos boolean` to profiles; updates `apply_projection` PROFILE.CREATED/UPDATED handlers                                                                                                                                                             |
| Docky Interactions                            | 00081     | `docky_interactions` table (service-role only analytics); GDPR DATA_SCRUBBED handler restored + extended (deletes advisor_conversations, scrubs interactions)                                                                                                                                     |
| Fix Availability expires_at                   | 00082     | Restores AVAILABILITY.SET normal path `d::date + interval '1 day'` for per-date expiry — regressed by 00075/00077/00080/00081 back to client-sent `expires_at` (NULL in normal path)                                                                                                              |
| Fix NDA Vessel Name                           | 00083     | Adds name masking to `get_vessel_public` + `get_vessels_public_batch` — NDA vessels return 'NDA Vessel' unless caller is owner or has active engagement (bug since 00027)                                                                                                                         |
| Lower MCA Match Threshold                     | 00084     | `match_mca_documents` default threshold 0.7 → 0.6 — small curated corpus had best matches at 0.678                                                                                                                                                                                                |

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

## Permanent Posting Status Lifecycle

```
active -> in_negotiation -> filled | active | cancelled
active -> cancelled  (employer cancels before any selection)
```

When an employer selects a crew member (`PERMANENT.SELECTED`), the posting moves to `in_negotiation` and an engagement is created. `PERMANENT.PLACEMENT_CONFIRMED` fills the posting and not-selects remaining applicants. If the selection doesn't work out (`PERMANENT.SELECTION_REVERTED`), the posting reverts to `active`.

## Permanent Application State Machine

```
Applied -> Shortlisted -> Selected -> (Placement confirmed or Reverted)
Applied -> Rejected | Withdrawn | Not Selected
Shortlisted -> Selected | Rejected | Withdrawn | Not Selected
Selected -> Not Selected (reverted) | Withdrawn
```

Shortlist cap is enforced at the projection layer — `PERMANENT.SHORTLISTED` no-ops if the shortlist + selected count meets the cap. `PERMANENT.WITHDRAWN` handles all withdrawable states and cascades to close the engagement if the applicant was selected.

## Currency Support

Daywork postings carry a `currency` field (CHECK: `EUR`, `USD`, `GBP`, `AED`). Default is `EUR`. The `day_rate` column is NOT NULL — every posting requires a day rate. Templates also support currency (nullable, defaults to `EUR`).

## Job Reference Numbers

Every daywork posting receives a sequential `job_number` (SERIAL UNIQUE) auto-assigned on row creation. Displayed as `DW-00001` format in the UI. This is a projection column for human-readable reference — the event ledger UUID remains the canonical identity.

## Seed Data

`seed/001_canonical_data.sql` populates the canonical lookup tables: 7 regions, 31 cities, 55 ports/marinas, 20 yacht roles, 20 certifications, 5 experience brackets, and 6 vessel size bands.

`seed/002_test_profiles.sql` creates two fully onboarded test accounts for local development:

| Account  | Email | Password   | Hat      | Profile                                                                                                       |
| -------- | ----- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Employer | `e@1` | `87654321` | employer | "Profile One" — Captain, 5+ yrs, Port Vauban. Owns M/Y Serenity (IMO 9876543). Has 3 active daywork postings. |
| Crew     | `c@1` | `87654321` | crew     | "Profile Two" — Deckhand, 2-5 yrs, Port Vauban. 14-day availability window.                                   |

`seed/003_advanced_scenarios.sql` adds 3 jobs in various lifecycle states using the same test accounts:

| Job    | Role       | Port              | Status      | State                                                                    |
| ------ | ---------- | ----------------- | ----------- | ------------------------------------------------------------------------ |
| DW-004 | Deckhand   | Port Hercules     | active      | Crew applied → viewed → shortlisted (awaiting decision)                  |
| DW-005 | Engineer   | Vieux Port Cannes | in_progress | Accepted, 4 messages exchanged, engagement active                        |
| DW-006 | Stewardess | Port de Nice      | completed   | Full lifecycle: accepted → messages → completed → confirmed → both rated |

`config.toml` references all three seed files. Seed data is applied automatically during `npx supabase db reset`.

## Integration Tests

Integration tests (`npm run test:integration` from `apps/web/`) run against the real local Supabase database. They use fixed UUIDs and require a clean database state:

```bash
npx supabase db reset          # Reset DB + apply seed data
cd apps/web && npm run test:integration
```

Tests will fail against a non-clean database due to unique constraint violations from fixed test UUIDs.

## Message Hiding (Removed)

Migration 00016 removed message hiding (`hidden_by` column + `MESSAGE.HIDDEN` event handler). Messages are append-only and always visible to both engagement participants. This aligns with the truth-centric architecture — no content suppression.

## PostgREST Join Notes

`applications.crew_person_id` and `active_engagements.{crew,employer}_person_id` each have two FKs: one to `persons.id` (for referential integrity) and one to `profiles.person_id` (for PostgREST embedded selects). When using Supabase's `.select()` with nested profile data, use the explicit FK hint syntax, e.g. `profiles!applications_crew_person_id_profiles_fkey(display_name)`.
