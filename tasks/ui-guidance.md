# DockWalker UI Design System — Implementation Guide

> **Authority:** This document defines the visual design system. For product rules see `CLAUDE.md`. For build progress see `BUILD_STATE.md`.
>
> **How to use:** Each section is an independently-implementable stage. Apply one stage, review visually, iterate or continue. Do not combine stages without explicit instruction.
>
> **Decisions locked in:**
>
> - Layout: bottom-nav stays. No sidebar, no topbar.
> - Theme: system-detected default. User can toggle light / dark / system in settings.
> - Token strategy: remap spec values to shadcn variable names (e.g. `--background`, `--card`). Keep shadcn naming, replace values.
> - Font loading: `next/font/local` (already used for Geist). Not `next/font/google`.
> - Image assets: `assets/` directory has branding, onboarding heroes, crew/vessel/role photography. Wire into relevant pages.
> - Tests: update any component tests broken by structural changes.
>
> **Pre-reskin rule:** Before any visual reskin stage begins, all pages being reskinned must be decomposed into focused sub-components (≤ 300 lines, ≤ 10 useState per component). Reskinning monolith pages (500+ lines, 20+ useState) is high-risk — structural changes get tangled with visual changes, making both harder to review and debug. Decompose first (Stage UI-0), then reskin.

---

## Stage UI-1: Fonts

**Goal:** Load Geist Mono alongside Geist. Wire `font-mono` so it actually works.

**Prerequisite:** Source Geist Mono font files (Regular + Medium + Bold at minimum). Current `assets/fonts/` has Geist only — Mono files must be added before this stage.

**What to do:**

1. Add Geist Mono `.ttf` files to `apps/web/public/fonts/`
2. In `apps/web/src/app/layout.tsx`, add a second `localFont` declaration for Geist Mono with `variable: '--font-geist-mono'`
3. Apply the CSS variable to `<body>` alongside the existing `--font-geist`
4. Verify `globals.css` line `--font-mono: var(--font-geist-mono)` now resolves

**What NOT to do:** Do not change any typography sizes, weights, or where `font-mono` is used. Just make the font load.

**Done when:** `font-mono` class renders in Geist Mono in the browser. Verify on the permanent summary card (already uses `font-mono`).

---

## Stage UI-2: Design Tokens

**Goal:** Replace the current OKLCH colour system with the spec's hex/rgba values, scoped by `[data-theme]`.

**What to do:**

Rewrite `globals.css` to replace the current `:root` block with `[data-theme='dark']` and `[data-theme='light']` blocks. Map spec tokens to shadcn names:

```
Spec token        → Shadcn variable
--c-bg            → --background
--c-surface       → --surface  (new — used for bottom-nav bg)
--c-card          → --card
--c-card-hover    → --card-hover  (new)
--c-border        → --border
--c-border-hi     → --border-hi  (new — hover/focus borders)
--c-text-1        → --foreground
--c-text-2        → --muted-foreground
--c-text-3        → --tertiary  (new — timestamps, separators)
--c-accent        → --accent
--c-accent-lo     → --accent-lo  (new)
--c-accent-md     → --accent-md  (new)
--c-green         → --success
--c-green-lo      → --success-lo  (new)
--c-amber         → --warning
--c-amber-lo      → --warning-lo  (new)
--c-red           → --destructive
--c-red-lo        → --destructive-lo  (new)
```

Keep existing shadcn variables that components depend on (`--primary`, `--secondary`, `--muted`, `--ring`, `--input`, `--popover`, `--card-foreground`, `--primary-foreground`, etc.) and point them at appropriate values from the spec palette.

Also add these spec-only tokens (not remapped, used directly):

```
--c-body-grad-a / --c-body-grad-b     (body background gradients)
--c-num-grad                          (hero number gradient text)
--c-icon-bg / --c-icon-border / --c-icon-color  (vessel chip)
--c-featured-bg / --c-featured-border / --c-featured-bar  (featured cards)
--shadow-featured                     (featured card shadow)
```

