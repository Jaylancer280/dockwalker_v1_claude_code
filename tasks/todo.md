# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Audit Fixes (Stage 185) — Codebase quality sweep

---

## Queue

### Audit Fixes (Stage 185) — Codebase quality sweep

> Found during full web app audit (2026-04-04). Fix before next feature work.

**HIGH — Security / Pattern Violations:**

- [x] Add max length validation to `bio` field in `apps/web/src/app/api/profile/route.ts` — enforce 1000-char limit
- [x] Add top-level try/catch to `apps/web/src/app/api/availability/route.ts` GET handler
- [x] Add top-level try/catch to `apps/web/src/app/api/messages/[engagementId]/route.ts` GET and POST handlers
- [x] Add top-level try/catch to `apps/web/src/app/api/messages/[engagementId]/read/route.ts` POST handler
- [x] Add top-level try/catch to `apps/web/src/app/api/notifications/read/route.ts` POST handler

**MEDIUM — Auth / Validation:**

- [x] Verify `/api/auth/me` — intentional: lightweight auth check returning only userId, no domain data exposed. Comment added.
- [x] Fix hat cast in `apps/web/src/app/api/availability/route.ts` DELETE handler — explicit hat validation before roleContext
- [x] Fix hat cast in `apps/web/src/app/api/profile/avatar/route.ts` POST and DELETE handlers — explicit hat validation

**LOW — Polish / Accessibility:**

- [x] Extract hardcoded theme colors to `apps/web/src/lib/theme-colors.ts` — THEME_COLOR_DARK/LIGHT, EPAULETTE_GOLD/SILVER
- [x] Add `aria-expanded` to profile-overlay experience accordion, location-picker region/city toggles
- [x] Add `aria-label` to icon-only close buttons (profile-overlay, bottom-sheet, push-prompt) and icon-only toggle (location-picker ports chevron)

**Tests (add alongside fixes):**

- [x] Updated bio length validation tests — 1001 chars returns 400, 1000 chars accepted (was 250)
- [x] All 915 tests pass, type-check clean, web lint clean (1 pre-existing error in unrelated test file)

**Documentation (human edit required — flag for user):**

- [x] CLAUDE.md event catalog updated with 12 missing event types (one-time permission from user)

---

### Session A — Single-Thread Migration (structural, no DB migration)

> Biggest change. Rewrites API surface, merges UI pages. Must go first — later sessions modify this code.
> No database migration needed — same tables, new API routes.

**Pre-flight checks:**

- [ ] Read current `apply_projection` DATA_SCRUBBED handler — note that advisor tables are NOT scrubbed (pre-existing GDPR gap, fixed in Session C)
- [ ] Read `apps/web/src/app/api/account/export/route.ts` lines 87-90 — confirm data export includes advisor_conversations (no change needed, works with single-thread)

**New API routes:**

- [ ] Create `apps/web/src/app/api/advisor/thread/route.ts` — GET handler:
  - Auth guard + crew hat check
  - Query `advisor_conversations` for user's most recent thread (`ORDER BY created_at DESC LIMIT 1`)
  - If thread exists and age > 72h from `created_at`: delete it (messages cascade), return empty state `{ thread: null, messages: [] }`
  - If thread exists and age ≤ 72h: fetch messages from `advisor_messages`, return `{ thread: { id, created_at }, messages: [...] }`
  - If no thread: return `{ thread: null, messages: [] }`
  - Client never needs conversation ID — the API always operates on "the user's current thread"

- [ ] Create `apps/web/src/app/api/advisor/thread/messages/route.ts` — POST handler:
  - Auth guard + crew hat check
  - Validate content (required, max 500 chars, trimmed)
  - Find user's active thread (most recent, ≤72h old)
  - If no active thread: auto-create one (`INSERT INTO advisor_conversations`)
  - Subscription check via `requireSubscription(supabase, personId, 'crew_pro')`
  - Usage gate: call `increment_advisor_usage` RPC (free tier: limit 3 — updated to 15 in Session C)
  - Save user message to `advisor_messages` (BEFORE LLM call — survives LLM failure)
  - Parallel fetch: `buildCrewContext()` + `searchMcaDocs()`
  - `buildCertGapContext()` from chunks + crew certs
  - Call `askDocky()` — wraps in try/catch, returns 503 on failure
  - Save assistant message to `advisor_messages` with sources + token counts
  - Return `{ id, role, content, sources, created_at }`

- [ ] Create `apps/web/src/app/api/advisor/thread/clear/route.ts` — POST handler:
  - Auth guard + crew hat check
  - Find user's most recent thread
  - Delete it (messages cascade via ON DELETE CASCADE)
  - Return 204

**Rewrite web UI:**

