# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Mobile Phase 2: Discovery + Swipe — highest risk phase, prototype swipe first

---

## Queue

### 1. Core dependencies + data layer

**Context:** Install the native-feel libraries from the spec (Section 5) and set up TanStack Query + the data fetching pattern before building any screens. Reference: `tasks/mobile-web-split-spec.md` Sections 4-5.

#### 1a. Install native-feel libraries

- [x] Install FlashList: `npx expo install @shopify/flash-list`
- [x] Install bottom sheet: `npm install @gorhom/bottom-sheet` (requires `react-native-reanimated` + `react-native-gesture-handler` — already installed)
- [x] Install keyboard controller: `npm install react-native-keyboard-controller`
- [x] Install MMKV: `npm install react-native-mmkv`
- [x] Install TanStack Query: `npm install @tanstack/react-query`
- [x] Verify `turbo run type-check` passes with all new deps

#### 1b. TanStack Query setup

- [x] Create `apps/mobile/src/lib/query-client.ts` — configure `QueryClient` with defaults: `staleTime: 5 * 60 * 1000` (5 min), `gcTime: 30 * 60 * 1000` (30 min), `networkMode: 'offlineFirst'`, `retry: 2`
- [x] Wrap root layout in `QueryClientProvider`
- [x] Create `apps/mobile/src/lib/api.ts` — helper for authenticated write requests to Vercel API. Pattern: `apiPost<T>(path, body)` that reads `EXPO_PUBLIC_API_BASE_URL`, gets the Supabase session token, sends `Authorization: Bearer <token>`, handles errors the same way `safeFetch` does on web (discriminated union: `{ ok, data } | { ok: false, error }`). All writes go through this.

#### 1c. Canonical data hooks

The discover feed needs lookup data (roles, certs, ports, experience brackets, size bands) for filters and display. These are small, rarely-changing tables — cache aggressively.

