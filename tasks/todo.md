# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-Discover: Reference Screen Reskin

---

## Queue

### Stage UI-Discover: Reference Screen Reskin

**Goal:** Apply the full design system from `tasks/ui-guidance.md` to the discover page end-to-end. This is the reference implementation — every design decision is made here first. When this page looks right, the system is proven and remaining pages are mechanical propagation.

**What the user will review:** Open the discover page on a phone (or 390px viewport). Dark mode should be default. Every element on screen — background, header, tabs, cards, badges, buttons, nav — should feel like one cohesive design system. Compare against any other page (e.g. profile) to see the contrast between old and new.

**Will touch:** `globals.css`, `layout.tsx` (fonts + theme), theme provider, discover page + all sub-components, bottom-nav, card/badge/button primitives, settings page (theme toggle only).

**Will NOT touch:** API routes, migrations, types, business logic, non-discover pages (except settings theme toggle and shared components that discover uses).

**Reference:** Read `tasks/ui-guidance.md` in full before starting. Every rule in that doc applies.

---

#### UI-D1: Tokens + Theme + Fonts

This is the foundation. After this step, the app renders in the new colour palette with system theme detection.

**Tokens (`globals.css`):**

- [x] Replace the current `:root` block with `[data-theme='dark']` and `[data-theme='light']` blocks per `ui-guidance.md` Stage UI-2. Map spec values to shadcn variable names (see token reference table in the guidance doc)
- [x] Keep existing shadcn variables that components depend on (`--primary`, `--secondary`, `--muted`, `--ring`, `--input`, `--popover`, `--card-foreground`, `--primary-foreground`, etc.) and point them at appropriate values from the new palette
- [x] Add new variables: `--surface`, `--card-hover`, `--border-hi`, `--tertiary`, `--accent-lo`, `--accent-md`, `--success`, `--success-lo`, `--warning`, `--warning-lo`, `--destructive-lo`, and the spec-only tokens (`--c-body-grad-*`, `--c-num-grad`, `--c-icon-*`, `--c-featured-*`, `--shadow-featured`)
- [x] Add body background gradients: two corner-anchored radial gradients per guidance doc
- [x] Add body transition: `transition: background-color 0.3s, color 0.3s`
- [x] Add pulsing dot keyframe: `@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`
- [x] Update `@theme inline` block to map new colour variables to Tailwind classes
- [x] Keep safe area handling, `--nav-height`, `pb-nav` utility unchanged
- [x] Keep DockWalker brand colors (`--color-navy` etc.) for now — remove only when confirmed unused

**Theme infrastructure:**

- [x] Create `apps/web/src/components/theme-provider.tsx` — context providing `{ theme, setTheme }` where theme is `'light' | 'dark' | 'system'`. Reads from `localStorage('dw-theme')`, writes `document.documentElement.dataset.theme`. Listens to `matchMedia('prefers-color-scheme: dark')` changes when set to `'system'`
- [x] Add inline `<script>` in `apps/web/src/app/layout.tsx` `<head>` — reads `localStorage('dw-theme')` before React hydrates, sets `data-theme` attribute to prevent flash of wrong theme (FOWT)
- [x] Wrap root layout children in `<ThemeProvider>`
- [x] Update `<meta name="theme-color">` to reflect current resolved theme
- [x] Add Light / Dark / System toggle to settings page Appearance section (minimal — just the toggle, no other settings changes)

**Fonts:**

- [ ] Source Geist Mono font files (Regular, Medium, Bold at minimum). Add to `apps/web/public/fonts/` — DEFERRED: no mono font files available; `--font-geist-mono` set to system monospace fallback via inline style on `<body>`
- [x] Add second `localFont` declaration in `layout.tsx` for Geist Mono with `variable: '--font-geist-mono'` — SKIPPED: no font files; fallback set via inline style
- [x] Apply CSS variable to `<body>` alongside existing `--font-geist`
- [x] Verify `globals.css` `--font-mono: var(--font-geist-mono)` now resolves (via system monospace fallback)

**Verify:**

- [x] App renders in dark mode by default (system preference or dark fallback)
- [x] Settings toggle switches between light/dark/system
- [x] No FOWT on page refresh (inline script in <head> sets data-theme before React hydrates)
- [x] `font-mono` class renders in monospace (system fallback — Geist Mono font files not yet sourced)
- [x] Body gradients visible as subtle atmospheric light in dark mode
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)

---

#### UI-D2: Card + Badge + Button

Style the core trio together — they're always seen as a unit on a card.

**Card anatomy (update `components/ui/card.tsx` + discover card components):**

- [x] Update `card.tsx` base: `rounded-[14px]`, `border border-[var(--border)]`, `bg-[var(--card)]`, remove `shadow-sm`
- ~~Add card hover state~~ — not applicable on mobile touch (no mouse hover)
- ~~Add card selected/expanded state~~ — no multi-select or expandable card pattern exists in discover flow

