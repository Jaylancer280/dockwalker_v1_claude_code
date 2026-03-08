# BUILD_STATE.md — DockWalker Build State

> This file is updated by Claude Code at the end of every session that changes code.
> See `CLAUDE.md` Documentation Governance for update rules.

## Completed Stages

- [Stages 1-11] Core infrastructure, all API routes, all pages, bottom navbar, templates, chat
- [Stage 12] Polish + Deploy — error boundary, not-found page, loading states, fetch error handling
- [Stage 13] Hardening + Open Discovery — shared domain user guard (`requireDomainUser`) for all write and read routes (401/409), open discovery (removed availability gating and fake sort options), explicit filters (roleId, portId, startDate, endDate) on discover and mine routes, Capacitor build consistency (env-driven static export, cross-platform build wrapper), proxy rename (Next.js 16 middleware → proxy), NDA RLS and rollback execution CI checks, documentation governance enforcement, corrected seed data docs
- [Stage 14] Form dropdown canonical data tests — component tests verifying all dropdowns across onboarding, post-daywork, discover, vessels, and profile pages are populated with canonical lookup data (roles, certs, experience brackets, size bands, ports)
- [Stage 15] Fix applicant/message profile joins — added FKs from `applications.crew_person_id` and `active_engagements.{crew,employer}_person_id` to `profiles.person_id` so PostgREST can resolve embedded profile selects; added FK hint syntax to applicants and messages routes; fixed seed config path and Supabase env keys
- [Stage 16] Input validation hardening — working days vs date span check, message content 2000-char limit, display name 100-char limit, bio 250-char limit, no past start dates on daywork, FK existence validation (roleId, portId, experienceBracketId, sizeBandId) at API layer with clean 400 errors
- [Stage 17] Currency + required day rate — added `currency` column (EUR/USD/GBP/AED) to dayworks and templates, made `day_rate` required (NOT NULL), currency dropdown on post form defaulting to EUR, correct currency symbol display on discover and mine pages
- [Stage 18] Shortlist + accept dialog + chat daywork card — new `DAYWORK.SHORTLISTED` event and `shortlisted` application status; shortlist API route; review page split into Applicants/Shortlist tabs with three-button (reject/shortlist/accept) and two-button (reject/accept) layouts; swipe-up gesture for shortlisting; accept dialog navigates to message thread (no "continue reviewing" since daywork is one-time match); accept/reject routes now accept shortlisted applications; auto-supersede includes shortlisted status; daywork summary card at top of chat thread showing role, vessel, location, dates, day rate, meals, and notes; expanded context API with full daywork details
- [Stage 19] In-progress daywork status + middleware fix — on acceptance, daywork moves to `in_progress` (hidden from discovery, blocks new applications); remaining pending/shortlisted applicants auto-rejected; complete/cancel routes accept `in_progress` status; mine page shows `in_progress` postings with complete/cancel actions; fixed middleware.ts (was renamed to proxy.ts which Next.js ignores); discovery exclusion list includes `shortlisted` status
- [Stage 20] Crew completion confirmation — when employer marks daywork complete, crew must confirm or dispute via `ENGAGEMENT.COMPLETION_CONFIRMED` / `ENGAGEMENT.COMPLETION_DISPUTED` events; `crew_completion_status` column on `active_engagements`; confirmation API route; chat page shows confirmation banner for crew and status for employer; daywork goes to completed regardless of crew response
- [Stage 21] Engagement ratings — after completion, both parties rate the job/interaction (not the user); crew rates pay accuracy, meals, role match, working days, vessel condition, would-work-again; employer rates skills match, cert verification, punctuality, would-rehire; both rate communication and overall match; `engagement_ratings` table with RLS; `ENGAGEMENT.RATED_BY_CREW` / `ENGAGEMENT.RATED_BY_EMPLOYER` events; rating form overlay in chat page; context API returns `has_rated` flag
- [Stage 22] Correctness hardening — (1) confirm-completion rejects non-boolean input with 400 instead of silently writing a dispute event to the ledger; (2) fixed TSC: `keyof JSX.IntrinsicElements` → `React.ElementType` in form-dropdowns test; (3) review page clears all applicant cards after acceptance since daywork moves to in_progress and remaining applicants are auto-rejected server-side; (4) renamed `middleware.ts` → `proxy.ts` with `proxy` export per Next.js 16 convention (eliminates deprecation warning); (5) mine page differentiates active vs in-progress actions (superseded by Stage 24); (6) completed engagement threads remain visible in messages list until the user submits their post-engagement rating — conversations API includes `completed` status and filters out already-rated; chat footer shows completion/rating banners above a disabled message input instead of replacing it; "Action needed" badge on completed threads in messages list
- [Stage 23] Messages history tab + read-only archive — messages page split into Active/History tabs; Active shows active engagements and completed-but-not-rated (with "Action needed" badge); History shows completed-and-rated and cancelled engagements at reduced opacity with "Cancelled" badge; conversations API returns all engagement statuses with `has_rated` flag for client-side tab sorting; chat page disables input and hides cancel button for both completed and cancelled engagements; cancelled threads show "This engagement was cancelled" banner; messages API tests updated for new query shape (7 tests)
- [Stage 24] Correct posting lifecycle actions + In Progress tab — removed `active → completed` path: active postings can only be cancelled, not completed; complete API rejects `active` status with 400; mine page split into four tabs: Active (review applicants + cancel), In Progress (mark complete + cancel), Done (completed/cancelled read-only), Templates; in_progress postings fetched separately; tab counts shown on Active and In Progress
- [Stage 25] Fix apply_projection function signature mismatch — migrations 00010-00013 accidentally created/updated a 0-arg trigger version of `apply_projection()` but `append_event()` calls the 6-arg standalone version; the 6-arg version was stuck at the 00009 state, missing shortlist, in_progress status transition, crew completion confirmation, and engagement ratings; new migration 00014 drops the orphaned 0-arg version and updates the 6-arg version with all logic from 00010-00013; also restored missing `identity_type`, `agency_name`, and `role_specialization_ids` fields in `PROFILE.CREATED` handler
- [Stage 26] Read-only rating summary — after submitting a rating, users can tap "View rating" in the completion banner to see their submitted answers in an expandable read-only summary; context API returns full `my_rating` object alongside `has_rated`; crew sees pay/meals/role/days/vessel/would-work-again, employer sees skills/certs/punctuality/would-rehire, both see communication and overall match stars
- [Stage 27] Fix hat switch + agent profile projection, add integration test suite — migration 00015 fixes two bugs in `apply_projection`: (1) `PERSON.HAT_CHANGED` read `new_hat` but API sends `current_hat`, so hat switches silently failed; (2) `PROFILE.UPDATED` dropped `agency_name` and `role_specialization_ids` columns, so agent profile edits were silently lost. New Supabase integration test suite (`__tests__/integration/event-roundtrip.test.ts`) verifies 9 critical event roundtrips against a real local Supabase instance: hat switch, crew profile update, agent-specific profile fields, vessel creation, daywork posting, apply→accept→engagement→in_progress flow, availability, and messaging. Integration tests run separately via `npm run test:integration` and are excluded from `npm test`.
- [Stage 28] Remove hidden messages — migration 00016 drops `hidden_by` column from `messages` table and removes `MESSAGE.HIDDEN` event handling from `apply_projection`. RLS policy recreated without `hidden_by` filter. Deleted hide API route and test. Removed hide button from chat UI. Updated CLAUDE.md to remove `MESSAGE.HIDDEN` references.
- [Stage 29] Close types drift + typed appendEvent helper — `EventPayloadMap` interface in `packages/types/src/events.ts` maps every event type to its exact payload shape, enabling compile-time validation. `appendEvent` in `packages/db/src/events.ts` made generic (`appendEvent<T extends keyof EventPayloadMap>`) so payload is type-checked per event. All 18 API routes converted from raw `rpc('append_event')` to typed `appendEvent()`. Added missing types: `DAYWORK.SHORTLISTED`, `ENGAGEMENT.COMPLETION_CONFIRMED/DISPUTED`, `ENGAGEMENT.RATED_BY_CREW/EMPLOYER`, `Engagement`, `EngagementRating` models, `shortlisted` application status, `engagement` aggregate type. Fixed `DomainUser.current_hat` from `string` to `RoleContext`.