Provide both `[data-theme='dark']` and `[data-theme='light']` blocks with full values from the original spec (reproduced below for reference).

Keep the DockWalker brand colors (`--color-navy`, `--color-sea`, etc.) for backwards compatibility — remove only when no component references them.

Keep `--radius`, `--nav-height`, safe area handling, and Tailwind `@theme inline` block. Update `@theme inline` colour mappings to reference the new variable names.

**What NOT to do:** Do not add ThemeProvider, theme toggle, or `data-theme` attribute yet. Just define the token blocks. The app will look broken until Stage UI-3 applies the attribute — that's expected.

**Done when:** `globals.css` has both theme blocks defined. No runtime change yet (no `data-theme` attribute on HTML).

### Token Reference Values

#### Dark

```css
[data-theme='dark'] {
  --background: #111a24;
  --surface: #162030;
  --card: #1b2738;
  --card-hover: #1f2e40;
  --foreground: #dce8f4;
  --muted-foreground: #7a9ab8;
  --tertiary: #4a6680;
  --border: rgba(255, 255, 255, 0.07);
  --border-hi: rgba(74, 158, 255, 0.26);
  --accent: #4a9eff;
  --accent-lo: rgba(74, 158, 255, 0.1);
  --accent-md: rgba(74, 158, 255, 0.2);
  --success: #34d399;
  --success-lo: rgba(52, 211, 153, 0.1);
  --warning: #f59e0b;
  --warning-lo: rgba(245, 158, 11, 0.1);
  --destructive: #f87171;
  --destructive-lo: rgba(248, 113, 113, 0.1);
  --c-body-grad-a: rgba(74, 158, 255, 0.05);
  --c-body-grad-b: rgba(20, 50, 90, 0.35);
  --c-num-grad: linear-gradient(160deg, #dce8f4 50%, #4a6680 100%);
  --c-icon-bg: linear-gradient(145deg, rgba(74, 158, 255, 0.09), rgba(27, 39, 56, 0.95));
  --c-icon-border: rgba(74, 158, 255, 0.14);
  --c-icon-color: #4a9eff;
  --c-featured-bg: #1b2738;
  --c-featured-border: rgba(74, 158, 255, 0.35);
  --c-featured-bar: rgba(74, 158, 255, 0.6);
  --shadow-featured: 0 0 0 1px rgba(74, 158, 255, 0.22);
}
```

#### Light

```css
[data-theme='light'] {
  --background: #eef2f8;
  --surface: #ffffff;
  --card: #ffffff;
  --card-hover: #f7fafd;
  --foreground: #0d1b2a;
  --muted-foreground: #3d5a7a;
  --tertiary: #7a9ab8;
  --border: rgba(13, 27, 42, 0.07);
  --border-hi: rgba(45, 125, 224, 0.3);
  --accent: #2d7de0;
  --accent-lo: rgba(45, 125, 224, 0.08);
  --accent-md: rgba(45, 125, 224, 0.15);
  --success: #059669;
  --success-lo: rgba(5, 150, 105, 0.08);
  --warning: #d97706;
  --warning-lo: rgba(217, 119, 6, 0.09);
  --destructive: #dc2626;
  --destructive-lo: rgba(220, 38, 38, 0.08);
  --c-body-grad-a: rgba(74, 158, 255, 0.04);
  --c-body-grad-b: rgba(74, 158, 255, 0.02);
  --c-num-grad: linear-gradient(160deg, #0d1b2a 50%, #7a9ab8 100%);
  --c-icon-bg: linear-gradient(145deg, rgba(45, 125, 224, 0.09), rgba(210, 225, 242, 0.6));
  --c-icon-border: rgba(45, 125, 224, 0.14);
  --c-icon-color: #2d7de0;
  --c-featured-bg: #f4f8ff;
  --c-featured-border: rgba(45, 125, 224, 0.28);
  --c-featured-bar: rgba(45, 125, 224, 0.55);
  --shadow-featured: 0 1px 3px rgba(13, 27, 42, 0.06), 0 2px 8px rgba(45, 125, 224, 0.08);
}
```