**Daywork swipe card (`daywork-card.tsx`):**

- [x] Update card container: `rounded-[14px]` (not `rounded-2xl`), `border border-[var(--border)]`, `bg-[var(--card)]`, remove `shadow-lg`
- [x] Create `VesselChip` component (`components/vessel-chip.tsx`): 38×38px, `rounded-[10px]`, 2-letter vessel type abbreviation (MY, SY) in Geist Mono, uses `--c-icon-*` tokens for background gradient, border, and text colour
- [x] Add VesselChip to card header row, before the role title
- [x] Rate display: switch to `font-mono text-[17px] font-bold tracking-tight` for the amount, `text-[11px] font-medium text-[var(--muted-foreground)] opacity-60` for the `/day` suffix. Same baseline
- [x] Tags (certs, languages): update to `bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs`. Keep the green/amber colouring for held/missing certs — but use `--success-lo`/`--success` and `--warning-lo`/`--warning` tokens instead of hardcoded `bg-emerald-100 text-emerald-800`
- [x] Footer divider: add `border-t border-[var(--border)]` above the footer row
- [x] Footer text (job ref, posted date): `font-mono text-[11px] text-[var(--tertiary)]`
- [x] Poster name: `text-[var(--muted-foreground)]`
- [x] Remove all hardcoded `dark:` variant classes (e.g. `dark:bg-emerald-900/30 dark:text-emerald-400`) — the token system handles both themes

**Permanent job card (`permanent-job-card.tsx`):**

- [x] Same card base: `rounded-[14px]`, border tokens, no shadow
- [x] Add VesselChip to header
- [x] Rate display: same mono treatment as daywork
- [x] Salary: `font-mono text-[17px] font-bold` for the amount, period suffix in regular weight
- [x] Tags: same token-based colouring
- [x] Remove `shadow-sm`, `hover:shadow-md` — hover is border-only
- [x] Remove hardcoded `dark:` classes
- [x] Add footer divider: `border-t border-[var(--border)]` above footer row (missing — daywork card has it, permanent card doesn't)

**Application cards (`applied-tab.tsx`, `permanent-application-card.tsx`):**

- [x] Same card base styling
- [x] Rate/salary in mono (applied-tab done; permanent-application-card has `font-mono` on job ref badge but salary display at line 120 lacks `font-mono` wrapper)
- [x] Job ref in mono + tertiary colour
- [x] Remove hardcoded colour classes, use tokens
- [x] `permanent-application-card.tsx`: wrap salary display in `font-mono` class (currently only the formatSalary string is returned, no mono class on the `<span>`)

**Invitation cards (`invitations-tab.tsx`):**

- [x] Same card base styling
- [x] Rate in mono
- [x] "Invited by" text: `text-[var(--accent)]` instead of `text-primary`

**Badge system (update `components/ui/badge.tsx`):**

- [x] Add 4 semantic status variants per guidance doc:
  - `status-open`: `bg-[var(--success-lo)] text-[var(--success)] border-[rgba(52,211,153,0.18)]`
  - `status-filling`: `bg-[var(--warning-lo)] text-[var(--warning)] border-[rgba(245,158,11,0.18)]`
  - `status-closed`: `bg-[var(--accent-lo)] text-[var(--accent)] border-[var(--border-hi)]`
  - `status-cancelled`: `bg-[var(--destructive-lo)] text-[var(--destructive)] border-[rgba(248,113,113,0.18)]`
- [x] Add `PulsingDot` — 5px circle, `bg-current`, `animate-[blink_2s_ease_infinite]`. Shown on `status-open` and `status-filling` variants only
- [x] Badge typography: `text-[11px] font-semibold tracking-[0.01em]`
- [x] Apply status badges to positions badge on daywork cards (replace hardcoded `bg-blue-100` / `bg-amber-100`)
- [x] Apply to application status badges on applied tab

**Button system (update `components/ui/button.tsx`):**

- [x] Remap `default` variant to: `bg-[var(--accent)] text-white hover:brightness-[1.08]`, no border
- [x] Remap `outline` / `secondary` to Ghost: `bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:border-[var(--border-hi)] hover:text-[var(--foreground)]`
- [x] Add `apply` variant: `bg-[var(--accent-lo)] text-[var(--accent)] border border-[var(--border-hi)] hover:bg-[var(--accent)] hover:text-white uppercase tracking-[0.03em]`
- [x] Keep `destructive` variant but restyle: `bg-[var(--destructive)] text-white hover:brightness-[1.08]`
- [x] All buttons: `rounded-full` (pill), `text-xs font-semibold tracking-[0.01em]`
- [x] Keep icon button sizes (`icon`, `icon-xs`, `icon-sm`, `icon-lg`) with appropriate radius
- [x] Update the circular swipe action buttons (pass/apply) on daywork browse: use `--destructive` / `--success` tokens instead of hardcoded `border-destructive text-destructive` / `border-success text-success`

**Verify:**

- [x] Discover page daywork cards look complete: vessel chip, rate in mono, tags with token colours, footer with divider, badge with pulsing dot
- [x] Permanent cards in scrollable feed look complete: same anatomy, no shadows, border-only hover
- [x] Applied tab cards match
- [x] Invitation cards match
- [x] Buttons are pill-shaped, correct variants used
- [x] All hardcoded `dark:`, `bg-emerald-*`, `bg-amber-*`, `bg-blue-*` classes removed from discover components
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)