- [ ] Rewrite `apps/web/src/app/(app)/docky/page.tsx` — merge conversation list + chat into single-page:
  - On mount: GET `/api/advisor/thread` — loads active thread or empty state
  - Empty state: suggestion chips (reuse `useProfileChips`), encouragement text
  - Chat state: message list with user/assistant bubbles, sources collapsible, markdown rendering, DOMPurify
  - Input: Enter to send, Shift+Enter newline, 500 char max, disabled while sending
  - "New conversation" button: confirmation dialog ("Start a new conversation? Current messages will be cleared."), POST `/api/advisor/thread/clear`, reload empty state
  - Disable "New conversation" while a message is sending (prevents FK race)
  - Expiry countdown: muted text "This conversation expires in Xh Ym" calculated from `thread.created_at + 72h - now`. Hide when <1 min remains.
  - Keep: profile completeness nudge (`useDockyReadiness`), usage pill, staged thinking indicator ("reading your profile" → "thinking..."), auto-scroll to bottom
  - Limit reached state: lock input, show upgrade CTA to `/billing`

- [ ] Create `apps/web/src/app/(app)/docky/loading.tsx` — skeleton loader for the docky page

**Remove old routes + pages:**

- [ ] Delete `apps/web/src/app/api/advisor/conversations/route.ts`
- [ ] Delete `apps/web/src/app/api/advisor/conversations/[id]/route.ts`
- [ ] Delete `apps/web/src/app/api/advisor/conversations/[id]/messages/route.ts`
- [ ] Delete `apps/web/src/app/(app)/docky/[conversationId]/page.tsx`
- [ ] Verify: bottom nav links to `/docky` (confirmed — no change needed)
- [ ] Verify: sidebar nav links to `/docky` (confirmed — no change needed)
- [ ] Verify: no push notification deep links to `/docky/[id]` (confirmed — none exist)

**Rewrite tests:**

- [ ] Rewrite `advisor-conversations.test.ts` → `advisor-thread.test.ts`:
  - GET /thread: returns active thread + messages (200)
  - GET /thread: auto-erases expired thread (>72h), returns empty (200)
  - GET /thread: returns empty when no thread exists (200)
  - GET /thread: returns 401 unauthenticated
  - GET /thread: returns 403 employer hat
  - POST /thread/clear: deletes thread (204)
  - POST /thread/clear: returns 204 even when no thread exists (idempotent)
- [ ] Rewrite `advisor-messages.test.ts` → test POST /thread/messages:
  - Happy path: sends message, returns assistant response (200)
  - Auto-creates thread if none exists
  - Empty content: returns 400
  - Content > 500 chars: returns 400
  - Employer hat: returns 403
  - Unauthenticated: returns 401
  - LLM error: returns 503, user message still saved