---

## Stage UI-3: Theme Infrastructure

**Goal:** Make the token blocks from Stage UI-2 actually apply. System-detected default with user toggle.

**What to do:**

1. **Inline script in `<head>`** — before React hydrates, read `localStorage.getItem('dw-theme')`. If `'light'` or `'dark'`, set `document.documentElement.dataset.theme`. If `'system'` or absent, use `matchMedia('(prefers-color-scheme: dark)')` to decide. This prevents flash of wrong theme (FOWT).
2. **ThemeProvider context** — `apps/web/src/components/theme-provider.tsx`. Provides `{ theme, setTheme }` where theme is `'light' | 'dark' | 'system'`. Writes to `localStorage('dw-theme')` and updates `document.documentElement.dataset.theme`. Listens to `matchMedia` changes when set to `'system'`.
3. **Wrap in root layout** — add `ThemeProvider` to `apps/web/src/app/layout.tsx`.
4. **Settings toggle** — add Light / Dark / System selector to the Appearance section in `apps/web/src/app/(app)/settings/page.tsx`. Use the existing settings card pattern.
5. **Body transition** — add `transition: background-color 0.3s, color 0.3s` to `body` in `globals.css` for smooth theme switching.
6. **Viewport theme-color** — update the `<meta name="theme-color">` to reflect current theme (dark: `#111a24`, light: `#eef2f8`).

**What NOT to do:** Do not change any component styles. The app should now render in the new colour palette (whichever theme the system selects) using existing Tailwind classes that reference shadcn variables. Some things may look wrong — that's expected, fixed in later stages.

**Done when:** App renders in dark or light based on system preference. Settings toggle switches between them. No FOWT on refresh.

---

## Stage UI-4: Typography Scale

**Goal:** Enforce the type hierarchy across all pages.

**Typography rules (hard — do not override):**

| Role                             | Font       | Size    | Weight  | Extra                                                             |
| -------------------------------- | ---------- | ------- | ------- | ----------------------------------------------------------------- |
| Hero numbers (feed count, stats) | Geist      | 48–56px | 800     | Gradient text via `--c-num-grad`                                  |
| Page title                       | Geist      | 24–28px | 700     | `letter-spacing: -0.5px`                                          |
| Card title                       | Geist      | 15px    | 650     | `letter-spacing: -0.3px`                                          |
| Body / labels                    | Geist      | 13–15px | 400–500 | —                                                                 |
| Rates & money                    | Geist Mono | 17px    | 700     | `letter-spacing: -0.5px`                                          |
| Rate period (`/day`, `/month`)   | Geist      | 11px    | 500     | `color: var(--muted-foreground); opacity: 0.6` — NOT `--tertiary` |
| Timestamps, counts               | Geist Mono | 11px    | 400     | `color: var(--tertiary)`                                          |
| Nav labels                       | Geist      | 10px    | 700     | Uppercase, `letter-spacing: 0.08em`                               |
| Badges                           | Geist      | 11px    | 600     | `letter-spacing: 0.01em`                                          |
| Buttons                          | Geist      | 12px    | 600     | `letter-spacing: 0.01em`                                          |

**NEVER use:** Inter, Roboto, Arial, system-ui, or any fallback as the primary font.

**What to do:**

1. Define Tailwind utility classes or CSS classes for each role (e.g. `.text-rate`, `.text-timestamp`, `.text-page-title`) in `globals.css` — or use inline Tailwind where simpler
2. Audit every page and apply correct typography role to each text element
3. Wire `font-mono` onto all rate displays, timestamps, counts, job references
4. Add gradient text utility class for hero numbers

**What NOT to do:** Do not change layout, spacing, or component structure. Only change font family, size, weight, letter-spacing, and colour on text elements.

**Done when:** Every text element in the app uses the correct role from the table above. `font-mono` is visually distinct on rates and timestamps.

---

## Stage UI-5: Border Radius System

**Goal:** Consistent radius hierarchy.

