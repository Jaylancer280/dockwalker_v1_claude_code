# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Docky UI — free vs pro tier messaging before first message

> Show the value proposition in the Docky interface BEFORE the user sends a message. Not a paywall — free users can still use Docky, but they should understand what they get and what Pro unlocks.

- [ ] In the Docky empty state (suggestion chips area), add tier-aware messaging:
  - **Free crew:** "Docky can answer questions and cite MCA documentation." + subtle Pro upsell: "Upgrade to Crew Pro for personalised advice — Docky will read your profile, certifications, and work history to give tailored guidance."
  - **Pro crew:** "Docky can give you personalised career advice based on your profile." (simple factual statement — no animated indicator, no "reading your profile" staging)
- [ ] The thinking indicator must only say "Docky is thinking" for all users. Remove any staged "reading your profile" text from the thinking indicator if it exists — the user should not see what Docky is doing internally.
- [ ] Use real, specific copy — not generic. Free users should understand exactly what they're missing.
- [ ] The upsell text should link to `/billing`

---

### Show smoker + tattoos to employers

> These fields exist on profiles (migration 00080) but are not shown in the employer-facing views. Factual fields for vessel policy compliance, not discriminatory metrics.

- [ ] Add smoker + visible_tattoos to the view-only profile API response (`/api/profile/[personId]`) for employer/agent viewers
- [ ] Show in applicant review cards and "how employers see you" profile preview

---

### Gate Available Crew tab behind Crew Pro

> Free crew do not appear in the Available Crew tab. Pro crew do. This is the key monetisation lever for crew — "be findable" without actively applying. Free crew can still browse and apply to any job.

- [ ] In `apps/web/src/app/api/daywork/[id]/available-crew/route.ts`: add a filter to the crew query that joins on `subscriptions` and only returns crew where `plan = 'crew_pro'` and `status IN ('active', 'trialing')`. Crew with no subscription row or `plan = 'free'` are excluded.
- [ ] If zero Pro crew are available, return an empty list — do NOT fall back to showing free crew.
- [ ] No UI changes needed on the employer side — the tab just shows fewer (or zero) results.
- [ ] On the crew side: in the availability overlay or profile page, add a subtle note: "Upgrade to Crew Pro to appear in employer searches" (only shown to free crew who have set availability). Link to `/billing`.

---

### Invitation = direct hire (daywork invitation rework)

> Currently: crew accepts invitation -> application created (status 'shortlisted') -> employer must still accept from review page. New flow: crew accepts invitation -> engagement created directly, message thread opens, position slot filled. The employer already chose this crew member by inviting them — forcing them back through the applicant pipeline is redundant and unfair to Pro crew who paid for visibility.

**Migration (new migration required):**

- [ ] Update `apply_projection` to change the `DAYWORK.INVITATION_ACCEPTED` handler. Currently it just updates the invitation row status. New behaviour: it must also create the engagement, increment positions_filled, supersede overlapping applications, and (if positions now full) reject remaining applicants and revoke pending invitations — i.e., the same logic as `DAYWORK.ACCEPTED` but triggered by invitation acceptance instead of employer review action.
- [ ] The `DAYWORK.INVITATION_ACCEPTED` payload must be extended to include `daywork_id`, `crew_person_id`, `employer_person_id`, `start_date`, `end_date` (currently only has `daywork_id` and `invitation_id`). The route must populate these from the daywork row before appending the event.
- [ ] Rollback must restore the previous `apply_projection` body (self-contained, per CLAUDE.md rule 4).

**API route changes:**

