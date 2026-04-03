# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Responsive Redesign — Phase 0 (Foundation)

---

## Queue

### Responsive Redesign — Phase 0 (Foundation)

**Context:** The web app is locked to 512px (`max-w-lg`) on every viewport with zero responsive breakpoints. Phase 0 builds the responsive shell: sidebar nav, CSS width utilities, viewport-positioned component fixes, z-index normalisation, and the mechanical max-w-lg migration. See `tasks/responsive-redesign-spec.md` §5 and §6 Phase 0 for full details.

**Spec authority:** `tasks/responsive-redesign-spec.md` — read it before starting. This checklist is the execution plan; the spec is the reference for WHY and HOW.

**Done condition:** Mobile (375px) looks identical to today. Desktop (1440px) shows sidebar, wider content, and all overlays/modals render inside the content area (not behind the sidebar).

---

#### 0a. CSS Variables + Width Utilities

- [ ] `apps/web/src/app/globals.css` — add to `:root` block (after `--nav-height: 4rem;`): `--sidebar-width: 16rem;` and `--content-inset-left: 0px;`
- [ ] `apps/web/src/app/globals.css` — add media query after `:root` block: `@media (min-width: 768px) { :root { --content-inset-left: var(--sidebar-width); } }`
- [ ] `apps/web/src/app/globals.css` — update `.pb-nav` utility inside `@layer utilities`: add `@media (min-width: 768px) { .pb-nav { padding-bottom: 0; } }` so desktop pages don't have phantom bottom-nav padding
- [ ] `apps/web/src/app/globals.css` — add `.page-width` class to `@layer utilities`: `margin-left: auto; margin-right: auto; max-width: 32rem;` with `@media (min-width: 768px) { max-width: 48rem; }` and `@media (min-width: 1024px) { max-width: 56rem; }`
- [ ] `apps/web/src/app/globals.css` — add `.page-width-narrow` class: `margin-left: auto; margin-right: auto; max-width: 32rem;` (no responsive widening)
- [ ] `apps/web/src/app/globals.css` — add `.page-width-wide` class: same as `page-width` but `@media (min-width: 768px) { max-width: 64rem; }` and `@media (min-width: 1024px) { max-width: 72rem; }`

#### 0b. Viewport Meta Tag

- [ ] `apps/web/src/app/layout.tsx` — change `maximumScale: 1` to `maximumScale: 5` and `userScalable: false` to `userScalable: true` (lines 53-56). This allows desktop zoom without affecting mobile behaviour.

#### 0c. Create SidebarNav Component

- [ ] Create `apps/web/src/components/sidebar-nav.tsx` — new file. Structure: `<aside className="fixed left-0 top-0 bottom-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] md:flex">`. Contents: logo/app name at top, role-conditional nav items matching bottom-nav (crew: Discover, Messages with badge, Docky, Profile; employer/agent: Post Job, My Jobs, Messages with badge, Profile), bottom section with HatSwitcher, NotificationBell, sign-out button. Props: `currentHat: string`, `identityType: string`. Imports: same icons as bottom-nav + `HatSwitcher` from `@/components/hat-switcher`, `NotificationBell` from `@/components/notification-bell`, `useNotificationCounts` for badge. Must be `'use client'`.

#### 0d. Update BottomNav — Hide on Desktop

- [ ] `apps/web/src/components/bottom-nav.tsx` line 40 — change `<nav className="fixed bottom-0 left-0 right-0 z-50` to `<nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden` (add `md:hidden`, change z-50 to z-40)

#### 0e. Update App Layout

- [ ] `apps/web/src/app/(app)/layout.tsx` — import SidebarNav: `import { SidebarNav } from '@/components/sidebar-nav';`
- [ ] `apps/web/src/app/(app)/layout.tsx` — add `<SidebarNav currentHat={person.current_hat} identityType={person.identity_type} />` before the content div (after `<OfflineBanner />`)
- [ ] `apps/web/src/app/(app)/layout.tsx` — change `<div className="pb-nav">` to `<div className="pb-nav md:ml-[var(--sidebar-width)] md:pb-0">` to offset content on desktop

#### 0f. Fix Dialog (Radix Portal)

- [ ] `apps/web/src/components/ui/dialog.tsx` `DialogOverlay` (line 33-35) — add `style={{ left: 'var(--content-inset-left)' }}` prop to shift overlay right of sidebar on desktop. Keep existing className.
- [ ] `apps/web/src/components/ui/dialog.tsx` `DialogContent` (line 53-56) — replace the `fixed top-[50%] left-[50%]` centering. Remove `left-[50%]` and `translate-x-[-50%]` from className. Add `style={{ top: '50%', left: 'calc(var(--content-inset-left) + (100vw - var(--content-inset-left)) / 2)', transform: 'translateX(-50%) translateY(-50%)' }}` to centre within content area, not viewport.

#### 0g. Fix Toast Container