| Element                                    | Radius         |
| ------------------------------------------ | -------------- |
| Cards, modals, panels, overlays            | `14px`         |
| Inputs, icon buttons, nav items, tags      | `8px`          |
| Action buttons (primary, secondary, apply) | `999px` (pill) |
| Filter pills, badges                       | `999px` (pill) |
| Vessel icon chip                           | `10px`         |
| Urgency ribbon label                       | `4px`          |

**What to do:**

1. Update `--radius` in `globals.css` and the derived `--radius-*` values to produce these sizes
2. Update `button.tsx` — action buttons get `rounded-full`, keep `rounded-lg` for icon buttons
3. Update `card.tsx` — change to `rounded-[14px]`
4. Update `badge.tsx` — already `rounded-full`, verify
5. Update `input.tsx`, `textarea.tsx`, `select.tsx` — `rounded-lg` (8px)
6. Update `dialog.tsx` — `rounded-[14px]`
7. Audit overlays (availability, profile, cancel, postponement, rating, checklist, crew-cancel) for consistency

**Done when:** Visual audit shows consistent radius hierarchy. No mixed values.

---

## Stage UI-6: Button System

**Goal:** Three button variants matching the spec.

| Variant          | Background         | Text                      | Border                       | Hover                                                      |
| ---------------- | ------------------ | ------------------------- | ---------------------------- | ---------------------------------------------------------- |
| Primary          | `var(--accent)`    | `#fff`                    | none                         | `filter: brightness(1.08)`                                 |
| Ghost            | `var(--card)`      | `var(--muted-foreground)` | `1px solid var(--border)`    | `border-color: var(--border-hi); color: var(--foreground)` |
| Apply (card CTA) | `var(--accent-lo)` | `var(--accent)`           | `1px solid var(--border-hi)` | flip to `background: var(--accent); color: #fff`           |

**All buttons:** `border-radius: 999px`, `font-size: 12px`, `font-weight: 600`, `letter-spacing: 0.01em`.

**Apply button:** uppercase text, `letter-spacing: 0.03em`.

**Hard bans:** No gradient fills. No `transform` on hover. No colour-shift hover (use brightness or border change only).

**What to do:**

1. Rewrite `button.tsx` variants to match the three-variant system
2. Map existing variant usage: `default` → Primary, `outline`/`secondary` → Ghost, new `apply` variant
3. Existing `destructive` variant: keep but style as `var(--destructive)` background, `#fff` text, same pill radius
4. Update all button usages across pages if variant names changed
5. Update component tests if button variant props changed

**Done when:** All buttons in the app match the spec. No leftover shadcn default styling.

---

## Stage UI-7: Card System

**Goal:** Standardised card anatomy.

**Card structure:**

```
┌─────────────────────────────────────────┐  ← border: 1px solid var(--border), radius: 14px
│ [vessel-chip] [title + vessel] [rate]   │  ← row 1
│ [tag] [tag] [tag]                       │  ← row 2 (tags)
│ ─────────────────────────────────────── │  ← border-top: 1px solid var(--border)
│ [icon] Xh ago  [icon] X apps  [Apply]  │  ← footer
└─────────────────────────────────────────┘
```

**Vessel icon chip:** 38×38px, `border-radius: 10px`, 2-letter vessel type abbreviation in Geist Mono, uses `--c-icon-*` tokens. New component: `VesselChip`.

**Tags:** `background: var(--background)`, `border: 1px solid var(--border)`, `border-radius: 8px`, emoji prefix.

**Rate display:** Geist Mono 17px/700 + period suffix in Geist 11px/500 at 60% opacity. Same baseline.

**Card states:**

- Rest: `border: 1px solid var(--border)`, `background: var(--card)`
- Hover: `border-color: var(--border-hi)` only — no shadow, no lift, no bg change
- Selected/expanded: `border-color: var(--accent)` + `background: var(--card-hover)`
- Featured: left accent bar (3px, gradient), `--c-featured-border`, `--c-featured-bg`
- Urgent: `border-color: rgba(245,158,11,0.22)` + ribbon top-right