- [ ] In `apps/web/src/app/api/daywork/invitations/[id]/respond/route.ts` — when `action === 'accept'`:
  - **Remove** the second event (`DAYWORK.APPLIED` with `source: 'invitation'`). No application should be created.
  - **Keep** `DAYWORK.INVITATION_ACCEPTED` as the single event, but enrich the payload with `crew_person_id`, `employer_person_id` (from daywork's `poster_person_id`), `start_date`, `end_date` (from the daywork row).
  - **Add** a positions-full check before accepting: query `dayworks` for `positions_filled >= positions_available`. If full, return 409 with `{ error: 'position_filled' }` instead of creating the engagement.
  - **After** appending the event, fetch the newly created engagement from `active_engagements` (same pattern as the accept applicant route at `apps/web/src/app/api/daywork/[id]/applicants/[crewId]/accept/route.ts` ~line 85-90).
  - **Return** `{ success: true, engagementId }` instead of `{ application: { id, status } }`.
  - **Keep** all existing validation: ownership check, invitation status === 'pending', daywork status === 'active' (not 'in_progress' — but NOTE: if multi-crew, 'in_progress' means some positions filled but not all, so this check may need updating to allow acceptance when `positions_filled < positions_available`), availability overlap check via `check_no_overlap`.

- [ ] In `apps/web/src/app/api/daywork/invitations/[id]/respond/route.ts` — `notifyOnEvent` call: pass the `engagement_id` in the notification payload so the deep link can go to `/messages/{engagementId}` instead of `/daywork/{id}/review`. The employer should land in the chat, not the review page — the crew is already hired.

**Projection handler detail (what `DAYWORK.INVITATION_ACCEPTED` must do in `apply_projection`):**

1. Update `daywork_invitations` set `status = 'accepted'` where `id = invitation_id`
2. Insert into `active_engagements` (crew_person_id, employer_person_id, daywork_id, start_date, end_date) — NO application_id FK since no application exists
3. Increment `dayworks.positions_filled` by 1
4. Supersede overlapping pending applications for this crew member (same date range logic as `DAYWORK.ACCEPTED`)
5. If `positions_filled >= positions_available` after increment: set daywork status to `in_progress`, reject remaining pending applications, revoke remaining pending invitations

**Important:** The `active_engagements` table has `application_id` as a FK. Check if it's nullable — if NOT NULL, the migration must make it nullable first (since invitation-based engagements have no application). Grep for `application_id` in `active_engagements` to check the constraint. If it's NOT NULL, add `ALTER TABLE active_engagements ALTER COLUMN application_id DROP NOT NULL` to the migration.

**Push notification changes:**

- [ ] In `apps/web/src/lib/push-triggers/daywork-handlers.ts` — `handleInvitationAccepted()`: change the deep link from `/daywork/${dayworkId}/review` to `/messages/${engagementId}`. The notification body should say something like "Invitation accepted for {role} — {jobNumber}. Chat is now open." The handler needs the engagement_id passed in the event payload or fetched from `active_engagements` after the projection runs.

**Client-side changes:**

- [ ] In `apps/web/src/app/(app)/discover/page.tsx` (invitations tab): when crew accepts an invitation and the response contains `engagementId`, redirect to `/messages/${engagementId}` instead of staying on the invitations tab. The invitation is now a hire, not an application.
- [ ] Update any UI copy that says "You've been shortlisted" or references application status after invitation acceptance — the crew member is now engaged, not shortlisted.

**Type changes:**

- [ ] In `packages/types/src/events.ts`: extend `DAYWORK.INVITATION_ACCEPTED` payload type to include `crew_person_id`, `employer_person_id`, `start_date`, `end_date` (all required strings) alongside existing `daywork_id` and `invitation_id`.

**Test changes:**

- [ ] Update/rewrite invitation response tests in `apps/web/__tests__/api/` to expect:
  - Accept returns `{ success: true, engagementId }` (not `{ application }`)
  - Only one event appended (`DAYWORK.INVITATION_ACCEPTED`, not two)
  - Engagement created (mock `active_engagements` query)
  - 409 returned when positions full
- [ ] Add integration test: invitation accept creates engagement row, increments positions_filled, supersedes overlapping applications

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **OG social sharing image** — see `tasks/founder-drafts.md` § 7.
- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## Done

(See git history for completed stages 51-197. Stages 185-197: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard.)