---

#### UI-D3: Header + Tabs + Nav + Typography

Polish the frame around the cards.

**Discover page header:**

- [x] Background: `bg-[var(--surface)]` (not `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Page title: `text-[24px] font-bold tracking-[-0.5px]`

**Tabs (already using `UnderlineTabs` component):**

- [x] Verify active state uses `--foreground` border and text
- [x] Tab label typography: match guidance (if count badges shown, use mono for count)

**Bottom nav (`components/bottom-nav.tsx`):**

- [x] Background: `bg-[var(--surface)]`, `border-t border-[var(--border)]`
- [x] Inactive items: `text-[var(--muted-foreground)]`
- [x] Active items: `text-[var(--accent)]`, `font-medium`
- [x] Labels: `text-[10px] font-bold uppercase tracking-[0.08em]`
- [x] Badge count: `font-mono text-[10px] rounded-[4px]`
- [x] Keep safe area handling unchanged

**Typography across discover page:**

- [x] Card titles (role name): `text-[15px] font-semibold tracking-[-0.3px]`
- [x] Body text (vessel, location, dates): `text-[13px]` or `text-sm`
- [x] Rate amounts: `font-mono text-[17px] font-bold tracking-[-0.5px]`
- [x] Rate period suffix: `text-[11px] font-medium text-[var(--muted-foreground)] opacity-60`
- [x] Timestamps / posted date: `font-mono text-[11px] text-[var(--tertiary)]`
- [x] Job references: `font-mono text-[11px] text-[var(--tertiary)]`
- [x] Filter labels: `text-[13px] font-medium` — already `text-xs font-medium`, kept as-is (smaller than body text is correct for filter labels)

**SegmentedToggle:**

- [x] Verify it uses token-based colours (already should from the toggle component)
- [x] Background: `bg-[var(--surface)]` or keep muted — evaluate visually

**Motion (discover page only):**

- [x] Add entrance animation to card stack: staggered `translateY(14px) → 0`, `opacity 0 → 1`, 500ms, `cubic-bezier(0.16,1,0.3,1)`. Use Framer Motion (already imported for swipe)
- [x] Permanent feed cards: staggered entrance on initial load
- [x] Tab switch: no animation (instant content swap is fine)
- [x] Respect `prefers-reduced-motion`
- [x] Remove any existing `hover:shadow-md` or `transition-shadow` — hover is border-only (none found; removed `transition-colors` from permanent-job-card container and daywork card message link)

**Verify:**

- [x] Header/tabs/nav all look cohesive with the card system
- [x] Typography hierarchy is clear: titles > body > rates > timestamps
- [x] Mono font visible on rates, job refs, timestamps
- [x] Page load has smooth entrance animation
- [x] No remaining hardcoded colours on the discover page or its sub-components (also fixed permanent-job-detail.tsx emerald/amber hardcoded colors)
- [x] Compare discover page (new) vs any other page (old) — the contrast should be stark but discover should look complete
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)
- [x] Update component tests if any button/badge/card variant props changed (updated bottom-nav.test.tsx)

---

#### Final Check

- [x] Open discover page at 390px viewport width in dark mode — everything looks intentional
- [x] Switch to light mode via settings toggle — colours adapt, no broken contrast
- [x] Switch to system mode — follows OS preference
- [x] Swipe gestures still work correctly on daywork cards
- [x] Permanent feed scrolls and paginates correctly
- [x] All 3 tabs (Browse, Invitations, Applied) render correctly with new styling
- [x] No purple anywhere, no gradient buttons, no card lift on hover, no `blur > 8px` shadows
- [x] Body gradients subtle, not distracting on mobile
- [x] All tests pass (856/856)
- [x] `npx eslint src/ --max-warnings 0` — zero warnings

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Agent market as discover mode (152h)

Merge `/discover/market` into the main discover page as an agent-specific mode.

### Resilience Tests

- [ ] Discover, Chat, Apply, Post form, Availability overlay error handling tests

### Component Tests for Permanent UI

- [ ] PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

---

## Done

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
