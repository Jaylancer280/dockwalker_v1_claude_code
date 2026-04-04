# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

MCA Corpus Ingestion Script (Stage 189)

---

## Queue

### MCA Corpus Ingestion Script (Stage 189) ✓ COMPLETE

- [x] `scripts/ingest-mca-docs.ts` — standalone script, runs with `npx tsx scripts/ingest-mca-docs.ts`
- [x] `pdf-parse` added to root package.json devDependencies
- [x] Section-based chunking (headers → paragraphs → sentences), ~450 token target, 50 token overlap
- [x] Batch embedding (20 per call, 100ms delay), idempotent re-ingestion (DELETE before INSERT)
- [x] Smoke test query, summary output, DOCKY_CORPUS_READY instruction
- [x] `corpus/mca/source-urls.json` with URLs for all 16 PDFs
- [x] No hardcoded keys, type-check clean, 921 tests pass
- [ ] Script execution pending — requires Docker (Supabase) + OPENAI_API_KEY in .env.local

---

### Docky Off-Topic Guard

> One-liner prompt addition + interaction logging detection string.

- [ ] Add off-topic refusal rule to `BASE_SYSTEM_PROMPT` in `apps/web/src/lib/advisor/llm.ts`:
      `- If a question is not related to maritime careers, certifications, training, or the yachting industry, politely decline and redirect: "I'm only able to help with maritime career and certification questions. Try asking about STCW requirements, career progression, or training centres!"`
- [ ] Verify the `was_refused` detection in Session C's interaction logging matches this exact refusal string (`"I'm only able to help with maritime"`)
- [ ] Add test: mock Docky response containing refusal string, verify `was_refused` is set correctly in interaction log

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
