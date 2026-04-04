# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

CI Pipeline Fixes (Stage 193)

---

## Queue

### CI Pipeline Fixes (Stage 193) ✓ COMPLETE

- [x] CI lint excludes mobile: `npx turbo run lint --filter='!mobile'`
- [x] Rollback 00076: SET NULL on 5 FK tables before DELETE from experience_brackets
- [ ] Push to main and verify CI passes all gates + deploy-migrations runs

---

### Production Corpus Ingestion (user actions after CI green)

- [ ] USER ACTION: Create `apps/web/.env.production.local` with production Supabase URL, service role key, OpenAI key
- [ ] USER ACTION: Run `npx tsx scripts/ingest-mca-docs.ts --production`
- [ ] USER ACTION: Set `DOCKY_CORPUS_READY=true` in Vercel env vars after smoke test passes
- [ ] USER ACTION: Redeploy on Vercel

---

## Deferred items

- [ ] Visually verify card background image watermark effect
- [ ] Run screenshot script (blocked by port 54322 — needs system restart)
- [ ] `DOCKY_CORPUS_READY=true` — only set after corpus ingestion + quality validation
- [ ] Interaction logging 90-day cleanup cron — build when data volume warrants it
- [ ] Subscription plan in JWT custom access token hook — future optimisation to eliminate `requireSubscription` DB query

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

(See git history for completed stages 51-184. Mobile Phases 1-6 complete + UI primitives. EAS config stage 173. Vercel build fix. Stage 174: hat switcher copy, full-bleed cards, header toggle, JWT claims, batch vessel lookup, favicon. Stage 175: LookupsProvider, middleware header dedup, parallel fetches. Stage 176: NotificationCountsProvider. Stage 177: Smoker + visible tattoos profile fields. Stage 178: Responsive redesign Phase 0 foundation. Stage 179: Responsive redesign Phase 1 landing/auth/onboarding. Stage 180: Phase 1 fix + Phase 2 discover grids. Stage 181: Phase 3 profile 2-column + edit grid. Stage 182: Phase 4 messages 2-column + sidebar actions. Stage 183: Phase 5 my jobs + review grids. Stage 184: Phase 6 forms + simple pages — RESPONSIVE REDESIGN COMPLETE.)