**Shadow rules:**

- Dark: borders and glow only, never drop shadows
- Light: `border` only at rest, `max-blur 8px` on featured
- Never: `translateY` on hover, `blur > 8px`, decorative shadows

**What to do:**

1. Update `card.tsx` base styles
2. Create `VesselChip` component
3. Apply card anatomy to discover page job cards (daywork + permanent)
4. Apply to review page applicant cards
5. Apply to mine page posting cards
6. Apply to application cards, invitation cards
7. Apply to messages list thread cards

**What NOT to do:** Do not change data displayed on cards — only visual treatment. Keep the same information hierarchy (role, vessel, location, rate, dates).

**NEVER** use `::before` or `::after` pseudo-elements for visual effects that need to respect `border-radius` — use `box-shadow` or real DOM elements (Safari/WebKit clips pseudo-elements inconsistently).

**Done when:** Every card in the app follows the anatomy. Featured/urgent variants exist and can be applied where relevant.

---

## Stage UI-8: Status Badge System

**Goal:** Four semantic badge states with consistent styling.

| State                  | Background              | Text                 | Border                   |
| ---------------------- | ----------------------- | -------------------- | ------------------------ |
| Open / Active          | `var(--success-lo)`     | `var(--success)`     | `rgba(52,211,153,0.18)`  |
| Filling Fast / Pending | `var(--warning-lo)`     | `var(--warning)`     | `rgba(245,158,11,0.18)`  |
| Invite Only / Closed   | `var(--accent-lo)`      | `var(--accent)`      | `var(--border-hi)`       |
| Disputed / Cancelled   | `var(--destructive-lo)` | `var(--destructive)` | `rgba(248,113,113,0.18)` |

**Pulsing dot:** Open and Filling badges get a 5px circle with `animation: blink 2s ease infinite`. Static states get no dot.

```css
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
```

**What to do:**

1. Add semantic variants to `badge.tsx` (`status-open`, `status-filling`, `status-closed`, `status-cancelled`)
2. Add `PulsingDot` sub-component
3. Replace all inline badge styling across pages with the new variants
4. Map existing application status labels to badge variants

**Done when:** Every status indicator in the app uses one of the four badge variants. No ad-hoc colour styling on badges.

---

## Stage UI-9: Bottom Nav Reskin

**Goal:** Restyle bottom-nav to match the new token system.

**What to do:**

1. Background: `var(--surface)`, `border-top: 1px solid var(--border)`
2. Inactive items: `color: var(--muted-foreground)`, transparent background
3. Active items: `color: var(--accent)`, `font-weight: 500`
4. Labels: 10px, weight 700, uppercase, `letter-spacing: 0.08em`
5. Count badges: Geist Mono, 10px, `border-radius: 4px`
6. Safe area handling: keep existing `env(safe-area-inset-bottom)` logic

**Done when:** Bottom nav looks native to the new design system in both themes.

---

## Stage UI-10: Motion System

**Goal:** Standardise all animation and transition behaviour.

**Entrance animations:** Staggered `translateY(14px) → 0` with `opacity: 0 → 1`, delay increment 60ms per item, duration 500ms, easing `cubic-bezier(0.16,1,0.3,1)`. One entrance animation per screen. Respect `prefers-reduced-motion`.

**Hover transitions:** `border-color 0.2s`, `background 0.2s` — nothing else.

**Pulsing dots:** `@keyframes blink` as defined in Stage UI-8.

**Hard bans:**

- No bounce, no spring physics, no scale transforms on cards
- No `transform: translateY` on hover
- No scattered micro-interactions
- One well-orchestrated page load beats many small animations

**What to do:**

1. Define entrance animation utility (CSS class or Framer Motion wrapper component)
2. Audit all existing Framer Motion usage — keep swipe gesture logic on discover/review, standardise entrance animations
3. Strip any hover transforms or scale effects
4. Add `prefers-reduced-motion` media query that disables entrance animations
5. Verify swipe animations still work correctly with new card styles

