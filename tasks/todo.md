# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 202 — Pre-launch remediation (from full codebase audit)

---

## Queue

### Stage 202 — Pre-launch remediation

#### CRITICAL-1: Wire rate limiting middleware

Rate limiting code exists in `src/lib/rate-limit.ts` and is composed in `src/proxy.ts`, but `proxy.ts` is dead code — **never imported anywhere**. No `src/middleware.ts` file exists, so zero API routes are rate limited.

- [x] **Create `apps/web/src/middleware.ts`** that imports `proxy` from `./proxy` and re-exports it as `middleware`. Export the `config` matcher from proxy.ts as well. The function must be the default export or named `middleware` per Next.js convention.
- [x] **Verify `proxy.ts` composes correctly:** it calls `checkRateLimit(request)` first, then `updateSession(request)`. Both must run. If rate limit rejects (429), `updateSession` should NOT run. If rate limit passes (returns null), `updateSession` runs and its response is returned.
- [x] **Verify env var graceful degradation:** if `UPSTASH_REDIS_REST_URL` is unset, `getRedis()` returns null, `checkRateLimit` returns null (pass-through). Rate limiting degrades to no-op without breaking the app. Confirm this path works.
- [x] **Verify exemptions:** `/api/health` and `/api/webhooks/*` are exempted in `checkRateLimit`. Non-API routes (pages) pass through. Cron routes (`/api/cron/*`) are NOT exempted — add exemption since they're authenticated by `CRON_SECRET` and should never be rate limited.
- [ ] **Test locally:** Start the app, make >100 requests to `/api/health` in 60s (should pass, exempted). Make >100 requests to `/api/profile` in 60s (should 429 if Redis configured, pass-through if not). Make >30 POST requests to `/api/daywork` in 60s (should 429 on write limit).
- [x] **Update test mocks:** Any existing tests that call route handlers directly won't go through middleware, so no test changes needed. But verify `turbo run type-check` passes with the new file.

#### CRITICAL-2: Strip `positions_filled` from crew-facing API response

The discover API at `api/daywork/discover/route.ts:84` selects `positions_filled` from the DB. The hydrated response (lines 202-218) computes `positions_remaining = positions_available - positions_filled` and includes both fields. Crew can see `positions_filled` in DevTools and infer it from `available - remaining`.

- [x] **In `api/daywork/discover/route.ts`**, remove `positions_filled` from the hydrated response object. Do NOT return `positions_remaining` either — it reveals filled count by subtraction. Only return `positions_available` (the total).
- [x] **Remove "Last position!" urgency copy.** In `discover/_components/daywork-card.tsx:138-150`, remove the entire conditional block that shows "Last position!" or position counts. Replace with a simple badge: show `"{positions_available} positions"` only when `positions_available > 1`. No fill state, no urgency, no remaining count. "Last position!" is gamification — never approved.
- [x] **Remove `positions_filled` and `positions_remaining` from `DayworkCard` interface** in `daywork-card.tsx:47-48`. Keep only `positions_available: number`.
- [x] **Remove `positions_filled` from `applied-tab.tsx:66`** interface (field is no longer displayed after Stage 201, but still in the type).
- [x] **Verify permanent discover is clean:** `api/permanent/discover/route.ts` does NOT return `positions_filled` — confirmed clean, no action needed.
- [x] **Verify employer-facing APIs still return `positions_filled`:** `api/daywork/mine`, `api/daywork/[id]/applicants`, `api/daywork/[id]/update-positions` — these are employer-only and must continue to include `positions_filled`. Do NOT strip from these.
- [x] **Update `daywork-discover.test.ts`:** Assertions referencing `positions_filled` or `positions_remaining` in discover response must be updated to match new response shape.

#### HIGH-1: Add top-level try/catch to unprotected routes

Three routes have handler bodies partially or fully outside try/catch, meaning unhandled exceptions return raw 500 with no JSON body.

- [x] **`apps/web/src/app/api/profile/route.ts` — GET handler (lines 11-53):** Wrap the entire handler body after the auth guard in try/catch. The agent placement query at line 44 and the profile query at line 16 are both unprotected.
- [x] **`apps/web/src/app/api/profile/route.ts` — PATCH handler (lines 59-189):** Move the try/catch to wrap the entire body including `request.json()` parsing and validation (currently only wraps `appendEvent` at line 153). `request.json()` can throw on malformed bodies.
- [x] **`apps/web/src/app/api/daywork/[id]/applicants/[crewId]/accept/route.ts` — POST handler:** The `check_no_overlap` RPC call at line ~74 is outside the try/catch that starts at line ~90. Move try/catch to wrap the full handler body.
- [x] **Pattern for all fixes:** Auth guard stays outside try. Everything after `const { user, person, supabase } = guard.value;` goes inside try. Catch returns `NextResponse.json({ error: message }, { status: 500 })`.

#### HIGH-2: Escape key support for custom overlays

8 overlays use custom div patterns without Escape key support (8 others use Radix Dialog which has built-in Escape). The most efficient fix: add Escape support to the `BottomSheet` base component (fixes 5 overlays), then fix the 2 standalone overlays.

