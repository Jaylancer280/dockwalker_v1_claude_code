# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Session B — Prompt Caching + Cost Reduction (Stage 187)

---

## Queue

### Session B — Prompt Caching + Cost Reduction (Stage 187) ✓ COMPLETE

- [x] llm.ts: system block with cache_control ephemeral, injection defence, no fake message pairs
- [x] llm.ts: trimHistory() with 3000 token budget, replaces DB LIMIT 10
- [x] rag.ts: DOCKY_CORPUS_READY guard skips embedding when not 'true'
- [x] .env.example: DOCKY_CORPUS_READY=false added
- [x] Thread messages route: removed .limit(10) on history query
- [x] rag-corpus-guard.test.ts (3 tests), trim-history.test.ts (4 tests)
- [x] Existing advisor tests still pass (askDocky signature unchanged)
- [x] type-check passes, 921 tests pass

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

### MCA Corpus Ingestion Script

> Populates the empty `mca_document_chunks` table. PDFs go in `corpus/mca/`. No migration needed — table already exists (00043).
> Prerequisite: `OPENAI_API_KEY` in `.env.local` (already required for Docky).

**Script: `scripts/ingest-mca-docs.ts`**

- [ ] Create `scripts/ingest-mca-docs.ts` — standalone Node/TS script, runs with `npx tsx scripts/ingest-mca-docs.ts`
- [ ] Add `pdf-parse` dependency to root `package.json` (lightweight PDF text extraction, ~200KB)
- [ ] Add `dotenv` import to load `.env.local` for `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`

**PDF reading + chunking:**

- [ ] Scan `corpus/mca/` for all `.pdf` files
- [ ] For each PDF: extract full text via `pdf-parse`, preserving page boundaries
- [ ] Derive `source_document` from filename (e.g., `MIN-599.pdf` → `MIN 599`, `MSN-1856.pdf` → `MSN 1856`)
- [ ] Split text into chunks using section-based strategy:
  - Primary split: detect section headers (numbered sections like `1.`, `1.1`, `SECTION 2`, `Annex A`, uppercase headers)
  - If a section exceeds 500 tokens (~2000 chars): sub-split at paragraph boundaries
  - If a paragraph exceeds 500 tokens: hard split at sentence boundaries
  - Target: ~400-500 tokens per chunk (estimate as `Math.ceil(text.length / 4)`)
  - Overlap: prepend last 50 tokens of previous chunk to maintain cross-boundary context
- [ ] Extract metadata per chunk: `section_title` (nearest header above), `page_number` (from PDF page boundaries), `chunk_index` (sequential per document)

**Embedding + storage:**

- [ ] For each chunk: call OpenAI `text-embedding-3-small` to generate 1536-dim embedding
- [ ] Rate limit: batch 20 embeddings per API call (OpenAI supports batch input), 100ms delay between batches
- [ ] Before inserting a document's chunks: DELETE existing rows with matching `source_document` (idempotent re-ingestion)
- [ ] INSERT chunks into `mca_document_chunks` via Supabase service client (RLS is read-only for authenticated, writes need service role)
- [ ] Log progress: `[MIN 599] 23 chunks extracted, 23 embeddings generated, 23 rows inserted`

**Validation + summary:**

- [ ] After all documents processed: query total row count from `mca_document_chunks`
- [ ] Run a smoke test query: embed "What STCW certificates do I need?" and call `match_mca_documents` — verify results return with similarity > 0.7
- [ ] Print summary: documents processed, total chunks, total tokens estimated, any failures
- [ ] If smoke test passes: print instruction to set `DOCKY_CORPUS_READY=true` in `.env.local`

**Source URLs (optional, manual):**

- [ ] Create `corpus/mca/source-urls.json` — maps `source_document` to MCA web URL (e.g., `{ "MIN 599": "https://www.gov.uk/..." }`)
- [ ] Script reads this file and populates `source_url` column if a match exists, otherwise `null`

**Verify:**

- [ ] Script runs to completion with at least one test PDF
- [ ] `mca_document_chunks` has rows with valid embeddings
- [ ] `searchMcaDocs()` returns relevant results for a maritime question
- [ ] No hardcoded keys — all from environment variables

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
