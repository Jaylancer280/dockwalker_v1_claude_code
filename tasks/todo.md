# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 204+ — LCP Performance Overhaul (target: <2.5s on 4G, <1.5s on broadband)

---

## Queue

### Phase 0 — Baseline (do this first, before any code changes)

#### 0A. Measure baseline LCP

- [ ] Run Lighthouse on the discover page (mobile emulation, 4G throttling) — record LCP, FCP, TBT, CLS.
- [ ] Run Lighthouse on messages, profile, daywork/mine, settings, billing — record same metrics.
- [ ] Save results as `tasks/perf-baseline.md` for comparison.

---

### Phase 1 — Quick Wins (estimated savings: 1-2s)

> Low-risk, isolated changes. Each item is independently shippable.
> **Execution order:** 4C → 1C → 1A → 1B → 1D (4C is a prerequisite for 1C; rest are independent)

#### 4C. Next.js Image optimisation configuration (MOVED HERE — prerequisite for 1C)

**File:** `apps/web/next.config.ts`

**Why first:** `next.config.ts` currently has ZERO `images` config. This must land before 1C or removing `unoptimized` will break all avatars.

- [ ] Add `images.remotePatterns` to `next.config.ts` for `**.supabase.co`.
- [ ] Add `images.minimumCacheTTL: 3600` (1 hour, NOT 24 hours). **Reason:** If Supabase storage has a temporary outage, Next.js image optimizer caches the error response for the full TTL duration. 24 hours of broken avatars after a 5-minute outage is unacceptable. 1 hour is a safe compromise — reduces re-optimization load while limiting error caching to a tolerable window.
- [ ] Add `images.formats: ['image/webp', 'image/avif']` for maximum compression.
- [ ] **Verification:** After this change alone (before 1C), avatars should still work identically — `unoptimized` is still set, so this config is dormant until 1C removes it.

**Expected saving:** None on its own — enables 1C.

---

#### 1C. Fix Avatar `unoptimized` flag — stop downloading full-res images

**File:** `apps/web/src/components/avatar.tsx` line 35

**Problem:** `unoptimized={true}` on the `<Image>` component bypasses Next.js image optimization. User-uploaded avatars (potentially 2-4MB from phone cameras) are downloaded at full resolution for a 32-80px display size.

**CRITICAL PREREQUISITE:** 4C must be merged first. `next.config.ts` needs `images.remotePatterns` or removing `unoptimized` will **break all avatars across the entire app**.

**Avatar URLs are public** (not signed) — format is `https://xxx.supabase.co/storage/v1/object/public/avatars/{user_id}/avatar.{ext}?t={timestamp}`.

**Fix — must be done in this order:**

- [ ] **Step 1:** Confirm 4C is merged (remotePatterns configured).
- [ ] **Step 2:** Add `sizes` prop to the `<Image>` component: `sizes={`${imgSize}px`}`. **Without this, Next.js generates 8 responsive variants (640-3840px) for a 32-80px image — bandwidth INCREASES instead of decreasing.** This is the most common Next.js Image pitfall.
- [ ] **Step 3:** Remove `unoptimized` prop from avatar.tsx line 35.
- [ ] **Step 4:** Verify locally: avatar renders with src pointing to `/_next/image?url=...&w=96&q=75` (optimised), not the raw Supabase URL. Check that the generated image width matches the `sizes` hint, not the full default set.
- [ ] **Step 5:** Check all other `<Image>` usages across the codebase for `unoptimized` — the avatar is the only one using external URLs, so only avatar needs this fix. Other images use local `/images/` assets (already optimized).
- [ ] **Step 6:** Verify `avatar-upload.tsx` preview still works. The upload preview uses a blob URL (`URL.createObjectURL`) inside `react-easy-crop` (raw `<img>`, NOT Next.js Image) — confirmed safe, blob URLs never hit `/_next/image`. But verify the post-upload display (which uses the Avatar component with the new Supabase URL + `?t=` cache buster) shows the fresh image, not a stale optimized cache entry.
- [ ] **Rollback plan:** If avatars break in production, re-add `unoptimized` prop — one-line revert.

**Expected saving:** 50-500ms per card render depending on avatar size (most impactful on discover page with multiple cards)

---

#### 1A. Parallelise AppLayout server-side auth calls

**File:** `apps/web/src/app/(app)/layout.tsx` lines 18-30

**Problem:** Two sequential `await` calls block every child route before anything can render:

```
const supabase = await createClient();                            // ~100ms
const { data: { user } } = await supabase.auth.getUser();        // ~200-400ms
const { data: person } = await supabase.from('persons')...       // ~150-300ms
                                                       TOTAL: 450-730ms sequential
```

The JWT custom_access_token_hook (migration 00078) already injects `person_id`, `current_hat`, `identity_type` into `app_metadata`. The layout can read these from the session instead of querying the `persons` table.

**Verified safe (stress test — two passes including security audit):**

