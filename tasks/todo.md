# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Agent profile fixes — remaining diagnostics

**Issue 1 — Vessel creation not saving (needs debugging):**

> The vessel POST API has no hat restriction — agents can create vessels. The route accepts agent requests. Problem is likely in the downstream event append or RLS. Needs console.error diagnostic.

- [ ] Add `console.error` to `apps/web/src/app/api/vessels/route.ts` POST handler — log the full error from `appendEvent` and the supabase insert. Deploy, reproduce the issue as an agent, read Vercel logs.
- [ ] Check: does the `events` CHECK constraint include the aggregate type used for vessel creation? (`vessel` should be in the CHECK)
- [ ] Check: does `vessels` RLS allow agent inserts? (Agents are authenticated, but the INSERT policy may restrict to specific identity types)

**Issue 1 revised — Vessel fuzzy search doesn't save (manual entry works):**

> Selecting an existing vessel from the IMO fuzzy search doesn't save. Manually entering a new vessel works. The bug is likely in the "select existing vessel" code path — the vessel ID from the search result may not be passed correctly to the form/API.

- [ ] In the vessel form (on profile vessels page + post-job form): trace the "select from search results" flow. When a user picks an existing vessel from the IMO lookup, what value is submitted? Is the `vessel_id` being sent to the API, or is it trying to create a new vessel with the searched data?
- [ ] Add `console.error` to the vessel POST route to see what payload arrives for search-selected vs manual entry
- [ ] Check: does the vessel selector distinguish between "use existing vessel by ID" vs "create new vessel with these fields"?

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

(See git history for completed stages 51-200. Stages 185-200: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion + production corpus, off-topic guard, CI/CD deploy-migrations, rollback hardening, availability fix, NDA vessel name masking, RAG threshold, production Docky launch, crew context diagnostics, usage pill refresh, experience fields, gear icon, auto-scroll, Pro gating, hallucination guard, tier messaging, smoker/tattoos, Available Crew Pro gate + tests, invitation direct hire, share job to social, agent profile + UX fixes.)
