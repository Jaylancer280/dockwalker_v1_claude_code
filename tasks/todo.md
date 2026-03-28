# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

TestFlight fix sweep — all items blocking or degrading the beta experience

---

## Queue

### 1. Quick wins batch — experience brackets production deploy (user action)

- [ ] Deploy migration 00076 to production Supabase

---

### 2. Role gate fixes — crew on review page + employer on discover (SUG-001, SUG-016)

**Two bugs where the wrong hat sees the wrong page.**

**A. SUG-001 — Crew on `/daywork/[id]/review` sees employer UI:**

- [ ] `apps/web/src/app/(app)/daywork/[id]/review/page.tsx` — add `current_hat` check. If crew, redirect to the engagement/messages view (or show crew-specific application status). Do NOT render the employer Applicants/Shortlist/Available tabs.
- [ ] Same check for `apps/web/src/app/(app)/permanent/[id]/review/page.tsx` — crew should not see the employer review UI.

**B. SUG-016 — Employer not redirected from `/discover`:**

- [ ] `apps/web/src/middleware.ts` (or `proxy.ts`) — the discover redirect only checks `identity_type === 'agent'`. It misses crew users with `current_hat = 'employer'`.
- [ ] Fix: change condition to `if ((person.identity_type === 'agent' || person.current_hat !== 'crew') && path === '/discover')` → redirect to `/daywork/mine`.
- [ ] Also check the client-side fallback in `apps/web/src/app/(app)/discover/page.tsx` (the `loadCrewCerts` redirect) — ensure it catches employer hat too.

**Done condition:** Crew on review pages sees their own application status, not employer UI. Employer on /discover is redirected to /daywork/mine.

---

### 3. Seed data overhaul — realistic names, crew-owned vessels, avatar, completeness

**Problem:** The seed data is half-baked placeholder garbage. Beta testers see "Profile One", "M/Y Unknown vessel", empty profiles, and a single employer posting every job. This is the first thing real users interact with.

**Files:** `supabase/seed/002_test_profiles.sql`, `supabase/seed/003_advanced_scenarios.sql`

**A. Realistic profile names and bios:**

- [ ] Replace "Profile One" → e.g. "Hein van der Merwe" (employer, Captain, 15yr experience)
- [ ] Replace "Profile Two" → e.g. "James Thornton" (crew, Deckhand, 3yr experience)
- [ ] Replace "Profile Three" → e.g. "Sophie Laurent" (crew, Stewardess, 8mo experience)
- [ ] Replace "Profile Five" → e.g. "Victoria Chase" (agent, Meridian Yacht Crew)
- [ ] Update bios to match new names

**B. Set avatar_url on all seed profiles:**

- [ ] Copy `assets/branding/DockWalker_App_Icon_Kit/DockWalker_AppIcon_1024_new.png` (or `small_128.png`) to `apps/web/public/images/dw-system-avatar.png`
- [ ] In the `onboard_person` calls, add `'avatar_url', '/images/dw-system-avatar.png'` to the payload JSON
- [ ] Verify the Avatar component renders correctly

**C. Crew must own their own vessels for experiences:**

- [ ] For c@1: create crew-owned copies of S/Y Wanderer, M/Y Serenity, M/Y Phantom (same IMOs, new UUIDs, owner = c@1)
- [ ] Update `crew_experiences` to reference crew-owned vessel UUIDs
- [ ] For g@1: verify M/Y Azure Dream is already owned by g@1
- [ ] Verify: crew's "My Vessels" page shows their vessels. Experience cards show correct names.

**D. Remove duplicate experiences:**

- [ ] Remove direct INSERTs from `002_test_profiles.sql` (lines 226-255)
- [ ] Let `003_advanced_scenarios.sql` handle all experiences via events
- [ ] Keep `derive_experience_profile()` only AFTER all experiences in 003

**E. Set nationality and visas on profiles:**

- [ ] Add `nationality_id` to onboard payloads (South African for Hein, British for James, French for Sophie)
- [ ] Add `visa_ids` where appropriate
- [ ] Eliminates "Complete your profile" banner

**F. Give g@1 (Sophie) availability and interactions:**

- [ ] Set daywork availability (next 14 days in Palma)
- [ ] Set permanent availability to `immediate`
- [ ] Have Sophie apply to at least one daywork posting