**Done when:** Page loads have a single staggered entrance. Hover states are border-only. No rogue animations.

---

## Stage UI-11: Body Background

**Goal:** Atmospheric gradients on the page background.

```css
body {
  background-color: var(--background);
  background-image:
    radial-gradient(ellipse 70% 50% at 15% -5%, var(--c-body-grad-a) 0%, transparent 65%),
    radial-gradient(ellipse 55% 45% at 85% 105%, var(--c-body-grad-b) 0%, transparent 60%);
}
```

These are the only background gradients on the page. Radial, corner-anchored, atmospheric. Do not add more.

**Test on mobile viewport (390px).** If the gradients create visible colour banding or distraction at small widths, reduce opacity or remove on `max-width: 640px`.

**Done when:** Subtle ambient light effect visible on page background in both themes. Not distracting on mobile.

---

## Stage UI-12: Page Reskin — Discover

**Goal:** Apply the full design system to the most important page.

This is where everything comes together. The discover page has daywork swipe cards, permanent scrollable feed, filter panel, tabs (Browse / Applied / Invitations), and the availability overlay.

**What to do:**

1. Apply card anatomy (Stage UI-7) to daywork job cards in the swipe stack
2. Apply card anatomy to permanent job cards in the scrollable feed
3. Apply to application cards (Applied tab)
4. Apply to invitation cards (Invitations tab)
5. Apply status badges (Stage UI-8) on all cards
6. Apply typography scale to all text elements
7. Ensure swipe gesture + Framer Motion still works with new card styles
8. Filter panel: inputs use 8px radius, filter pills use 999px
9. Tab system: accent colour on active tab
10. Entrance animation on card load

**Done when:** Discover page is fully reskinned. Both daywork and permanent views match the design system.

---

## Stage UI-13: Page Reskin — Chat & Messages

**What to do:**

1. Messages list: thread cards follow card anatomy, unread indicators use badge system
2. Chat page: message bubbles styled with new tokens
3. Daywork/permanent summary cards at top of chat
4. Banners (work-started, postponement, completion, cancellation) use status colours
5. Overlays (cancel, crew-cancel, postponement, rating, checklist) use card radius + button system
6. Input area: 8px radius, border tokens

**Done when:** Messages list and chat page match the design system.

---

## Stage UI-14: Page Reskin — Review Pages

**What to do:**

1. Daywork review: applicant cards follow card anatomy, swipe stack matches discover
2. Available crew tab cards
3. Permanent review: applicant list cards, shortlist tab
4. Tab system consistency
5. Filter panel consistency
6. Profile overlay (already a shared component — should inherit from token changes)

**Done when:** Both review pages match the design system.

---

## Stage UI-15: Page Reskin — Profile & Experience

**What to do:**

1. Profile page: experience cards, cert pills, size band pills, availability card, career status section
2. Add/edit experience pages: form inputs, vessel creation flow
3. Avatar display and upload
4. Epaulette badges: verify visibility against new card backgrounds (especially dark mode)

**Done when:** Profile pages match the design system. Epaulette badges readable in both themes.

---

## Stage UI-16: Page Reskin — Post Forms & Mine Pages

**What to do:**

1. Daywork post form: inputs, template management, posting type selector
2. Permanent post form: same treatment
3. Daywork mine page: posting cards across all tabs (Active, In Progress, Done, Templates)
4. Permanent mine section: all tabs

**Done when:** Post and mine pages match the design system.

---

## Stage UI-17: Page Reskin — Remaining Pages

**What to do:**

1. Settings page — already has the theme toggle from Stage UI-3. Ensure cards and inputs match.
2. Billing page
3. Vessels page + vessel edit page
4. Notifications page
5. Docky pages (main + conversation)
6. Onboarding page — integrate `assets/images/onboarding/` hero images as step backgrounds or illustrations
7. Auth pages (login, signup, forgot password, reset password) — integrate branding assets
8. Landing page — integrate branding + photography assets

**Done when:** Every page in the app uses the design system. No page looks like the old style.

