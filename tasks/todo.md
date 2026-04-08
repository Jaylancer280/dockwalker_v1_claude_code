# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 203 — LCP performance fixes

---

## Queue

### Stage 203 — LCP performance fixes (5.3s → target <2.5s)

The discover page is 100% client-rendered. The entire page shows a spinner while JS hydrates, effects fire, the API responds, and React re-renders. The LCP element (`p.mt-1.text-xs.text-white/60` on a job card) can't paint until the full waterfall completes.

#### P0 — Eliminate the animation delay on card entrance (saves ~500ms)

- [x] **Remove or reduce Framer Motion entrance animation on DayworkBrowse.** In `discover/_components/daywork-browse.tsx`, the `motion.div` wrapping cards has `transition={{ duration: 0.5 }}`. This delays card visibility by 500ms AFTER data arrives. Either: (a) remove the animation entirely, (b) reduce duration to 150ms, or (c) use `opacity` only (no `y` translate) at 200ms. Cards should appear near-instantly when data arrives.

#### P0 — Show skeleton cards instead of spinner (perceived LCP improvement)

- [x] **Replace `<LoadingSpinner text="Finding jobs..." />` with skeleton cards.** In `discover/_components/daywork-browse.tsx`, when `loading === true`, render 2-3 `<CardSkeleton />` components (already exist in `components/card-skeleton.tsx`) instead of the spinner. This gives the browser a content-shaped LCP candidate immediately, dramatically improving perceived load time even if actual data arrives at the same time.

#### P1 — Parallelise the discover page fetch waterfall

- [x] **Fire discover API call immediately on mount, not after filter state settles.** In `discover/page.tsx`, the `loadCards()` effect depends on `[loadCards]` which is a `useCallback` with filter deps. On initial mount with no filters, this should fire instantly. Verify there's no unnecessary state update between mount and first fetch that causes a wasted render cycle. If `loadCards` is recreated on the first render due to state initialization, stabilize it with `useRef` for the initial call.
- [x] **Move profile + availability fetches out of the blocking path.** In `discover/page.tsx`, `loadCrewCerts()` and `checkAvailability()` fire on mount but their results (cert IDs, languages, availability status) are only needed for card INTERACTION (cert pill coloring, apply button gating), not card RENDERING. Defer these fetches to after the first card render or run them via `requestIdleCallback` / `startTransition`.

#### P1 — Optimise the discover API query (saves ~500-1000ms)

- [x] **Audit the discover route SQL for unnecessary joins.** In `api/daywork/discover/route.ts`, the main query joins dayworks → yacht_roles → ports → cities → regions → experience_brackets → required_certification_ids. The `get_vessels_public_batch` RPC and profiles query add 2 more round trips. Check: (a) are all joined fields actually used in the response? (b) can any joins be replaced with client-side lookups from the LookupsProvider cache (roles, certs, brackets are already cached client-side)? (c) can the vessel batch RPC be folded into the main query?
- [x] **Consider returning IDs instead of joined names.** The discover API hydrates `role_name`, `port_name`, `city_name`, `region_name`, `experience_bracket_label`, `cert_names` server-side. But the client already has all these lookups cached in LookupsProvider. Return only IDs and let the client resolve names from cache. This simplifies the query and reduces response payload.

#### P1 — Preload critical fonts

- [x] **Add font preload hints.** In `apps/web/src/app/layout.tsx`, the Geist font loads 4 weights (400, 500, 600, 700 = ~500KB total). Add `<link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/_next/static/media/...">` for the Regular (400) and SemiBold (600) weights — these are the above-the-fold weights used on cards. Check the built output for exact font file paths.

#### P2 — Reduce try/catch gaps found in re-audit

3 more routes found with validation queries outside try/catch:

- [x] **`api/daywork/route.ts` POST:** Wrap lines 175-207 (FK validation queries) inside the existing try block.
- [x] **`api/daywork/[id]/apply/route.ts` POST:** Wrap lines 23-72 (daywork lookup, duplicate check, availability check) inside try.
- [x] **`api/engagements/[id]/rate/route.ts` POST:** Wrap lines 20-65 (engagement lookup, existing rating check) inside try.

### Rate limiting local test (manual)

- [ ] Test locally: >100 requests to `/api/health` in 60s (should pass, exempted). >100 requests to `/api/profile` (should 429 if Redis configured, pass-through if not). >30 POST requests to `/api/daywork` in 60s (should 429 on write limit).

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