**G. Agent (a@1) must have active postings — both daywork and permanent:**

- [ ] Add 1-2 daywork postings by agent on M/Y Meridian
- [ ] Add 2-3 permanent postings by agent — different roles, realistic salaries

**H. Diversify poster names on discover:**

- [ ] Add 2-3 more active daywork postings by agent so discover shows jobs from multiple posters

**Done condition:** Realistic names, DockWalker avatars, no "Unknown vessel", no "Complete profile" nag, discover shows jobs from multiple posters. Crew's My Vessels works.

---

### 4. Hierarchical pill picker — shared component, deployed app-wide

**Problem:** Role, cert, and location selectors are flat lists everywhere. On mobile, 20+ certs or 55 ports in a single list is unusable. The pattern should be: show category pills → user taps one → show items within that category. Tapping the selected category again deselects it and returns to the top layer.

**The component: `apps/web/src/components/hierarchical-pills.tsx`**

A single shared component supporting:

- **Single-select mode** (role picker, location picker) — selecting an item closes the drill-down
- **Multi-select mode** (cert picker, language picker) — user can select multiple items, switch categories to add more
- **Flat mode** (visas, languages if ungrouped) — no hierarchy, just pills
- Layer 1 = category pills (departments, regions, language families)
- Layer 2 = items within the selected category
- Deselect Layer 1 pill → Layer 2 disappears, back to all categories
- Visual: `rounded-full` pills, active = `bg-[var(--accent)] text-white`, inactive = `bg-[var(--card)] border border-[var(--border)]`, `transition-colors`

**A. Build the component:**

- [ ] Create `apps/web/src/components/hierarchical-pills.tsx` with props:
  ```typescript
  interface HierarchicalPillsProps {
    groups: { id: string; label: string; items: { id: string; label: string }[] }[];
    value: string | string[];
    onValueChange: (v: string | string[]) => void;
    mode: 'single' | 'multi';
    optional?: boolean;
    placeholder?: string;
  }
  ```
- [ ] Layer 1: render group pills. Tapping one expands Layer 2 below.
- [ ] Layer 2: render item pills within selected group. In multi-select, already-selected items show active state.
- [ ] Tapping selected Layer 1 pill again → collapse, show all Layer 1 pills
- [ ] In single-select: tapping a Layer 2 item calls `onValueChange` and collapses
- [ ] In multi-select: tapping toggles selection, Layer 2 stays open, user can switch groups

**B. Deploy to all role pickers (single-select, grouped by department):**

- [ ] `apps/web/src/app/(app)/daywork/post/page.tsx` — daywork post form role
- [ ] `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx` — permanent post form role
- [ ] `apps/web/src/app/(app)/profile/_components/profile-edit-form.tsx` — desired role
- [ ] `apps/web/src/app/onboarding/_components/profile-step.tsx` — onboarding role
- [ ] `apps/web/src/app/(app)/discover/page.tsx` — discover filter role

**C. Deploy to all cert pickers (multi-select, grouped by department):**

- [ ] Profile edit form — certs (replaces checkboxes, see item 5)
- [ ] Daywork post form — required certs
- [ ] Permanent post form — required certs
- [ ] Discover filters — cert filter

**D. Deploy to all location pickers (single-select, grouped by region → city → port):**

- [ ] Evaluate: LocationPicker already uses a popover drill-down. Determine if replacing with pills is better UX or if existing popover is fine. Skip if popover works.
- [ ] If replacing: all LocationPicker usages across post forms, profile edit, discover filters, onboarding

**E. Deploy to language pickers (multi-select, flat or grouped):**

- [ ] Profile edit form — languages (replaces checkboxes)
- [ ] Daywork post form — required languages
- [ ] Permanent post form — required languages

**Done condition:** One shared `HierarchicalPills` component. Roles show department → roles. Certs show department → certs. All forms use it. No flat dropdowns or checkbox lists for these fields anywhere.

---

### 5. Profile edit — duplicate Display name + use hierarchical pills

**Two problems in `apps/web/src/app/(app)/profile/_components/profile-edit-form.tsx` and `apps/web/src/app/(app)/profile/page.tsx`:**

**A. Duplicate "Display name" field (user-reported, both hats):**