---

## Stage UI-18: Image Assets Integration

**Goal:** Wire photography and branding into relevant pages for visual polish. Don't force images everywhere — a clean empty state with a Lucide icon is better than a forced stock photo.

**Available assets:**

| Category                    | Files                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `assets/images/onboarding/` | `onboarding_hero_aerial_01.jpeg`, `_aerial_02`, `_bow_01`, `_dining_01`, `_dining_02`, `_lounge_01`, `_lounge_02`, `_suite_01` |
| `assets/images/crew/`       | `crew_deckside_01.jpeg`, `_deckside_02`, `_rope_01`, `_rope_02`, `_teak_01`                                                    |
| `assets/images/vessel/`     | `vessel_drydock_01.jpeg`, `_drydock_02`, `_helm_01`, `_helm_02`, `_helm_chair_01`, `_shipyard_lift_01`, `_shipyard_lift_02`    |
| `assets/images/roles/`      | `core_hospitality_01.jpeg`, `core_chef_01-03.jpeg`, `vessel_engine_01.jpeg`                                                    |
| `assets/branding/`          | `small_128.png`, `small_256.png`, `dw_app_icon_cropped.png`, app icon kit (29–1024px)                                          |

### Placement Map

#### Tier 1 — First Impressions (every user sees these)

| Page                         | Placement                    | Asset                                                              | Treatment                                                                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Landing page hero**        | Full-width behind headline   | `onboarding_hero_aerial_01.jpeg`                                   | Gradient overlay: `linear-gradient(to bottom, transparent 30%, var(--background) 100%)`, max-height 400px |
| **Landing "How it Works"**   | Step illustrations           | `crew_deckside_01` (crew step), `vessel_helm_01` (employer step)   | 200px rounded cards, `object-cover`, `saturate(0.85)` in dark mode                                        |
| **Auth pages**               | Subtle background atmosphere | `onboarding_hero_bow_01.jpeg`                                      | Very low opacity (`0.06` dark, `0.04` light), full-bleed behind form, or side panel on wider viewports    |
| **Onboarding welcome**       | Hero image below heading     | `onboarding_hero_lounge_01.jpeg` or `_suite_01`                    | 200px height, rounded-[14px], gradient fade to background at bottom                                       |
| **Onboarding identity step** | Visual choice cards          | `crew_rope_01.jpeg` (crew), `vessel_helm_chair_01.jpeg` (employer) | 120px height inside selection cards, `object-cover`, border on selected                                   |

#### Tier 2 — Key Empty States (users hit within first session)

| Page                                | Current               | Asset                            | Treatment                                                         |
| ----------------------------------- | --------------------- | -------------------------------- | ----------------------------------------------------------------- |
| **Discover — "No jobs found"**      | Briefcase icon        | `crew_deckside_02.jpeg`          | 150px, rounded, centred above text. "Check back soon" feel        |
| **Profile — "No experiences"**      | Ship icon             | `crew_teak_01.jpeg`              | 150px, rounded, centred above "Add experience" CTA                |
| **Vessels — "No vessels yet"**      | Ship icon             | `vessel_drydock_01.jpeg`         | 150px, rounded, centred above text                                |
| **Messages — "No active messages"** | MessageSquare icon    | `onboarding_hero_dining_01.jpeg` | 150px, rounded. Warmth = "connections happen here"                |
| **Docky — "Ask Docky" welcome**     | LifeBuoy icon (16x16) | `vessel_helm_02.jpeg`            | 180px, rounded. Bridge/helm = "navigator" metaphor for AI advisor |

#### Tier 3 — Leave As-Is (icon + text is sufficient)

These empty states are low-traffic or secondary. Keep the current Lucide icon + text pattern.

- Notifications — "No notifications yet" (Bell icon)
- Applied — "No pending applications" (ClipboardList icon)
- Invitations — "No pending invitations" (Mail icon)
- Templates — "No saved templates" (text only)
- Permanent mine tabs — empty tab states (text only)

### Photo Treatment Rules