- [x] **`apps/web/src/components/ui/bottom-sheet.tsx`:** Add a `useEffect` that listens for `keydown` events and calls `onClose()` when `event.key === 'Escape'`. Add `tabIndex={-1}` and `ref` with `focus()` on mount so the sheet can receive keyboard events. This fixes: `cancel-form-overlay`, `crew-cancel-form-overlay`, `rating-form-overlay`, `checklist-form-overlay`, `postponement-form-overlay`.
- [x] **`apps/web/src/components/availability-overlay.tsx`:** Same pattern — `useEffect` with `keydown` listener, call `onClose()` on Escape.
- [x] **`apps/web/src/components/profile-overlay.tsx`:** Same pattern. This overlay already has click-outside dismiss — add Escape key alongside it.
- [x] **Verify cleanup:** Each `useEffect` must return a cleanup function that removes the event listener. No memory leaks.

#### MEDIUM-1: Test coverage for critical untested routes

17 routes lack unit tests. The 8 classified as CRITICAL are write operations with event appending. Prioritize these.

**Tier 1 — Event-appending write routes (8 routes, highest risk):**

- [x] `POST /api/daywork/[id]/applicants/[crewId]/accept` — pre-existing: applicant-accept.test.ts (9 tests)
- [x] `POST /api/daywork/[id]/applicants/[crewId]/reject` — pre-existing: applicant-reject.test.ts (7 tests)
- [x] `POST /api/daywork/[id]/applicants/[crewId]/shortlist` — pre-existing: applicant-shortlist.test.ts (10 tests)
- [x] `POST /api/daywork/[id]/applicants/[crewId]/view` — pre-existing: applicant-view.test.ts (5 tests)
- [x] `POST /api/daywork/[id]/invite` — pre-existing: invite.test.ts (8 tests)
- [x] `POST /api/daywork/invitations/[id]/respond` — pre-existing: invitation-respond.test.ts (11 tests)
- [x] `POST /api/engagements/[id]/rate` — pre-existing: engagement-rate.test.ts (13 tests)
- [x] `POST /api/messages/[engagementId]/documents/finalize` — pre-existing: document-exchange.test.ts (14 tests)

**Tier 2 — Sensitive reads (3 routes):**

- [x] `GET /api/daywork/[id]/applicants` — pre-existing: applicants.test.ts (8 tests)
- [x] `GET /api/messages/[engagementId]/documents/[documentId]/download` — pre-existing: document-exchange.test.ts
- [x] `POST /api/messages/[engagementId]/call-ended` — NEW: call-ended.test.ts (5 tests)

**Tier 3 — Document + WhatsApp operations (4 routes):**

- [x] `GET /api/messages/[engagementId]/documents` — pre-existing: document-exchange.test.ts
- [x] `DELETE /api/messages/[engagementId]/documents/[documentId]` — pre-existing: document-exchange.test.ts
- [x] `POST /api/messages/[engagementId]/documents/upload` — pre-existing: document-exchange.test.ts
- [x] `GET /api/cron/document-cleanup` — NEW: cron-document-cleanup.test.ts (4 tests)

**Tier 4 — Low-risk reads (2 routes):**

- [x] `GET /api/jobs/[jobNumber]` — pre-existing: public-job.test.ts (6 tests)
- [x] `GET /api/notifications/whatsapp/status` — NEW: whatsapp-status.test.ts (4 tests)

### Visual verification (manual)

- [ ] Cards show visible department tint with per-card angle variation
- [ ] Cards look consistent across discover, market, and messages
- [ ] Skeleton dimensions match real content (no layout shift)
- [ ] Discover page works with size band filter applied server-side
- [ ] Confirm 8 fewer lookups queries on warm page load
- [ ] Add `aria-label` to icon-only buttons (audit chat-header.tsx, bottom-nav.tsx)

---

## BLOCKED — user action required

### Stripe setup

- [ ] Create Stripe products (Crew Pro 4.99, Employer Pro 14.99). Set up webhook. Set 4 Vercel env vars.

### WhatsApp setup

- [ ] Request Twilio WhatsApp sender access (2-4 weeks — START NOW)
- [ ] Submit templates, set env vars, sign DPA

### User testing

- [ ] Verify agent My Jobs — post job as agent, check My Jobs.

### Voice calling Session 3 — Browser testing (manual)

- [ ] Chrome desktop + Android
- [ ] Firefox
- [ ] Safari macOS + iOS
- [ ] Glare resolution, network drop, background tab, multi-tab, offline user, busy signal, hangup during navigation

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012). (Partially addressed by P1-A inline validation.)
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.
- **Admin identity type change** — deferred, medium-high effort, admin-only.
- **Chat page server-rendering** — stream context/messages server-side instead of client-side spinners.
- **Scroll position restoration** — restore scroll on back navigation from detail views.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — needs Xcode debugger.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update for single-thread API.

---

## Done

(See git history for completed stages 51-200+. Recent: Stage 200 UX+perf polish batch — Safari UUID polyfill, card gradient fix, form asterisks+auto-save+validation, SearchableSelect, loading skeletons, empty state CTAs, safeFetch error differentiation, card padding/token normalization, 44px tap targets, status badge icons, lookups cache skip, discover size band DB pre-filter, cleanup.)