## Current Schema Version

v16 — remove message hiding (16 migrations applied)

## Migrations Applied

| Migration                                  | Description                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `00001_events_table.sql`                   | Append-only event ledger                                                                                                                    |
| `00002_canonical_lookups.sql`              | Roles, certs, experience brackets, locations                                                                                                |
| `00003_projection_tables.sql`              | Materialized projections (persons, profiles, vessels, daywork, applications, availability, messages)                                        |
| `00004_rls_policies.sql`                   | Row Level Security on all tables                                                                                                            |
| `00005_append_event.sql`                   | `append_event` RPC + projection triggers                                                                                                    |
| `00006_daywork_templates.sql`              | CRUD templates table (intentional non-ledger exception)                                                                                     |
| `00007_projection_consistency.sql`         | `onboard_person`, `check_no_overlap`, `clear_availability_dates`, `get_vessel_public` RPCs                                                  |
| `00008_application_profile_fk.sql`         | FKs from `applications.crew_person_id` and `active_engagements.{crew,employer}_person_id` to `profiles.person_id` for PostgREST joins       |
| `00009_currency_and_required_day_rate.sql` | Add `currency` to dayworks/templates, make `day_rate` NOT NULL, update `apply_projection`                                                   |
| `00010_shortlist_status.sql`               | Add `DAYWORK.SHORTLISTED` event handling to `apply_projection`, include `shortlisted` in supersede and withdraw logic                       |
| `00011_in_progress_status.sql`             | Add `in_progress` to dayworks status CHECK, set daywork to `in_progress` on acceptance, auto-reject remaining applicants                    |
| `00012_crew_completion_confirmation.sql`   | Add `crew_completion_status` to `active_engagements`, handle `ENGAGEMENT.COMPLETION_CONFIRMED` and `ENGAGEMENT.COMPLETION_DISPUTED` events  |
| `00013_engagement_ratings.sql`             | `engagement_ratings` table with crew/employer-specific fields, `ENGAGEMENT.RATED_BY_CREW` and `ENGAGEMENT.RATED_BY_EMPLOYER` event handlers |
| `00014_fix_apply_projection_signature.sql` | Drops orphaned 0-arg `apply_projection()`, updates the 6-arg version (called by `append_event`) with all logic from migrations 00010-00013  |
| `00015_fix_hat_and_profile_projection.sql` | Fixes `PERSON.HAT_CHANGED` (`new_hat` → `current_hat`) and restores `agency_name` + `role_specialization_ids` in `PROFILE.UPDATED`          |
| `00016_remove_message_hiding.sql`          | Drops `hidden_by` column from `messages`, removes `MESSAGE.HIDDEN` from `apply_projection`, recreates RLS policy without hidden_by filter   |

## Deferred Decisions

- Agent verification process and verified badge
- NDA access request features (crew requesting NDA info)
- Vessel deactivation
- Internal metrics (availability reliability, engagement frequency)
- Push notification token registration to server
- Whether `daywork_templates` should remain CRUD forever or later move into the ledger

## In Progress

None

## Next Up

(Ordered queue — reorder as priorities shift)
