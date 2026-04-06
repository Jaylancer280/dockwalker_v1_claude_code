# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Add share button to all job card locations

> `ShareJobButton` exists and works (Web Share API + clipboard fallback). Currently only on My Jobs daywork active cards and the public job page. Must be on every surface where a user sees a job — crew sharing is viral acquisition.

- [ ] Add `ShareJobButton` to daywork discover cards — on the swipe card detail expansion or action area. Pass `job_number`, `role_name`, port name, and formatted rate from the discover API data.
- [ ] Add `ShareJobButton` to permanent discover cards — on the scrollable feed card or detail view. Same props pattern.
- [ ] Add `ShareJobButton` to permanent mine section — employer's permanent posting cards (currently only daywork mine has it). Same pattern as `daywork/mine/page.tsx` line 351.
- [ ] Verify the share text reads naturally in WhatsApp: "{roleName} needed in {location} — {rate}. Apply on DockWalker."

---

### Fix public job page baseUrl (production bug)

> The public share page (`/jobs/DW-00001`) shows "This job is no longer available" for all jobs on production. The `fetchJob()` function constructs the wrong base URL — uses `VERCEL_URL` (deployment URL) instead of `NEXT_PUBLIC_APP_URL` (production domain). Already fixed in code, needs commit + deploy.

- [ ] Verify `NEXT_PUBLIC_APP_URL` is set to `https://www.dockwalker.io` in Vercel environment variables (Production + Preview)
- [ ] Commit the one-line fix in `apps/web/src/app/jobs/[jobNumber]/page.tsx` (line 43-46 → `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`)
- [ ] Deploy and test: share a link to an active job from WhatsApp, verify the full job details render

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

(See git history for completed stages 51-200. Stages 185-200: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard, tier messaging, smoker/tattoos, Available Crew Pro gate + tests, invitation direct hire, share job to social.)
