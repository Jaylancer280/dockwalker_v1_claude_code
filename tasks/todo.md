# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Fix Docky production crash — 3 issues from Vercel network logs

**Issue 1 — Anthropic 400 Bad Request (blocks LLM response):**

> `cache_control: { type: 'ephemeral' }` on the system block requires the `prompt-caching-2024-07-31` beta header, which isn't set on the Anthropic client. Anthropic rejects the request with 400.

Option A (quick): Remove `cache_control` from the system block in `apps/web/src/lib/advisor/llm.ts` line 203. Change:

```typescript
system: [{ type: 'text', text: systemBlock, cache_control: { type: 'ephemeral' } }],
```

To:

```typescript
system: [{ type: 'text', text: systemBlock }],
```

Option B (proper): Add beta header to the Anthropic client in `apps/web/src/lib/advisor/anthropic.ts`:

```typescript
_client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
});
```

- [ ] Apply Option A or B (Option A is safer for now — prompt caching is optimization, not functionality)

**Issue 2 — Supabase 406 on `advisor_conversations` + `subscriptions` (schema cache stale):**

> 83 migrations deployed at once. PostgREST schema cache doesn't know about the new tables. `NOTIFY pgrst` was tried but didn't propagate.

- [ ] USER ACTION: Supabase dashboard → Settings → General → **Restart Project** (fully restarts PostgREST + schema cache)

**Issue 3 — OpenAI 429 rate limit on embeddings:**

> Likely from repeated retry attempts. Should resolve once Docky works. Also: `DOCKY_CORPUS_READY` should NOT be set to `true` in Vercel yet (corpus not ingested into production). If it's not set, the RAG search skips the OpenAI call entirely.

- [ ] USER ACTION: Verify `DOCKY_CORPUS_READY` is NOT set in Vercel env vars (or is set to `false`)

**Issue 4 — Usage count increments before LLM succeeds (business logic bug):**

> `increment_advisor_usage` is called on line 107 BEFORE the LLM call on line 145. If the LLM fails (400, 503, timeout), the user loses a question. The user currently shows 8/15 used with zero successful responses. This is unacceptable — users pay for successful responses, not failed attempts.

- [ ] Move the usage increment to AFTER the stream completes successfully. In `apps/web/src/app/api/advisor/thread/messages/route.ts`:
  - Remove the `increment_advisor_usage` RPC call from lines 107-118 (the pre-LLM section)
  - Move the usage check + increment into the `completion.then()` callback (line 158), AFTER the assistant message is saved successfully
  - Keep the limit-reached check: before the LLM call, do a READ-ONLY check of current usage (`SELECT question_count FROM advisor_usage WHERE person_id = $1 AND month = $2`). If already at limit, return 402 immediately without calling the LLM. But do NOT increment yet.
  - Only increment AFTER the assistant response is saved (inside the `.then()` callback on line 158)
  - If the increment fails after a successful response (edge case), the user gets a free question — acceptable, better than charging for failures

- [ ] Also: reset the user's usage count for the failed attempts. Run in Supabase SQL Editor:
  ```sql
  UPDATE public.advisor_usage SET question_count = 0 WHERE person_id = 'b73ac9ea-fb9e-4efd-81a6-94d37f5de5c8';
  ```

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

(See git history for completed stages 51-193. Stages 185-193: audit fixes, Docky refactor Sessions A/B/C, MCA ingestion script, off-topic guard, CI/CD deploy-migrations, rollback hardening.)