- [ ] `apps/web/src/components/toast-container.tsx` line 11 — replace `className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2"` with `className="fixed z-70 flex flex-col gap-2"` and add `style={{ bottom: 'calc(var(--nav-height, 4rem) + env(safe-area-inset-bottom, 0px) + 0.5rem)', left: 'calc(var(--content-inset-left) + (100vw - var(--content-inset-left)) / 2)', transform: 'translateX(-50%)' }}`. This fixes the existing bug (hardcoded `bottom-20` ignored nav height) AND adds sidebar-aware centering.

#### 0h. Fix Push Toast

- [ ] `apps/web/src/components/push-toast.tsx` line 58 — change `z-[9999]` to `z-80`. Add `style={{ marginLeft: 'var(--content-inset-left, 0px)' }}` to the outer div so it doesn't render behind the sidebar on desktop.

#### 0i. Fix Bottom Sheet

- [ ] `apps/web/src/components/ui/bottom-sheet.tsx` — find the backdrop div with `fixed inset-0` and add `md:left-[var(--content-inset-left)]`. Find the sheet container div and add `md:left-[var(--content-inset-left)]` (or `md:ml-[var(--content-inset-left)]` if it uses `inset-0`).

#### 0j. Fix Profile Overlay

- [ ] `apps/web/src/components/profile-overlay.tsx` — find the backdrop div with `fixed inset-0` and add `md:left-[var(--content-inset-left)]`. Find the sheet div and add `md:ml-[var(--content-inset-left)]` or equivalent.

#### 0k. Fix Availability Overlay

- [ ] `apps/web/src/components/availability-overlay.tsx` — same pattern: backdrop `md:left-[var(--content-inset-left)]`, sheet offset.

#### 0l. Fix Image Cropper

- [ ] `apps/web/src/components/image-cropper.tsx` — find `fixed inset-0` div, add `md:left-[var(--content-inset-left)]`.

#### 0m. Fix Permanent Job Detail Modal

- [ ] `apps/web/src/app/(app)/discover/_components/permanent-job-detail.tsx` — find `fixed inset-0 z-50`, change z-50 to z-60, add `md:left-[var(--content-inset-left)]`.

#### 0n. Z-Index Normalisation

Apply these z-index changes alongside the component edits above (some already covered):

- [ ] `components/bottom-nav.tsx` — z-50 → z-40 (done in 0d)
- [ ] `components/ui/dialog.tsx` overlay — z-50 stays (modal backdrop)
- [ ] `components/ui/dialog.tsx` content — z-50 → z-60 (modal content above backdrop)
- [ ] `components/toast-container.tsx` — z-[60] → z-70 (done in 0g)
- [ ] `components/push-toast.tsx` — z-[9999] → z-80 (done in 0h)
- [ ] `discover/_components/permanent-job-detail.tsx` — z-50 → z-60 (done in 0m)
- [ ] `discover/page.tsx` header — z-30 → z-20
- [ ] `docky/page.tsx` header — z-40 → z-10
- [ ] `docky/[conversationId]/page.tsx` header — z-40 → z-10
- [ ] `billing/page.tsx` header — z-40 → z-10
- [ ] `permanent/[id]/review/page.tsx` header — z-20 → z-10

#### 0o. Hide Duplicate Nav Elements on Desktop

- [ ] `apps/web/src/app/(app)/discover/page.tsx` — find `<NotificationBell` in the header, wrap in `<span className="md:hidden">...</span>`
- [ ] `apps/web/src/app/(app)/messages/page.tsx` — find `<NotificationBell` in the header, wrap in `<span className="md:hidden">...</span>`
- [ ] `apps/web/src/app/(app)/profile/page.tsx` — find `<HatSwitcher` and `<NotificationBell` in the header, wrap each in `<span className="md:hidden">...</span>`

#### 0p. Swipe Animation Proportions

- [ ] `apps/web/src/app/(app)/discover/_components/daywork-card.tsx` — add `useRef` for container width. Replace `SWIPE_THRESHOLD = 100` with a function: `const getThreshold = () => (containerRef.current?.offsetWidth ?? 300) * 0.33`. Replace `animate(x, 400, ...)` exit calls with proportional: `animate(x, (containerRef.current?.offsetWidth ?? 300) * 1.3, ...)` (and negative for left). Replace `useTransform(x, [-200, 200], [-15, 15])` ranges with proportional values based on container width. Add `ref={containerRef}` to the card wrapper div.

#### 0q. Billing Page Inconsistency

- [ ] `apps/web/src/app/(app)/billing/page.tsx` — change `min-h-screen` to `min-h-svh`

#### 0r. Message Bubble Width Cap

- [ ] `apps/web/src/app/(app)/messages/[engagementId]/_components/message-list.tsx` — find `max-w-[80%]` on message bubbles, change to `max-w-[80%] md:max-w-md`