- [x] Create `apps/mobile/src/hooks/use-canonical.ts` — TanStack Query hooks that fetch directly from Supabase: `useRoles()`, `useCertifications()`, `usePorts()` (with cities + regions), `useExperienceBrackets()`, `useSizeBands()`. Each returns `{ data, isLoading }`. `staleTime: Infinity` (canonical data doesn't change during a session).
- [x] Verify with the real Supabase tables: `yacht_roles`, `certifications`, `ports` (join cities, regions), `experience_brackets`, `vessel_size_bands`

---

### 2. Daywork job card + swipe prototype

**Context:** Build the card component FIRST so the swipe prototype renders real-shaped content, not placeholder boxes. Then build and test the swipe stack. If the swipe doesn't feel native after tuning, STOP and escalate. Reference: `tasks/mobile-web-split-spec.md` Section 5 (native-feel patterns) and Section 11 (risk register).

#### 2a. Daywork job card component

- [x] Create `apps/mobile/src/components/daywork-job-card.tsx` — card content for the swipe stack. Shows:
  - Role name + department color bar (from `@dockwalker/shared` epaulettes)
  - Vessel name (or "NDA Vessel") + type prefix (M/Y, S/Y) + size band + LOA
  - Location (port, city, region)
  - Date range + working days
  - Day rate + currency symbol (from `@dockwalker/shared` units)
  - Required certs as pills
  - Experience bracket
  - Meals badges
  - Job reference (DW-XXXXX)
  - "Posted X days ago"
- [x] Use `expo-image` for any avatar/image if applicable (vessel photos deferred)
- [x] Skeleton loading variant for when data is still loading

#### 2b. Swipe card stack component

- [x] Create `apps/mobile/src/components/swipe-card-stack.tsx` — a reusable swipe card stack using `react-native-gesture-handler` `Gesture.Pan()` (RNGH v2 API) + `react-native-reanimated` shared values.
- [x] Card renders children (any content). Stack shows top card + peek of next card behind.
- [x] Swipe right = accept action. Swipe left = reject action. Swipe threshold: 40% of screen width.
- [x] Spring physics on release: `withSpring(targetX, { damping: 20, stiffness: 200 })` — tune until snap feels like iOS native. Card should overshoot slightly then settle.
- [x] Card rotation follows drag: `interpolate(translateX, [-width, 0, width], [-15, 0, 15])` degrees.
- [x] Haptic feedback at swipe threshold: `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` when crossing the commit point.
- [x] Overlay indicators: green "Apply" label fades in on right drag, red "Pass" on left drag. Opacity tracks drag progress.
- [x] On swipe complete, card animates off-screen, next card springs into position.
- [x] Expose callbacks: `onSwipeRight(item)`, `onSwipeLeft(item)`, `onCardPress(item)`.
- [x] Touch feedback on the card itself: `Pressable` with Reanimated spring scale (0.98) on press-in.

#### 2c. Test swipe with mock data

- [x] Create a test screen at `apps/mobile/app/(app)/swipe-test.tsx` (temporary — remove before Phase 2 complete)
- [x] Render `SwipeCardStack` with 10 mock `DayworkJobCard` instances (hardcoded data matching the real card shape)
- [ ] Verify on device/simulator: swipe feels native, spring physics are right, haptics fire, rotation looks natural
- [ ] If the swipe doesn't feel right after tuning, STOP and tell the user. This is the highest-risk component.

---

### 3. Daywork discover — data + wiring

**Context:** Connect the swipe stack to real data. Direct Supabase reads with TanStack Query caching. Reference: web's `apps/web/src/app/api/daywork/discover/route.ts` for the exact query shape.

#### 3a. Daywork discover query

- [x] Create `apps/mobile/src/hooks/use-daywork-discover.ts` — TanStack Query hook that queries Supabase directly:
  - `dayworks` table, status `active`, ordered by `created_at DESC`, limit 50
  - Joins: `yacht_roles(id, name, department)`, `ports(id, name, cities(name, regions(name)))`, `experience_brackets(label)`
  - Excludes: own postings (`poster_person_id != user.id`), already-interacted postings (applications where crew_person_id = user.id)
  - Vessel data: call `get_vessel_public` RPC for each posting's vessel (NDA-safe)
  - Filters: `roleId`, `portId`, `certificationId`, `experienceBracketId` as query params
  - Match the exact query logic in `apps/web/src/app/api/daywork/discover/route.ts` — read that file first
- [x] Return typed data matching the web's discover response shape

#### 3b. Job detail bottom sheet

- [x] Create `apps/mobile/src/components/job-detail-sheet.tsx` — `@gorhom/bottom-sheet` with scrollable content showing full job details. Opens on card tap (from `onCardPress`).
- [x] Shows all card fields plus: notes, positions available, poster display name
- [x] "Apply" button at bottom (calls Vercel API `POST /api/daywork/[id]/apply`)
- [x] Optional message input (250 char limit) — expandable textarea above the Apply button
- [x] Cert mismatch advisory (soft gate — warn but don't block for daywork)

#### 3c. Wire daywork discover screen

- [x] Replace placeholder discover tab screen with the real daywork browse
- [x] Feed the TanStack Query data into `SwipeCardStack` rendering `DayworkJobCard` per item
- [x] Swipe right triggers apply (via `apiPost('/api/daywork/[id]/apply')`)
- [x] Swipe left passes (client-side only — card removed from stack, no API call)
- [x] After swipe, TanStack Query cache updated optimistically (remove the card)
- [x] Pull-to-refresh with native `RefreshControl` + haptic at trigger threshold
- [x] Empty state when no more cards: "No more daywork in your area" with refresh button
- [x] Loading state: skeleton card placeholders (not a spinner)
- [x] Remove temporary `swipe-test.tsx` screen

---

### 4. Permanent discover screen

**Context:** Scrollable feed, not swipe cards. Different UX from daywork — deliberate browsing. Reference: web's `apps/web/src/app/api/permanent/discover/route.ts` for query.

#### 4a. Permanent discover query

- [x] Create `apps/mobile/src/hooks/use-permanent-discover.ts` — TanStack Query hook with cursor-based pagination (20 per page). Direct Supabase read of `permanent_postings` (status `active` or `in_negotiation`), ordered by `created_at DESC`. Same exclusion/join pattern as daywork but with permanent-specific fields (salary, live aboard, shortlist cap).
- [x] Match the query in `apps/web/src/app/api/permanent/discover/route.ts`

#### 4b. Permanent job card

- [x] Create `apps/mobile/src/components/permanent-job-card.tsx` — list card (not swipe) showing:
  - Role + department badge
  - Vessel (NDA-safe) + type + size
  - Location
  - Salary range + currency + period (monthly/annual)
  - Live aboard badge
  - Required certs
  - Start date (or "ASAP" if past)
  - Shortlist capacity (static, not live fill count — per spec, crew never sees fill counts)
  - Contract type (if not "permanent")
  - Job reference (PM-XXXXX)
  - "Posted X days ago"
- [x] Render in `FlashList`` with `estimatedItemSize={180}` (tune after seeing real cards)

#### 4c. Permanent job detail + apply

- [x] Permanent job detail bottom sheet — same pattern as daywork but with permanent fields
- [x] Apply button calls/[id]/apply` via Vercel API
- [x] Cert hard-gate: if crew is missing required certs, show which certs are missing and disable the Apply button. Read crew's cert list from profile (direct Supabase read).
- [x] Optional 250-char message with application

#### 4d. Wire into discover tab with toggle

- [x] Add toggle at top of discover screen: `[Daywork | Permanent]` — segmented control
- [x] Daywork mode: swipe card stack
- [x] Permanent mode: scrollable FlashList feed with pull-to-refresh
- [x] Toggle state persisted in MMKV so it remembers across tab switches

---

### 5. Filter panel

- [x] Create `apps/mobile/src/components/discover-filters.tsx` — bottom sheet with filter controls:
  - Role (hierarchical picker — department → role, reuse grouping logic from `@dockwalker/shared`)
  - Certification
  - Location (port picker — region → city → port hierarchy)
  - Experience bracket
  - Size band (permanent + daywork)
  - Salary range (permanent only)
  - Live aboard toggle (permanent only)
- [x] Active filters shown as dismissible pills above the feed/stack
- [x] Filter state stored in Zustand (or local component state) — not persisted across app restarts
- [x] Filters applied to the TanStack Query hooks as query params

---

### 6. Availability gate

**Context:** Separated from the main discover flow so the core swipe + feed works first. This adds the enforcement layer on top. Availability is required before crew can apply to daywork.

- [x] Create `apps/mobile/src/hooks/use-availability.ts` — TanStack Query hook, direct Supabase read of `availability_windows` for the current user (match web's GET /api/availability query pattern)
- [x] Before allowing daywork apply: check if crew has active availability. If not, show availability overlay prompt instead of applying.
- [x] Create `apps/mobile/src/components/availability-overlay.tsx` — bottom sheet with 14-day date grid + location picker (hierarchical: region → city → port). On confirm, calls Vercel API `POST /api/availability` to set availability. On success, dismiss overlay and allow the apply to proceed.

---

### 7. Phase 2 verification

- [x] `turbo run type-check` passes for all workspaces
- [ ] Daywork swipe feels native on iOS simulator — spring physics, haptics, rotation, overlay indicators all smooth at 60fps
- [ ] Permanent feed scrolls smoothly with FlashList — no jank on fast scroll
- [ ] Apply flow works end-to-end: swipe right → API call → card removed → confirmation haptic
- [ ] Availability gate blocks daywork apply when no availability set
- [x] Cert hard-gate blocks permanent apply when certs missing
- [ ] Filter panel opens/closes smoothly, filters affect the feed
- [x] Pull-to-refresh works with haptic feedback
- [ ] Skeleton loading states shown during initial data fetch
- [x] Web app completely unaffected

---

### 8. Quick wins — production deploy (user action)

- [ ] Deploy migrations 00076 + 00077 to production Supabase

---

## Backlog

> Active backlog. Pick items into Queue when ready. Items tagged (web), (mobile), or (both).
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** (both) — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert. Full spec in git history.
- **Onboarding true atomicity** (both) — `onboard_person` RPC should be fully atomic; currently partial failure is possible on batch experience inserts.
- **Negotiation timeout** (both) — auto-close permanent engagements after X days of inactivity in negotiation. Server-side cron.
- **Weekly check-in cron** (both) — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** (both) — force session invalidation when `PERSON.DEACTIVATED` fires.

### Web-only UI

- **OG social sharing image** (web) — see `tasks/founder-drafts.md` § 7 for spec.
- **Agent market as discover mode** (web) — let agents browse the full market feed, not just their own postings.
- **Form validation — styled inline errors** (web) — replace browser-native validation with styled inline messages (SUG-012).
- **Invalid URL error pages** (web) — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** (web) — seed data shows "Unknown vessel" for employer-owned vessels in crew experience edit (SUG-017).
- **Applicant count badge on My Jobs** (both) — show pending applicant count on posting cards in My Jobs.
- **Discover filter chips** (both) — show active filters as dismissible pills above the feed.
- **Notifications grouping** (both) — group notifications by date or engagement instead of flat list.
- **Email: List-Unsubscribe header** (web) — add RFC 8058 header to transactional emails.

### Testing

- **Resilience tests** (web) — network failure, timeout, and retry scenarios for API routes.
- **Component tests for Permanent UI** (web) — unit tests for permanent posting components.
- **Component tests for Form Pickers** (web) — unit tests for hierarchical pills, location picker, role picker.

### Superseded by mobile split

- ~~Billing IAP bypass redesign~~ — replaced by `tasks/mobile-web-split-spec.md` Section 10.
- ~~Swipe card momentum~~ — mobile builds native swipe from scratch; web swipe stays as-is.
- ~~Haptics on toggles/filters~~ — Capacitor haptics are dead; mobile uses `expo-haptics` natively.

---

## Done

(See git history for completed stages 51-163, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 monorepo + shell + auth)