- [ ] Reproduce on device or browser — confirm two "Display name" fields visible
- [ ] Find and remove the duplicate — only ONE Display name should exist, inside the form section below the avatar
- [ ] Verify fix on both hats

**B. Checkboxes must be hierarchical pill selections:**

- [ ] Replace cert checkboxes with `HierarchicalPills` — department layer → certs in department
- [ ] Replace visa checkboxes with flat pill toggles (small list, no hierarchy needed)
- [ ] Replace language checkboxes with flat pill toggles
- [ ] Remove the `max-h-40 overflow-y-auto` scroll containers

**Depends on:** Item 4 (HierarchicalPills component must be built first).

**Done condition:** One Display name field. Hierarchical pills for certs, flat pills for visas/languages. No checkboxes.

---

### 6. Page transition speed — reduce blank-screen flash between navigations

**Problem:** Every tab navigation shows a blank screen or spinner for ~2 seconds before content appears. The app feels like a slow website. Root cause: all pages are `'use client'` with `useEffect` data fetching on mount. No prefetching, no data caching between navigations.

**Files:** `apps/web/src/components/bottom-nav.tsx`, all page files under `apps/web/src/app/(app)/`

**A. Quick wins (do first):**

- [ ] **Enable Link prefetching on bottom nav** (`bottom-nav.tsx`): `<Link href={item.href} prefetch={true}>`
- [ ] **Cache profile data in sessionStorage** with 60-second TTL so repeat navigations reuse it instantly
- [ ] **Add `loading.tsx` skeleton screens** to high-traffic routes (`discover`, `messages`, `profile`, `daywork/mine`)

**B. Architectural improvement (SWR/stale-while-revalidate):**

- [ ] Install `swr` package and create `useSafeFetch` hook wrapping `safeFetch` with SWR caching
- [ ] Convert discover page to use SWR
- [ ] Convert messages page to use SWR
- [ ] Convert profile page to use SWR
- [ ] Convert daywork/mine page to use SWR
- [ ] Test: navigate between tabs rapidly. Each tab should show content immediately on second visit.

**Done condition:** Second visit to any tab renders content instantly (no spinner). First visit shows a skeleton screen instead of blank white.

---

### 7. UX hardening — confirmation dialogs, error feedback, completeness hints

**Batch of UX fixes found during full audit. Each is small individually.**

**A. Fix "Pull down to refresh" text (no gesture exists):**

- [ ] `discover/page.tsx` line 274 — change to show a "Retry" button instead
- [ ] Same file line 400 — same fix for applied tab error

**B. Reject applicant needs confirmation dialog:**

- [ ] `applicants-tab.tsx` line 119/133 — add confirmation dialog matching accept pattern. Show crew name, "This cannot be undone."
- [ ] Same for shortlist tab reject button

**C. Template deletion needs confirmation dialog:**

- [ ] `daywork/post/page.tsx` line 429 — trash icon with no confirmation
- [ ] `daywork-templates-section.tsx` line 62 — same
- [ ] `permanent-mine-section.tsx` line 205 — same

**D. Silent failure fixes:**

- [ ] `danger-zone-section.tsx` lines 27-40 — data export: add error toast on failure
- [ ] Same file lines 42-51 — account deletion: add error toast on failure
- [ ] `settings/page.tsx` lines 84-92 — notification toggles: await result, show error, revert UI on failure
- [ ] `billing/page.tsx` lines 42-66 — show error toast when checkout redirect fails

**E. Profile section completeness hints (NOT gamification):**

- [ ] In collapsible sections (Summary, Looking For, About, Experience), show inline "2 fields not set" in collapsed header when fields are empty
- [ ] Summary: nationality, location, experience bracket
- [ ] Looking For: desired role, daywork port, permanent availability
- [ ] About: certifications, visas, languages, bio
- [ ] Experience: "No experience added" if zero entries
- [ ] Muted text style. Disappears when section is complete.
- [ ] Remove the "Complete your profile" banner on discover once section hints exist

**F. Onboarding progress indicator:**

- [ ] `onboarding/page.tsx` — add step dots or "Step 2 of 5" text
- [ ] Conditional step count: crew = 5-6 steps, agent = 4 steps
- [ ] Row of dots with current one filled

**G. Unread message indicators:**