- JWT hook injects ALL 3 fields the layout uses: `person_id`, `current_hat`, `identity_type`
- `persons.id === auth.uid()` (FK constraint in migration 00003: `id uuid primary key references auth.users(id)`). No ID mismatch risk when reading `person_id` from JWT vs querying persons table.
- Layout only passes these as props to `SidebarNav`, `BottomNav`, `IncomingCallListener` — no context provider depends on the full person record
- Hat switching already calls `refreshSession()` then `window.location.reload()` — zero stale-claim window
- Middleware has its own JWT fast-path with DB fallback — no conflict
- **Security:** `app_metadata` is server-controlled (not client-writable via SDK). Users cannot forge `current_hat` claims. All API routes independently validate hat via `requireDomainUser()` — UI routing is not a security boundary. Hat-switch API validates `identity_type` before allowing the switch.

**Fix:**

- [ ] After `getUser()`, read `current_hat` and `identity_type` from `user.app_metadata` directly.
- [ ] **CRITICAL — fallback required:** Brand-new users who just completed onboarding won't have JWT claims until their next token refresh. If `app_metadata.person_id` is missing/undefined, fall back to the current `persons` table query. This is not optional — skipping the fallback will break new user sessions.
- [ ] Structure: `const currentHat = user.app_metadata?.current_hat ?? (await queryPersonsTable(supabase, user.id))?.current_hat`. Same for `identity_type`.
- [ ] Verify the layout still correctly redirects to `/onboarding` when person doesn't exist (the fallback DB query returning null triggers this).
- [ ] Verify hat-switching still works: when a user switches hats, the JWT is refreshed and new claims are available on the next request.
- [ ] **Rollback plan:** Revert to always-query-persons-table — one conditional removal.

**Expected saving:** ~150-300ms per page navigation (eliminates DB query for 95%+ of sessions that have JWT claims)

---

#### 1B. Add missing `loading.tsx` skeleton files

**Problem:** Settings and billing pages show blank/spinner while data loads. No `loading.tsx` means Next.js can't show a shell during streaming.

**Pattern to follow:** Existing skeletons (discover, messages, profile, daywork/mine) all use `animate-pulse` with `bg-[var(--card)]` and `bg-[var(--surface)]` colour vars. No shimmer animations. Structure mimics actual page layout dimensions.

- [ ] **Create `apps/web/src/app/(app)/settings/loading.tsx`** — skeleton with: back arrow + "Settings" header, 4 section cards (Account, Notifications, Appearance, Danger Zone) as `animate-pulse` rounded rects using `bg-[var(--card)]`.
- [ ] **Create `apps/web/src/app/(app)/billing/loading.tsx`** — skeleton with: back arrow + "Plans" header, 2 plan card outlines side by side (Free vs Pro) as `animate-pulse` rounded rects.
- [ ] Verify both skeletons match the actual page layout dimensions to prevent layout shift (CLS).

**Expected saving:** Perceived LCP improvement on these pages (skeleton appears in <200ms vs current 1-3s blank)

---

#### 1D. Profile page: replace client-side spinner with inline skeleton

**File:** `apps/web/src/app/(app)/profile/page.tsx` lines 407-412

**Problem:** Profile page shows a `Loader2` spinner (centred, full-page) while 3 parallel API calls complete (~600ms). The file `profile/loading.tsx` exists with a proper skeleton, but that only shows during SSR/RSC streaming. After hydration, the client-side `loading` state shows the Loader2 spinner — worse perceived performance.

**Fix:**

- [ ] Replace the `Loader2` spinner block (lines 407-412) with an inline skeleton matching the `profile/loading.tsx` pattern: avatar circle placeholder, name bar, bio lines, role/cert pill placeholders, experience card placeholders.
- [ ] Either import and reuse the skeleton from `loading.tsx` as a component, or duplicate the structure inline.

**Expected saving:** Perceived LCP improvement (~600ms blank spinner -> instant skeleton)

---

### Phase 1 Checkpoint

- [ ] Re-run Lighthouse on all 6 pages after Phase 1. Compare to baseline. Document in `tasks/perf-baseline.md`.
- [ ] If LCP improved by <500ms total, re-evaluate whether Phase 2/3 are worth the risk.

---

### Phase 2 — Data Fetching Optimisation (estimated savings: 1-1.5s)

> Reduces API response times and eliminates sequential waterfalls.
> **All Phase 2 items are independent — can be shipped in any order.**

#### 2A. Reduce discover API response payload (SCOPED DOWN)

**File:** `apps/web/src/app/api/daywork/discover/route.ts`

**Problem:** The discover API returns ~200-300KB for 50 rows including server-resolved cert names, poster profiles, vessel data, and nested lookups.

**STRESS TEST FINDINGS — original plan was too aggressive:**

- Cards read `card.yacht_roles?.name`, `card.ports?.cities?.regions?.name`, `card.experience_brackets?.label` directly from the API response (15-20 rendering lines in `daywork-card.tsx`)
- On first visit, lookups cache is empty — switching cards to ID-based resolution would show blank names for ~300-800ms (race condition)
- Changing the `DayworkCard` type requires updating **18-22 files atomically** to pass type-check, including 2 mobile files
- Mobile uses direct Supabase queries (NOT the HTTP API) — completely unaffected by these changes

