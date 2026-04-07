# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### WhatsApp dispatcher — missing template mappings

> Verification found 3 gaps in `apps/web/src/lib/push-triggers/whatsapp-dispatcher.ts`. The dispatcher maps 14 of 26 templates. Some are correctly excluded (broadcast handled separately, doc_shared not built yet, invitation_declined has no recipient). But 3 event types that DO fire through `notifyOnEvent` are missing WhatsApp dispatch.

- [x] Add `PERMANENT.CANCELLED_BY_EMPLOYER` to `whatsapp-dispatcher.ts`. Template: `pm_posting_cancelled`. The permanent-handlers already resolve multiple recipients (all applicants not withdrawn). The dispatcher must handle the `ctx` for each recipient and send template with variables: role name (`{{1}}`), job number (`{{2}}`). Button: `[Browse jobs] → /discover`. Read `apps/web/src/lib/push-triggers/permanent-handlers.ts` to see how `handlePermanentCancelled` resolves recipients — match that pattern.
- [x] Add `PERMANENT.PLACEMENT_CONFIRMED` secondary recipient handling. Currently the dispatcher only maps the primary recipient (placed crew gets `pm_placement_confirmed`). The permanent-handlers also notify all not-selected applicants with a "Position Filled" message. These secondary recipients need the `pm_position_filled` template with variables: role name (`{{1}}`), job number (`{{2}}`). Button: `[Browse jobs] → /discover`. Read `handlePlacementConfirmed` in `permanent-handlers.ts` — it returns multiple `NotifyContext` entries. The dispatcher's `resolveTemplate()` receives each context individually, so it needs to detect whether this is the placed crew (use `pm_placement_confirmed`) or a not-selected applicant (use `pm_position_filled`). Check if the `ctx` has a distinguishing field (e.g., different notification title/body) that the dispatcher can key on.
- [x] Tests: verify `pm_posting_cancelled` template fires for PERMANENT.CANCELLED_BY_EMPLOYER, verify `pm_position_filled` fires for secondary recipients of PERMANENT.PLACEMENT_CONFIRMED

---

### WhatsApp cron reminders — 3 templates not wired

> The 3 reminder templates (`reminder_engagement_starts`, `reminder_availability_expiring`, `reminder_availability_stale`) are triggered by cron jobs, not `notifyOnEvent`. The cron handlers insert notifications and send push/email directly. WhatsApp must be added to each cron handler.

- [x] In `apps/web/src/app/api/cron/engagement-starts/route.ts`: after the existing push + email dispatch for each recipient, query `notification_channels` for the recipient (batch query for all recipients in one call, same pattern as `broadcast.ts`). If WhatsApp verified + `whatsapp_enabled`, send `reminder_engagement_starts` template with variables: role name (`{{1}}`), job number (`{{2}}`). Button: `[View details] → /messages/${engagementId}`. If WhatsApp sent successfully, skip the email for that recipient (same priority chain as `notifyOnEvent`).
- [x] In `apps/web/src/app/api/cron/availability-expiry/route.ts`: two notification paths exist — "expiring tomorrow" and "stale (7+ days)". For each, after push dispatch, query `notification_channels`. If WhatsApp connected, send `reminder_availability_expiring` or `reminder_availability_stale` template. Both use no variables (static body). Button: `[Update availability] → /profile` or `[Set availability] → /profile`.
- [x] Import `sendWhatsApp` from `@/lib/whatsapp` and `decryptPhone` is not needed here — `sendWhatsApp` accepts the encrypted buffer directly. Import the channel query pattern from `broadcast.ts`.
- [x] Tests: mock the cron handlers, verify WhatsApp send is attempted for recipients with verified channels, verify email is skipped when WhatsApp succeeds

---

### Meals label — conditional "(optional)" on live aboard

> Daywork post form always shows "Meals provided (optional)" regardless of live aboard. Should only say "(optional)" when live aboard is checked. Permanent form has the conditional logic already.

- [ ] In `apps/web/src/app/(app)/daywork/post/page.tsx` ~line 606: make "(optional)" conditional on live aboard being checked.

---

### Verify: Agent My Jobs — may already work

> Investigation shows daywork mine uses `.eq('poster_person_id', user.id)` and permanent mine uses `.eq('employer_person_id', user.id)` — both filter by person, not role_context. Agent-posted jobs SHOULD appear.

- [ ] USER: Test again — post a job as agent, check My Jobs page. If it shows, this is resolved. If not, check the page-level hat check.

---

### Admin identity type change (deferred — medium-high effort)

> Scope captured. Build when needed.

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

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.

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

## WhatsApp — BLOCKED on user action

> Code is built and unit-tested. Real WhatsApp delivery requires:
>
> - [ ] **USER:** In Twilio Console, set up WhatsApp sender (Messaging → WhatsApp senders → Request access). Copy the approved sender number.
> - [ ] **USER:** Submit all 26 templates from `tasks/whatsapp-templates.md` to Meta via Twilio Console. Wait 24-48h for approval.
> - [ ] **USER:** Set Vercel env vars: `TWILIO_WHATSAPP_FROM` (approved sender number, format `whatsapp:+1234567890`), `NOTIFICATION_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
> - [ ] **USER:** Sign Twilio Data Processing Agreement (Twilio Console → Settings → Privacy)
> - [ ] **USER:** Configure Twilio message body retention to minimum (Settings → Privacy → Message retention)
>
> Start the Twilio WhatsApp approval process NOW — it takes 2-4 weeks. The code work can proceed in parallel.

---

## Done

(See git history for completed stages 51-200+. Recent: WhatsApp notifications Sessions 1-4, ExpandableText, text overflow audit, vessel fuzzy search, share to social, invitation direct hire, Docky production launch.)