- [ ] Update `advisor-personalised.test.ts` — new route import path, same crew context assertions
- [ ] Update `advisor-usage.test.ts` — new route import path, same usage gating assertions
- [ ] `advisor-usage-route.test.ts` — unchanged (usage GET route doesn't change)

**Verify:**

- [ ] `turbo run type-check` passes
- [ ] `turbo run lint` passes
- [ ] All vitest tests pass
- [ ] No `console.log` in committed code

---

### Session B — Prompt Caching + Cost Reduction (library changes only)

> Low risk, high impact. No API surface change, no UI change, no migration.

**Prompt restructure + caching (spec 7a):**

- [ ] Refactor `apps/web/src/lib/advisor/llm.ts`:
  - Remove fake user/assistant message pairs for crew context and MCA chunks
  - Build single `systemBlock` string: BASE_SYSTEM_PROMPT + crew context + MCA chunks + cert gap analysis + injection defence
  - Pass as `system: [{ type: 'text', text: systemBlock, cache_control: { type: 'ephemeral' } }]`
  - `messages` array now contains ONLY real conversation turns (history + current question)
  - Keep `askDocky()` function signature compatible with Session A's route

**Skip empty corpus embedding (spec 7c):**

- [ ] In `apps/web/src/lib/advisor/rag.ts`: check `process.env.DOCKY_CORPUS_READY === 'true'` before calling `generateEmbedding()`. If not true, return empty array immediately.
- [ ] Add `DOCKY_CORPUS_READY=false` to `.env.example` with comment

**History token budget (spec 7e):**

- [ ] Add `trimHistory()` function in `apps/web/src/lib/advisor/llm.ts`:
  - Budget: 3,000 tokens, estimate as `Math.ceil(text.length / 4)`
  - Walk backwards from most recent message, keep adding until budget exceeded
  - Replace the current 10-message `LIMIT` with token budget trim
- [ ] Apply `trimHistory()` to conversation history before building messages array

**Update tests:**

- [ ] Update `advisor-messages.test.ts` (or renamed file from Session A) — verify `askDocky()` receives system block parameter, not fake message pairs
- [ ] Update `advisor-personalised.test.ts` — verify crew context appears in system block
- [ ] Add test: when DOCKY_CORPUS_READY is not 'true', `searchMcaDocs` returns empty without calling OpenAI

**Verify:**

- [ ] `turbo run type-check` passes
- [ ] All vitest tests pass

---

### Session C — Rate Limits + Streaming + Interaction Logging

> Rate limits are trivial. Streaming is complex but highest UX win. Logging requires a migration.
> Implementation agent: if this session is too large, split into C1 (rate limits) and C2 (streaming + logging).

**Rate limit update (spec 7d):**

- [ ] In thread messages route: remove the `if (!isPro)` gate around usage check — ALWAYS call `increment_advisor_usage`
- [ ] Pass `isPro ? 500 : 15` as `p_limit` parameter
- [ ] In `apps/web/src/app/api/advisor/usage/route.ts`: return `limit: 15` for free tier, `limit: 500` for Pro (was: `limit: 3` for free, `null` for Pro)
- [ ] Update Docky page usage pill display: show "X of 15" for free, "X of 500" for Pro
- [ ] Update tests: free limit assertions 3 → 15, add Pro tier test (500 limit, usage tracked)

**Streaming responses (spec 7b):**

- [ ] Create `streamDocky()` in `apps/web/src/lib/advisor/llm.ts`:
  - Uses `client.messages.stream()` from Anthropic SDK
  - Returns `{ stream: ReadableStream, completion: Promise<{ text: string, inputTokens: number, outputTokens: number, model: string }> }`
  - Pipe `text` delta events to the ReadableStream
  - `completion` resolves on `message_stop` with full text + token counts
- [ ] Update thread messages route:
  - Replace `askDocky()` call with `streamDocky()`
  - Return `new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`
  - After stream completes (via `completion` promise): save assistant message to `advisor_messages` with full text, sources, token counts
  - If stream errors mid-response: do NOT save partial assistant message to DB (user sees partial text in session, gone on refresh — acceptable)
- [ ] Update Docky page client:
  - Replace `safeFetch` with raw `fetch()` for the message send call (document why: streaming requires ReadableStream access)
  - Read response body via `getReader()`, decode chunks, update message state incrementally
  - Keep `safeFetch` for all other Docky API calls (GET thread, POST clear, GET usage)
  - Sources: extract from a final SSE event or fetch separately after stream completes
- [ ] Update tests: mock `client.messages.stream()` instead of `client.messages.create()`

**Interaction logging (spec 7f):**

- [ ] Create migration `supabase/migrations/00081_docky_interactions.sql`:
  - `docky_interactions` table (id uuid PK, person_id uuid FK, query text, response_summary text, chunks_used jsonb, was_refused boolean, refusal_reason text, input_tokens int, output_tokens int, latency_ms int, created_at timestamptz)
  - RLS enabled, NO user-facing policies (service role only)
  - Comment documenting 90-day retention policy (cleanup cron deferred)
- [ ] Create rollback `supabase/rollbacks/00081_docky_interactions.sql`
- [ ] After stream completes (or after non-streaming response), insert interaction log row via serviceClient
  - `response_summary`: first 200 chars of response text
  - `was_refused`: detect "I'm only able to help with maritime" in response
  - `latency_ms`: measure from before LLM call to stream completion
- [ ] Fix pre-existing GDPR gap — update `apply_projection` DATA_SCRUBBED handler:
  - Add: `DELETE FROM advisor_conversations WHERE person_id = NEW_person_id;` (messages cascade)
  - Add: `UPDATE docky_interactions SET person_id = NULL, query = '[scrubbed]', response_summary = '[scrubbed]' WHERE person_id = NEW_person_id;`
  - **CRITICAL**: The migration that replaces `apply_projection` must include ALL existing event handlers — diff against previous version line-by-line per lessons.md
- [ ] Create rollback for apply_projection change — must include FULL previous function body (self-contained per CLAUDE.md rule 4)
- [ ] Add test: interaction row inserted after successful message
- [ ] Add test: GDPR scrub deletes advisor_conversations and nullifies docky_interactions

**Verify:**

- [ ] `turbo run type-check` passes
- [ ] `turbo run lint` passes
- [ ] All vitest tests pass
- [ ] `npx supabase db reset` succeeds (mandatory post-migration smoke test)
- [ ] Update `BUILD_STATE.md` schema version and migration table

---

## Deferred items

- [ ] Visually verify card background image watermark effect
- [ ] Run screenshot script (blocked by port 54322 — needs system restart)
- [ ] MCA corpus ingestion script (`scripts/ingest-mca-docs.ts`) — blocked on obtaining PDF documents
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