1. **Never full-bleed on cards** — use as background behind a gradient overlay so text is readable
2. **Max height 200px on mobile** — photos are accents, not heroes (except landing page)
3. **Dark mode desaturation** — `filter: saturate(0.85) brightness(0.7)` so photos don't fight the dark palette
4. **Always `object-cover` + `object-position`** — crop to the interesting part, don't stretch
5. **`next/image` with explicit width/height** — no layout shift, lazy load below fold, `priority` on above-fold only
6. **Empty state pattern**: image (150–200px, `rounded-[14px]`, subtle `border: 1px solid var(--border)`) centred above text + CTA, not beside it
7. **No full-opacity photos as card backgrounds** — always overlay with gradient fade to `var(--background)` or `var(--card)`

### Implementation Steps

1. Copy needed images to `apps/web/public/images/` (Next.js public directory) — organise by category (`/images/onboarding/`, `/images/empty-states/`, `/images/brand/`)
2. Resize originals for mobile: max 800px wide for hero images, max 400px for empty state images (don't serve 1080px originals to 390px viewports)
3. Wire into pages per the placement map above
4. Test each placement in both dark and light themes
5. Verify no layout shift (explicit `width`/`height` on all `next/image` uses)

### Missing Assets (not blocking, note for future)

- **Employer/captain imagery** — no photos of someone in a leadership/hiring context. The onboarding "I'm an employer" choice card uses `vessel_helm_chair_01` as a proxy.
- **Docky character/mascot** — the AI advisor has no visual identity beyond a Lucide icon. A branded illustration would elevate the Docky experience but is not required for launch.

**Done when:** Landing page, auth pages, onboarding, and 5 key empty states have photography. Photos look intentional in both themes. No forced or stock-photo feel.

---

## Global Rules — Apply to Every Stage

### Shadows & Elevation

- Dark mode: borders and glow only, never drop shadows
- Light mode: `border` only at rest, `max-blur 8px` on featured only
- Never: `translateY` on hover, `blur > 8px`, decorative shadows on flat surfaces

### Gradients

Gradients simulate physics. If you cannot explain why a gradient exists in terms of light hitting a surface, remove it.

**Permitted:** body background (atmospheric), gradient text (hero numbers only), vessel icon chip (subtle same-hue), featured card accent bar (vertical fade).

**Forbidden:** linear gradient fills on cards, gradient buttons, visible colour transitions, cross-hue gradients, gradient overlays as decoration.

### What NOT To Do

These patterns make UI look AI-generated. Hard bans across all stages.

1. **No purple** — anywhere, any form.
2. **No Inter or system-ui** as display font.
3. **No heavy drop shadows** (`blur > 8px` on cards).
4. **No gradient buttons** — solid fill only.
5. **No card lift on hover** (`transform: translateY`).
6. **No `::before`/`::after` for border-radius-dependent effects** — Safari clips inconsistently.
7. **No `/day` in `--tertiary`** — rate periods use `--muted-foreground` at `opacity: 0.6`.
8. **No evenly-distributed colour palettes** — dominant surfaces with sharp accent moments.
9. **No decorative cross-hue gradients.**
10. **No scattered micro-interactions** — one entrance animation per screen, hover = border change only.

### Reference Component — Job Card

When in doubt about any styling decision, refer to this component as the canonical pattern. All other components should feel like they came from the same design system.

```tsx
interface JobCardProps {
  title: string;
  vesselName: string;
  vesselSize: string;
  prefix: string; // 'MY' | 'SY'
  rate: number;
  currency: string;
  ratePeriod: string; // '/day' | '/month' | '/year'
  location: string;
  certs: string[];
  status: 'open' | 'filling' | 'invite' | 'closed';
  postedAt: string;
  applicantCount: number;
  featured?: boolean;
  urgent?: boolean;
}
```

The card renders per Stage UI-7 card anatomy. Featured variant: left accent bar + border + bg. Urgent variant: amber border tint + ribbon. Hover: border-color only. Selected: accent border + hover bg.