- [ ] `messages/page.tsx` — add blue dot or bold text for unread conversations
- [ ] Wire `get_unread_counts` RPC (migration 00058) into the messages list UI

**Done condition:** No misleading "pull down" text. Reject and template delete have confirmations. Silent failures show error toasts. Profile sections show missing field counts. Onboarding shows progress. Unread messages visually distinct.

---

### 8. Capacitor static export architecture (BLOCKING — proper TF build)

The current Codemagic build loads the entire app remotely from Vercel. Correct architecture: static HTML locally, only API calls remote.

**A. Add `generateStaticParams` to all dynamic page routes:**

- [ ] `daywork/[id]/review/page.tsx`, `permanent/[id]/review/page.tsx`, `messages/[engagementId]/page.tsx`, `docky/[conversationId]/page.tsx`, `vessels/[id]/edit/page.tsx`, `profile/edit-experience/[id]/page.tsx`
- [ ] Check for any other dynamic routes

**B. Commit the safeFetch resolveUrl change:**

- [ ] Already implemented but uncommitted. Verify it works.

**C. Rewrite codemagic.yaml:**

- [ ] Remove custom `capacitor.config.ts` step
- [ ] Build: `CAPACITOR_BUILD=1 NEXT_PUBLIC_API_BASE_URL=https://dockwalker.io npm run build`
- [ ] `npx cap sync ios` AFTER build
- [ ] Remove `mkdir -p public`

**D. Verify capacitor.config.ts:**

- [ ] `webDir: 'out'`, no `server.url` in production, `allowNavigation` correct

**E. Verify build:**

- [ ] Static export builds, `out/` created, dynamic routes have fallback HTML, `cap sync` works

**Done condition:** Static `out/`, local pages, remote API calls only.

---

### 9. Permanent post form — add missing fields

Permanent posting should be richer than daywork, not thinner.

**A. Migration:**

- [ ] `contract_type text` — CHECK: `('permanent', 'rotational', 'seasonal', 'crossing', 'delivery', 'temporary')`
- [ ] `contract_details text`, `description text`, `meals text[]`
- [ ] `positions_available int NOT NULL DEFAULT 1` CHECK `(1..20)`, `positions_filled int NOT NULL DEFAULT 0`
- [ ] Same columns (minus positions_filled) to `permanent_templates`
- [ ] Update `apply_projection` PERMANENT.POSTED handler
- [ ] Self-contained rollback

**B. TypeScript types:**

- [ ] `PermanentPosting`, `PermanentTemplate` interfaces, `PERMANENT.POSTED` payload

**C. API routes:**

- [ ] POST, GET discover, GET mine, template CRUD — all accept new fields

**D. Permanent post form:**

- [ ] Wire `ContractDetailsInput`, meals, positions, description, confirmation overlay

**E. Display:**

- [ ] `permanent-job-card.tsx`, `permanent-job-detail.tsx`, chat `PermanentSummaryCard`

**F. Tests:**

- [ ] POST with new fields → 200, invalid contract_type → 400, integration projection

**Done condition:** Permanent form collects all fields. All display on cards and detail view. Templates save/load.

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Permanent crew withdrawal auto-revert — employer should decide

Full spec preserved in git history.

### Billing IAP bypass redesign

4-phase project. Full spec preserved in git history.

### Deactivated user server-side sign-out

### OG social sharing image

### Agent market as discover mode

### Resilience Tests

### Component Tests for Permanent UI

### Component Tests for Form Pickers

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

### Form validation — styled inline errors (SUG-012)

### Invalid URL error pages (SUG-013)

### Edit experience "Unknown vessel" prefix (SUG-017 secondary)

### Applicant count badge on My Jobs posting cards

### Swipe card momentum — exit animation should use swipe velocity

### Notifications grouping — by date or engagement

### Discover filter chips — show active filters as dismissible pills above feed

### Haptics on toggles, filters, apply confirmation (not just swipe)

---

## Done

(See git history for completed stages 51-152, UI-0 through UI-19, all fix batches, pre-TestFlight fixes, workflow protocol, Playwright baseline, rollback + test fixes, SUG fixes, UI consistency 1-3, Codemagic CI, app icon, bundle ID, profile overlay fix, employer spinner fix, LOA conversion fix, pill transition fix)