**REVISED FIX — surgical payload reduction without changing the card type:**

- [ ] **Reduce batch size** from 50 to 20 rows. Users swipe through ~5-10 cards per session. 50 rows x hydrated data is massive overkill. `loadMore()` already handles pagination via cursor.
  - **Risk note:** 2.5x more API calls for heavy swipe users. Auto-load triggers at `cards.length <= 5`, so reload fires after ~15 swipes vs ~45 before. Monitor rate limiter — rapid swipers could hit limits sooner.
- [ ] **Keep `notes` in the discover response.** ~~Original plan: remove notes and fetch on demand.~~ Third-pass review: there is no detail/expanded view for discover cards — notes are shown inline on the swipe card and are the primary way crew see what the employer wrote ("Looking for experienced deckhand, Med season, must have ENG1"). Removing notes is a **product regression**, not a performance optimization. The field is `string | null` averaging ~50-100 bytes per card — negligible savings (~1-2KB for 20 cards).
- [ ] Keep all nested lookup joins (yacht_roles, ports, experience_brackets) — the race condition risk from removing them outweighs the payload saving.
- [ ] **Keep cert name resolution in the API for now.** ~~Original plan: remove cert query and resolve client-side.~~ Second-pass stress test found this is riskier than it looks:
  1. `daywork-card.tsx` does NOT import `useLookups` — adding it makes every card a context consumer inside Framer Motion's drag animation, risking re-renders mid-swipe
  2. Cert pill color logic uses **array index correlation** between `cert_names[idx]` and `required_certification_ids[idx]` — client-side resolution would need to maintain this exact ordering, which is fragile
  3. The cert query is a single `.in()` call with deduped IDs (~2-7KB savings) — not worth the re-render risk on the most performance-sensitive component in the app
  4. **Revisit after Phase 3A** (if attempted) when the card is already being refactored

**Expected saving:** Response drops from ~200-300KB to ~80-120KB (60% reduction from batch size alone: 20 rows vs 50). On 4G: ~150-300ms transfer time saved. No type breakage, no mobile breakage, no UI/UX changes — cards render identically, just fewer are pre-fetched.

---

#### 2B. Parallelise messages API internal queries

**File:** `apps/web/src/app/api/messages/route.ts`

**Problem:** The route executes 4 sequential Supabase queries with zero parallelisation (confirmed — current code has no `Promise.all` anywhere).

**Verified safe (second-pass stress test — full dependency chain confirmed):**

- `get_unread_counts` RPC (migration 00058) only needs `person_id` — it internally resolves engagement scope via subquery. No dependency on engagement IDs.
- Ratings query needs `ratableIds` = `allEngagements.filter(status='completed'|'cancelled').map(id)` — depends on Tier 1.
- Messages query needs `engagementIds` = `allEngagements.map(id)` — depends on Tier 1.
- Unread counts merge into final response by `engagement_id` key — order-independent.
- Response shape and sorting are identical whether sequential or parallel (sort uses `created_at`/`start_date` from engagement data, not query order).
- Error handling is safe: Tier 1 engagement failure returns 500 early (stops everything). Tier 2 failures gracefully default (`has_rated: false`, `last_message: null`, `unread_count: 0`).

**Revised fix — two-tier parallelism:**

- [ ] **Tier 1 — run in parallel:**
  ```
  Promise.all([
    engagements query (crew or employer branch),   // ~300-600ms
    supabase.rpc('get_unread_counts', { p_person_id })  // ~200-400ms
  ])
  ```
- [ ] **Tier 2 — run in parallel after tier 1:**
  ```
  Promise.all([
    rating check (needs ratableIds from engagements),   // ~200-400ms
    messages query (needs engagementIds from engagements)  // ~200-400ms
  ])
  ```