#### 0s. Chat Page Height

- [ ] `apps/web/src/app/(app)/messages/[engagementId]/page.tsx` — find `h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))]`, change to `h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] md:h-svh`

#### 0t. max-w-lg Migration (Mechanical)

Replace `mx-auto max-w-lg` (or equivalent) with the correct CSS utility class per this table. **Do NOT touch files marked KEEP.** Read `tasks/responsive-redesign-spec.md` §6 Phase 0k for the full file-by-file classification.

**`page-width` (standard pages):**

- [ ] `discover/page.tsx` — header inner + content (2 occurrences)
- [ ] `discover/market/page.tsx` — header + content (2-3 occurrences)
- [ ] `messages/page.tsx` — header + tab line + content (3 occurrences) — NOTE: messages content should be `page-width-wide` not `page-width`
- [ ] `notifications/page.tsx` — header + content
- [ ] `profile/page.tsx` — header + content
- [ ] `settings/page.tsx` — header + content
- [ ] `billing/page.tsx` — header + content
- [ ] `vessels/page.tsx` — header + content
- [ ] `vessels/[id]/edit/page.tsx` — header + content
- [ ] `profile/add-experience/page.tsx` — header + content
- [ ] `profile/edit-experience/[id]/page.tsx` — header + content
- [ ] `daywork/post/page.tsx` — header + content
- [ ] `daywork/mine/page.tsx` — header + content sections (3-4 occurrences)
- [ ] `daywork/[id]/review/page.tsx` — header + content (2-3 occurrences)
- [ ] `permanent/[id]/review/page.tsx` — header + content (3-4 occurrences)
- [ ] `docky/page.tsx` — outer wrapper
- [ ] `docky/[conversationId]/page.tsx` — header
- [ ] `discover/_components/daywork-browse.tsx` — outer wrapper
- [ ] `discover/_components/permanent-job-feed.tsx` — outer wrapper
- [ ] `discover/_components/permanent-job-detail.tsx` — inner content
- [ ] `discover/_components/applied-tab.tsx` — outer wrapper
- [ ] `discover/_components/invitations-tab.tsx` — outer wrapper
- [ ] `daywork/mine/_components/permanent-mine-section.tsx` — outer wrapper
- [ ] `daywork/post/_components/permanent-post-form.tsx` — outer wrapper

**`page-width-wide` (content that benefits from extra width):**

- [ ] `messages/page.tsx` content wrapper — use `page-width-wide` (header stays `page-width`)
- [ ] `messages/[engagementId]/_components/chat-header.tsx` — inner
- [ ] `messages/[engagementId]/_components/chat-footer.tsx` — inner
- [ ] `messages/[engagementId]/_components/message-list.tsx` — inner

**`page-width-wide` (landing page sections):**

- [ ] `apps/web/src/app/page.tsx` (landing) — value props + how-it-works sections (2 occurrences)

**KEEP — do NOT change these:**

- `components/bottom-nav.tsx` inner div — stays `max-w-lg`
- `components/ui/bottom-sheet.tsx` sheet — stays `max-w-lg`
- `components/profile-overlay.tsx` sheet — stays `max-w-lg`
- `components/availability-overlay.tsx` sheet — stays `max-w-lg`

#### 0u. Verification — Automated

- [ ] Run `turbo run type-check` — zero errors
- [ ] Run `turbo run lint` — zero warnings
- [ ] Run `cd apps/web && npx vitest run` — all tests pass

#### 0v. Screenshot Script for Visual Verification

- [ ] Create `scripts/screenshot-responsive.ts` — a one-shot Playwright script (NOT a test suite) that: (1) launches headless Chromium, (2) navigates to each public route (landing, login, signup, forgot-password, reset-password) and screenshots at 375px, 768px, 1440px widths, (3) logs into a test account (use seed crew c@1.com / password from seed), (4) navigates to each authenticated route (discover, messages, profile, settings, notifications, billing, vessels, docky, daywork/post, daywork/mine) and screenshots at all 3 widths. Save all PNGs to `tmp/screenshots/{width}/{route-name}.png`. The `tmp/` directory should already be in `.gitignore` — verify this, add if not.
- [ ] Add a `package.json` script: `"screenshots": "npx tsx scripts/screenshot-responsive.ts"` in the root package.json
- [ ] Run the script and verify it produces screenshots without errors
- [ ] **User review:** screenshots saved to `tmp/screenshots/` — user reviews these instead of manually resizing Chrome

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

---

## Done

(See git history for completed stages 51-177. Mobile Phases 1-6 complete + UI primitives. EAS config stage 173. Vercel build fix. Stage 174: hat switcher copy, full-bleed cards, header toggle, JWT claims, batch vessel lookup, favicon. Stage 175: LookupsProvider, middleware header dedup, parallel fetches. Stage 176: NotificationCountsProvider. Stage 177: Smoker + visible tattoos profile fields.)
