# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix 165: Phase 2 review findings — cert gate, cleanup, persistence

---

## Queue

### 0. Fix 165 — Phase 2 review findings

**Context:** Planning agent review of Stage 164-165 found 3 incomplete items and 1 minor cleanup.

#### A. Permanent apply needs bottom sheet + cert hard-gate (MISSING UX)

The permanent apply currently uses `Alert.alert` (discover.tsx lines 80-100). The checklist specified a proper bottom sheet with cert enforcement. This is a significant UX gap — the whole point is to tell crew WHICH certs they need.

- [x] Create `apps/mobile/src/components/permanent-detail-sheet.tsx` — `@gorhom/bottom-sheet` matching the daywork `job-detail-sheet.tsx` pattern but with permanent-specific fields (salary range, live aboard, shortlist cap, contract type, start date)
- [x] Add cert hard-gate logic: read crew's `certification_ids` from their profile (direct Supabase read via `useAuth` person data or a profile query), compare against posting's `required_certification_ids`. If missing any, show the missing cert names and disable the Apply button.
- [x] Add 250-char optional message input (same as daywork detail sheet)
- [x] Replace the `Alert.alert`` in discover.tsx with opening this bottom sheet on permanent card press
- [x] When the Apply button is enabled and pressed, call `apiPost('/api/permanent/[id]/apply')` with optional message

#### B. Delete `swipe-test.tsx` (MISSED CLEANUP)

- [x] Delete `apps/mobile/app/(app)/swipe-test.tsx`.tsx` — was marked done in the checklist but the file is still committed

#### C. Persist discover toggle in MMKV (MISSED ITEM)

- [x] Import MMKV storage in the discover screen
- [x] Read initial `mode`` from MMKV on mount (default `'daywork'` if not set)
- [x] Write `mode` to MMKV on toggle change
- [x] The toggle should remember its state across tab switches and app restarts

#### D. Remove `positions_filled` from daywork query (MINOR)

- [x] In `use-daywork-discover.ts`, removed `positions_filled`` from both the `.select()`string (line 104) and the`RawDaywork` interface (line 28). This column is fetched but never used — crew should not see fill counts.

#### E. Verify

- [x] `turbo run type-check` passes
- [x] Permanent job card tap opens bottom sheet (not Alert), shows cert gate when certs missing
- [x] Discover toggle persists across tab switches

---

### 1. Phase 2 device verification (deferred from implementation — requires simulator)

- [ ] Daywork swipe feels native — spring physics, haptics, rotation, overlay indicators all smooth at 60fps
- [ ] Permanent feed scrolls smoothly with FlashList — no jank on fast scroll
- [ ] Apply flow works end-to-end: swipe right → API call → card removed → confirmation haptic
- [ ] Availability gate blocks daywork apply when no availability set
- [ ] Filter panel opens/closes smoothly, filters affect the feed
- [ ] Skeleton loading states shown during initial data fetch

---

### 2. Quick wins — production deploy (user action)

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

(See git history for completed stages 51-165, UI-0 through UI-19, all fix batches, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, Capacitor dead-end cleanup, mobile Phase 1 monorepo + shell + auth, mobile Phase 2 discovery + swipe)