- [ ] **Before:** ~900-1800ms sequential -> **After:** ~500-800ms (two parallel tiers)
- [ ] Update tests if any assert on query ordering (8 test cases exist in `messages.test.ts` but none verify query order — they mock sequential calls but don't assert call sequence).

**Expected saving:** ~400-1000ms on the messages page load

---

#### 2C. Eliminate sequential engagement fetch in daywork/mine page

**File:** `apps/web/src/app/(app)/daywork/mine/page.tsx` lines 116-186

**Problem:** After `Promise.all` resolves 4 parallel API calls (lines 123-134), the code does a SEQUENTIAL Supabase query for engagement data (lines 144-169). This defeats the parallelism.

**Verified (stress test):** The engagement query filters `active_engagements` (a projection table, not a view) by `daywork_id IN (ipIds)` and `status = 'active'`. The current sequential query uses daywork IDs from the in-progress result. Moving it to the parallel batch drops this filter.

**CRITICAL DATA CORRECTNESS NOTE:** The speculative query fetches ALL active engagements for the employer, not just those for in-progress dayworks. Without client-side filtering, extra engagement rows could show "Chat" buttons on completed/cancelled daywork cards. The UI guard `posting.status === 'in_progress'` provides some protection, but the `engagementsByDaywork` map would contain stale entries.

**Fix:**

- [ ] Fire a speculative engagement fetch in the initial `Promise.all` (no `daywork_id` filter — we don't have the IDs yet):
  ```ts
  const [activeResult, inProgressResult, completedResult, templatesResult, engagementsResult] =
    await Promise.all([
      safeFetch('/api/daywork/mine?status=active'),
      safeFetch('/api/daywork/mine?status=in_progress'),
      safeFetch('/api/daywork/mine?status=completed,cancelled'),
      safeFetch('/api/daywork/templates'),
      supabase
        .from('active_engagements')
        .select('id, daywork_id, crew_person_id, profiles!...(display_name)')
        .eq('employer_person_id', userId)
        .eq('status', 'active'),
    ]);
  ```
- [ ] Remove the sequential engagement fetch (lines 144-169).
- [ ] **MANDATORY client-side filter** — do NOT skip this step. After all results arrive, filter engagements to only those whose `daywork_id` appears in the in-progress postings list:
  ```ts
  const ipIds = new Set(inProgressPostings.map((d) => d.id));
  const filteredEngagements = (engagementsResult.data ?? []).filter((e) => ipIds.has(e.daywork_id));
  ```
  Build `engagementsByDaywork` from `filteredEngagements`, NOT from the raw query result. This restores the exact same data correctness as the current sequential query.
- [ ] **Waste note:** If there are no in-progress postings, the engagement query returns rows that are all discarded. This is a negligible waste of one parallel query slot — no data leak because the filter discards them.

**Expected saving:** ~200-400ms on My Jobs page

---

#### 2D. Defer NotificationCountsProvider to non-blocking

**File:** `apps/web/src/hooks/use-notification-counts.tsx` lines 49-70

**Problem:** NotificationCountsProvider fires `/api/notifications/count` on mount. This competes for network bandwidth with the actual page data fetch. Notification counts are not critical for LCP — they're badge numbers on the nav.

**Fix:**

- [ ] Wrap the initial fetch in a deferred callback. **Must guard for Safari compatibility:**
  ```ts
  const defer =
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 2000);
  ```
  Safari (iOS and macOS) does NOT support `requestIdleCallback` as of Safari 17.4. Without this guard, the call silently fails on Safari and notifications never load.
- [ ] **MANDATORY: Add cleanup on unmount.** If the user navigates away before the deferred callback fires, the callback must be cancelled. Without this, the stale callback fires, tries to update state on an unmounted component, and causes a React warning or updates the wrong page's state.
  ```ts
  useEffect(() => {
    const id = defer(() => fetchCounts());
    return () => {
      typeof cancelIdleCallback === 'function'
        ? cancelIdleCallback(id as number)
        : clearTimeout(id as ReturnType<typeof setTimeout>);
    };
  }, []);
  ```
- [ ] **Known trade-off:** Badge counts will show "0" (or no badge) for 1-3 seconds, then update. This is acceptable for non-critical UI. Consumers already receive `defaultCounts` (all zeros) until the fetch completes.
- [ ] Verify notification badges still appear within a reasonable time after page load (~2-3s is acceptable for badge counts).

**Expected saving:** ~100-200ms of network contention removed from critical path

---

#### 2E. Reduce lookups network contention when cache is stale

**File:** `apps/web/src/hooks/use-lookups.tsx` lines 143-274

**Problem:** When the 24-hour cache expires, `LookupsProvider` fires 8 parallel Supabase queries on mount. The `loading` state stays `true` until fresh data arrives, even when stale cached data is available and perfectly usable.

**Fix:**

- [ ] Change initialisation logic (lines 144-161): if stale cache exists (expired but parseable), hydrate from it AND set `loading: false`. Currently, stale cache returns `null` from `readCache()` (line 103 rejects expired cache), so the component falls through to `defaultLookups` with `loading: true`.
- [ ] Modify `readCache()`: return stale data with a `stale: true` flag instead of returning `null` when expired.
- [ ] LookupsProvider: if stale cache is available, use it immediately with `loading: false`, then fire background refresh. Only show `loading: true` when no cache exists at all (true cold start).
- [ ] This is a stale-while-revalidate pattern at the component level.

**Verified safe (second-pass stress test):**

- Zero consumers check `lookups.loading` anywhere in the codebase (grepped all 10 consumer files). Changing loading from `true` to `false` while stale is functionally invisible.
- Onboarding page uses its own separate `lookupsLoaded` local state — not affected.
- All form submission endpoints (POST `/api/daywork`, POST `/api/permanent`) validate lookup IDs server-side against the database. If a user selects a stale/deleted ID, the API returns 400 "Invalid role ID" / "Invalid port ID" — data corruption is impossible.

**Known trade-off — stale data display:**
Lookups are admin-maintained canonical data (roles, certs, ports). They rarely change. But if a role is renamed or a cert deleted between cache writes, users briefly see old names until the background refresh completes (~1-2s). This is acceptable because:

- Lookups change at most a few times per year
- The stale window is <2 seconds (background fetch is fast)
- Form submissions use IDs, not names — stale names don't cause data corruption. Server-side validation catches stale IDs.
- localStorage cache is ~90KB — well within the 5MB browser limit
- **Worst case:** User selects a deleted option from stale cache, submits form, sees "Invalid role ID" error, refreshes page (cache revalidates), selects correct option. Annoying but not data-corrupting.

**Expected saving:** Eliminates ~400-800ms of lookups loading time on stale cache. Users see data instantly from stale cache while fresh data loads in background.

---

### Phase 2 Checkpoint

- [ ] Re-run Lighthouse on all 6 pages after Phase 2. Compare to Phase 1 results.
- [ ] If cumulative LCP improvement meets the <2.5s 4G target, **skip Phase 3 entirely** — the risk/reward no longer justifies SSR conversion.
- [ ] Document results in `tasks/perf-baseline.md`.

---

### Phase 3 — Server-Side Rendering (estimated savings: 2-3.5s)

> Architectural changes. Highest impact but highest risk. Each item is a standalone stage.
> **GATE:** Only proceed if Phase 1+2 checkpoint shows LCP is still >2.5s on 4G.
> **ORDERING CONSTRAINTS:**
>
> - Phase 2A must be fully merged before 3A (same files: discover/page.tsx, daywork-card.tsx)
> - Start with 3B (messages — lowest risk, 3 hooks) as proof-of-concept before attempting 3A

#### 3B. Convert messages page to hybrid Server/Client Component (DO FIRST — proof of concept)

**Problem:** 100% client-rendered. Conversation list can't appear until JS loads and `/api/messages` returns.

**Why first:** Messages page has only 3 useState hooks, no complex dynamic imports, and fully serializable props. If this conversion goes badly, the risk of attempting 3A/3C/3D is too high.

**Verified (second-pass stress test):**

- Only 3 `useState` hooks (tab, unreadMap + one more)
- No Supabase Realtime subscription (contrary to original plan — just a one-time RPC call)
- Conversation data is fully JSON-serializable (strings, booleans, nested objects)
- `loading.tsx` already exists
- No `_components/` directory yet (needs creation)
- **Child components `UnderlineTabs` and `NotificationBell` are already `'use client'`** — safe to render as children of client wrapper

**Second-pass findings that change the approach:**

1. **`useSafeFetch` is SWR-powered** (not a simple fetch wrapper). It provides stale-while-revalidate caching, 5-second deduplication, and `mutate()` for on-demand revalidation. Converting to pure SSR loses the SWR cache — re-navigation to messages becomes a full server round-trip instead of instant SWR cache hit (~200ms).
2. **Query logic can't be shared** between API route and server component without ~90 lines of duplication. The API route uses `requireDomainUser()` + `NextResponse.json()` wrappers that don't apply in server components.
3. **Tab state uses sessionStorage** (line 47-48: `sessionStorage.getItem('dockwalker:messages-tab')`). This is client-only — server component can't initialize it, causing a hydration mismatch or layout shift.
4. **The "1-2s saving" only applies to cold first load.** On re-navigation (the common case), SWR cache provides data in ~200ms. SSR replaces this with a full server fetch.

**Revised architecture — SSR for first paint, SWR for re-navigation:**

- Server component fetches initial conversations and passes as prop
- Client component receives `initialConversations` but ALSO keeps `useSafeFetch` for subsequent navigation/revalidation
- Client initialises SWR cache with the server-provided data (SWR `fallbackData` option) so re-navigation is still instant

**Implementation:**

- [ ] **Step 0 (BLOCKING — do before any code split):** Read `apps/web/src/hooks/use-safe-fetch.ts` and verify that `useSafeFetch` passes SWR config options through to the underlying `useSWR` call. Specifically, confirm it accepts and forwards `fallbackData`. If it does NOT, modify the hook to accept an optional second argument of SWR config options and spread them into the `useSWR` call. Without this, the hybrid SSR+SWR pattern silently fails — the client ignores `initialConversations` and fires a redundant fetch on mount (double data load, flash of loading state, worse UX than before).
- [ ] Create `messages/_components/messages-client.tsx` with `'use client'` — receives `initialConversations` prop.
- [ ] Rewrite `messages/page.tsx` as Server Component: fetch conversations server-side by calling the Supabase queries directly (duplicate the query logic — do NOT try to import from the API route, they use different auth patterns).
- [ ] Client component uses `useSafeFetch('/api/messages', { fallbackData: { conversations: initialConversations } })` to get both SSR first paint AND SWR cache benefits on re-navigation.
- [ ] Client component handles tab switching (sessionStorage), unread count updates, and animations.
- [ ] Update tests.
- [ ] **Rollback plan:** Restore `'use client'` directive to page.tsx, delete messages-client.tsx, restore original page logic. Should take <15 minutes.

**Expected saving:** 1-2s on FIRST load only. Re-navigation unchanged (SWR cache preserved).

**Success criteria for proceeding to 3A/3C/3D:** Messages SSR works in production for 48 hours with zero regressions.

---

#### 3C. Convert profile page to hybrid Server/Client Component

**Problem:** 100% client-rendered. Profile data (3 parallel API calls) must complete before any content appears.

**Verified (stress test):**

- 38 `useState` hooks (heavily form-oriented) — all must move to client component
- View-mode data (profile, experiences, availability) can be pre-fetched server-side
- Edit form must remain client-side
- `_components/` directory already exists (12 files)
- `loading.tsx` already exists
- All data is fully JSON-serializable

**Implementation:**

- [ ] Create `profile/_components/profile-client.tsx` with `'use client'`.
- [ ] Server component fetches profile, availability, and experiences in parallel via `Promise.all`.
- [ ] Client handles edit mode, avatar upload, hat switching, and form interactions.
- [ ] Update tests.
- [ ] **Rollback plan:** Same as 3B — restore `'use client'`, delete client wrapper, restore original.

**Expected saving:** 1-2s on the profile page.

---

#### 3D. Convert daywork/mine page to hybrid Server/Client Component

**Problem:** 100% client-rendered with the sequential engagement fetch waterfall (addressed in 2C but SSR eliminates the client waterfall entirely).

**Verified (stress test):**

- 21 `useState` hooks — moderate complexity
- `_components/` directory already exists (9 files)
- `loading.tsx` already exists
- **Complication:** Direct Supabase client query for engagements (line 146-151) can't move server-side as-is. Needs either: (a) move engagement query to an API route, or (b) use server-side Supabase client. Option (b) is cleaner since we're already in a Server Component.

**Implementation:**

- [ ] Create `daywork/mine/_components/mine-client.tsx` with `'use client'`.
- [ ] Server component fetches all 4 data sources + engagements in parallel using server-side Supabase client.
- [ ] Client handles tab switching, filter changes, position editing, relisting, and template management.
- [ ] Update tests.
- [ ] **Rollback plan:** Same pattern as 3B/3C.

**Expected saving:** 1-2s on the My Jobs page.

---

#### 3A. Convert discover page to hybrid Server/Client Component (LAST — highest risk)

**Problem:** The discover page is 100% client-rendered (`'use client'` on line 1). The browser shows nothing until JS loads, parses, hydrates, and useEffect fires the API call. This is the #1 cause of 5-10s LCP.

**STRESS TEST FINDINGS — significantly more complex than originally estimated:**

| Hook type                    | Original plan estimate | Actual count                                                                              |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| useState                     | 20                     | **35-44**                                                                                 |
| useEffect                    | 6                      | **8**                                                                                     |
| useCallback                  | 6                      | **7**                                                                                     |
| useRef                       | not mentioned          | **3**                                                                                     |
| Context hooks                | 1                      | **3** (useRouter, useLookups, useToast)                                                   |
| Dynamic imports (ssr: false) | not mentioned          | **5** (AvailabilityOverlay, ProfileOverlay, PermanentJobFeed, AppliedTab, InvitationsTab) |

**Additional risks not in original plan:**

1. **5 dynamic imports with `ssr: false`** must stay in client component — accidentally including them in server component causes double-render or failure
2. **sessionStorage/localStorage reads on mount** (activeTab, browseMode) — client-only APIs, server can't pre-populate, potential layout shift on hydration
3. **`startTransition` for deferred loads** — React 18 concurrency feature, client-only
4. **Shared query extraction** creates coupling between API route and SSR path — if shared function bugs, both break simultaneously

**Revised effort estimate: 6-10 hours** (was 4-6)

**GATE:** Only attempt after 3B + 3C + 3D are stable in production. If those three already achieve the LCP target, skip 3A.

**Architecture:**

- The **page** component (`discover/page.tsx`) becomes a Server Component that fetches the initial batch of cards server-side.
- ALL interactive logic (35+ states, filters, swipe, tabs, 5 dynamic imports) moves to `discover/_components/discover-client.tsx` (new file, `'use client'`).
- Server Component fetches initial 20 cards -> streams HTML -> `loading.tsx` skeleton shows during fetch -> client hydrates for interactivity.

**Implementation:**

- [ ] Create `discover/_components/discover-client.tsx` — move ALL existing page logic (imports, state, effects, handlers, JSX, dynamic imports) into this new Client Component. It accepts `initialCards: DayworkCard[]` prop.
- [ ] Rewrite `discover/page.tsx` as a Server Component:

  ```tsx
  // discover/page.tsx (Server Component — NO 'use client')
  import { redirect } from 'next/navigation';
  import { createClient } from '@/lib/supabase/server';
  import { DiscoverClient } from './_components/discover-client';

  export default async function DiscoverPage() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/auth/login');
    const hat = user.app_metadata?.current_hat;
    if (hat === 'employer') redirect('/daywork/mine');
    const initialCards = await fetchDiscoverCards(supabase, user.id);
    return <DiscoverClient initialCards={initialCards} />;
  }
  ```

- [ ] Extract the discover query logic from `api/daywork/discover/route.ts` into a shared function that both the API route and the server component can call. **Risk mitigation:** Add a try/catch in the server component — if the shared function throws, pass `initialCards={[]}` and let the client retry via its existing `loadCards()` effect.
- [ ] The client component uses `initialCards` for first render (instant LCP), then takes over with client-side `loadCards()` for pagination, filter changes, and swipe.
- [ ] Verify all 5 dynamic imports (`ssr: false`) are in the client file, NOT the server file.
- [ ] Verify sessionStorage/localStorage reads happen only in useEffect (client-side), not during render.
- [ ] Verify `loading.tsx` skeleton shows during the server-side data fetch.
- [ ] Update tests — the page is no longer a pure client component.
- [ ] Verify swipe mechanics, filter changes, pagination, and all tabs still work after hydration.
- [ ] **Rollback plan:** Restore `'use client'` to discover/page.tsx, inline the client logic back, delete discover-client.tsx. More complex than other rollbacks (~30 minutes) due to shared query extraction.

**Expected saving:** 2-4s on slow networks. Initial cards render as streamed HTML — no JS parse/hydrate/fetch waterfall.

**Risk:** HIGH. This is the riskiest item in the entire plan.

---

### ~~Phase 4 — Infrastructure & Caching~~ (merged/dropped)

#### ~~4A. Add stale-while-revalidate caching to discover API~~ DROPPED

**STRESS TEST VERDICT: NOT VIABLE.** The discover API response is per-user — it excludes jobs the user already applied to and the user's own postings. CDN caching with `Vary: Cookie` creates one cache entry per user, defeating the purpose.

---

#### ~~4B. Preconnect to Supabase from client~~ DROPPED

**STRESS TEST VERDICT: INEFFECTIVE.** Supabase connection is already established in middleware (runs on every request) and app layout (server-side `createClient()`). By the time the browser receives the HTML with the preconnect hint, the server has already talked to Supabase. Client-side queries fire via `useEffect` after hydration, by which time DNS is already resolved. Expected savings: 0-50ms. Not worth the code change.

---

#### 4C. Next.js Image optimisation configuration — MOVED to Phase 1 (prerequisite for 1C)

---

### Phase 5 — Post-Implementation Validation

> Prove the improvements and catch regressions.

#### 5A. Measure final LCP

- [ ] Re-run Lighthouse on all 6 pages. Compare to baseline.
- [ ] Document final results in `tasks/perf-baseline.md` and `BUILD_STATE.md` stage entries.

#### 5B. Real-device testing

- [ ] Test on a real phone over 4G — measure perceived load time for discover page.
- [ ] Test on slow Wi-Fi (throttle to 1Mbps) — verify skeleton appears within 500ms.
- [ ] Test cache behaviour: first visit (cold) vs. second visit (warm lookups cache) — verify warm is noticeably faster.
- [ ] Test Safari specifically — verify notification badge deferral works (2D Safari guard).
- [ ] Test brand-new user signup flow — verify JWT fallback in layout works (1A fallback path).

---

## Stress Test Log

> Issues found during plan stress-testing (2026-04-10). Kept here for audit.

| Item    | Original Assumption                            | Finding                                                                                                                                                                                                                                       | Resolution                                                                                            |
| ------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1A      | Can skip persons query entirely                | Brand-new users lack JWT claims until token refresh                                                                                                                                                                                           | Added mandatory fallback to DB query                                                                  |
| 1C      | Just remove `unoptimized`                      | `next.config.ts` has no `images.remotePatterns` — would break all avatars                                                                                                                                                                     | Made `remotePatterns` a blocking prerequisite step (moved 4C before 1C)                               |
| 1C      | Removing `unoptimized` is enough               | Avatar has no `sizes` prop — Next.js generates 8 responsive variants (640-3840px) for 32-80px images, INCREASING bandwidth                                                                                                                    | Added `sizes` prop as mandatory step                                                                  |
| 2A      | Switch cards to ID-based lookups resolution    | Race condition on first visit (empty cache), 18-22 files need atomic update, mobile code breaks                                                                                                                                               | Scoped down: only remove cert resolution + reduce batch size. Keep nested joins.                      |
| 2A      | 50->20 batch is pure win                       | 2.5x more API calls for heavy swipe users; auto-load at 5 cards triggers more often                                                                                                                                                           | Added rate limiter monitoring note                                                                    |
| 2B      | All 3 post-engagement queries are equal        | `get_unread_counts` RPC doesn't need engagement IDs — can run earlier                                                                                                                                                                         | Changed to two-tier parallelism                                                                       |
| 2D      | `requestIdleCallback` works everywhere         | Safari (iOS + macOS) does NOT support it as of 17.4                                                                                                                                                                                           | Added browser feature guard with setTimeout fallback                                                  |
| 2E      | SWR is risk-free                               | Stale lookups could show renamed roles or deleted certs                                                                                                                                                                                       | Documented as acceptable trade-off (rare changes, <2s window, IDs not names used in submissions)      |
| 3A      | 20 useState, 2-4 hour effort                   | 35-44 useState, 8 useEffect, 5 dynamic imports (ssr:false), 3 useRef                                                                                                                                                                          | Revised to 6-10 hours, moved to LAST in Phase 3, added gate condition                                 |
| 3A      | Clean server/client split                      | sessionStorage/localStorage reads on mount, startTransition, shared query coupling                                                                                                                                                            | Added specific risk mitigations for each                                                              |
| 3D      | Engagement query moves to server trivially     | Client Supabase query uses client auth token                                                                                                                                                                                                  | Noted: use server-side Supabase client instead                                                        |
| 4A      | CDN stale-while-revalidate on discover         | Response is per-user (excludes applied jobs) — CDN creates per-user entries                                                                                                                                                                   | **DROPPED from plan entirely**                                                                        |
| 4B      | Preconnect saves 100-200ms                     | Supabase connection already established in middleware before page renders                                                                                                                                                                     | **DROPPED — ineffective (0-50ms real savings)**                                                       |
| General | Phases can run in parallel                     | Phase 2A and 3A touch same files (discover page, card types)                                                                                                                                                                                  | Added ordering constraint: 2A must merge before 3A starts                                             |
| General | Phase 3 is always worth doing                  | Phase 1+2 may meet the target on their own                                                                                                                                                                                                    | Added Phase 2 checkpoint gate — skip Phase 3 if target met                                            |
| General | No rollback plans needed                       | SSR conversion is hard to revert without planning                                                                                                                                                                                             | Added explicit rollback plan for every item                                                           |
| 1A      | JWT person_id might differ from user.id        | `persons.id` is FK to `auth.users(id)` — always identical. `app_metadata` is server-only, not client-writable. All API routes validate hat independently.                                                                                     | Confirmed safe — no security risk                                                                     |
| 1C      | minimumCacheTTL: 86400 is fine                 | If Supabase storage has a temporary outage, Next.js caches the error response for the full TTL. 24h of broken avatars after a 5-min outage.                                                                                                   | **Reduced TTL to 3600 (1 hour)**                                                                      |
| 1C      | Removing unoptimized is the only avatar change | `avatar-upload.tsx` uses blob URL in preview (safe — raw `<img>` not Next.js Image). But post-upload display needs verification with cache buster.                                                                                            | Added Step 6: verify post-upload display                                                              |
| 2A      | Can remove cert resolution client-side         | `daywork-card.tsx` does NOT import `useLookups` — adding it makes every swipe card a context consumer inside Framer Motion. Cert pill color uses array index correlation between cert_names and cert_ids — fragile to client-side resolution. | **Dropped cert removal from 2A. Keep server-side resolution.**                                        |
| 2C      | Speculative engagement query is equivalent     | Dropping `.in('daywork_id', ipIds)` fetches ALL employer engagements, not just in-progress. Could show Chat buttons on wrong cards.                                                                                                           | **Added MANDATORY client-side filter step**                                                           |
| 2E      | Changing loading state might break consumers   | Zero consumers check `lookups.loading` (grepped all 10 files). Onboarding uses separate local state. All form submissions validate IDs server-side.                                                                                           | Confirmed safe — no rendering breakage                                                                |
| 3B      | useSafeFetch is a simple wrapper               | It's SWR-powered with caching, deduplication, and `mutate()`. Pure SSR loses re-navigation cache hits (~200ms).                                                                                                                               | Changed to hybrid: SSR first paint + SWR `fallbackData` for re-navigation                             |
| 3B      | Can reuse API route query logic                | API route uses `requireDomainUser()` + `NextResponse.json()` — incompatible with server components. ~90 lines would need duplication.                                                                                                         | Noted: duplicate queries, don't import from API route                                                 |
| 2A      | Notes can be removed and fetched on demand     | There is no detail/expanded view for discover cards. Notes are shown inline on swipe cards and are the primary way crew read employer descriptions. Removing = product regression.                                                            | **Kept notes in response.** ~1-2KB for 20 cards — negligible.                                         |
| 2D      | Deferred callback is fire-and-forget           | If user navigates away before callback fires, stale callback updates unmounted component state (React warning / wrong page state).                                                                                                            | **Added mandatory cleanup** with `cancelIdleCallback`/`clearTimeout` in useEffect return.             |
| 3B      | `useSafeFetch` accepts `fallbackData` option   | `useSafeFetch` is a wrapper — it may not pass SWR config options through. If it doesn't, client ignores `initialConversations` and double-fetches (flash of loading, worse UX).                                                               | **Added blocking Step 0:** verify/modify `useSafeFetch` to forward SWR options before any code split. |

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

### Visual verification (manual)

- [ ] Cards show visible department tint with per-card angle variation
- [ ] Cards look consistent across discover, market, and messages
- [ ] Skeleton dimensions match real content (no layout shift)
- [ ] Discover page works with size band filter applied server-side
- [ ] Confirm 8 fewer lookups queries on warm page load
- [ ] Add `aria-label` to icon-only buttons (audit chat-header.tsx, bottom-nav.tsx)

### Rate limiting local test (manual)

- [ ] Test locally: >100 requests to `/api/health` in 60s (should pass, exempted). >100 requests to `/api/profile` (should 429 if Redis configured, pass-through if not). >30 POST requests to `/api/daywork` in 60s (should 429 on write limit).

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

(See git history for completed stages 51-203. Recent: Stage 203 LCP performance fixes — animation removal, skeleton cards, deferred profile/availability fetches, try/catch gaps.)
