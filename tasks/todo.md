# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-19: Landing Page Redesign

---

## Queue

### Stage UI-19: Landing Page Redesign

**Goal:** Replace the current generic landing page with a brand-led design. DockWalker logo is the hero element, not a stock photo. The page should feel like a product — not a SaaS template.

**Current problems:**

- Hero aerial image takes half the screen with no brand identity
- Massive empty gap between hero and features (gradient fade area)
- No DockWalker wordmark or logo prominent above the fold
- Feature list is small text with icon circles — generic
- "How it works" section decent but buried
- No clear CTA above the fold on smaller phones

**Will touch:** `app/page.tsx` only.

**Will NOT touch:** API routes, auth pages, any other pages.

**Available assets:**

- `public/images/brand/dw_app_icon_cropped.png` — app icon (already in public)
- `public/images/brand/dw_logo_white.png` — white logo variant
- `public/images/onboarding/hero-aerial.jpg` — can be kept as subtle background, not hero

---

#### UI-19a: Above the fold — logo-led hero

Replace the full-bleed aerial photo hero with a clean, brand-focused layout.

- [x] **Remove the full-width hero image** as the primary visual. The aerial photo can optionally stay as a very subtle background (opacity 0.03-0.05) or be removed entirely — evaluate visually
- [x] **DockWalker logo** large and centred: use `dw_app_icon_cropped.png` at 96-120px (currently 80px — too small). Or use `dw_logo_white.png` if it's a wordmark. Check what the white logo looks like.
- [x] **App name "DockWalker"** as text below/beside the logo: `text-[28px] font-bold tracking-[-0.5px]` — clear brand presence
- [x] **Tagline:** keep "Superyacht hiring, simplified" but bump to `text-[18px]` — currently `text-3xl` which is too large relative to the tagline
- [x] **Subtitle:** keep the description but tighten copy
- [x] **CTAs above the fold:** "Sign up" (primary) and "Log in" (outline) — use `Button` component, not custom link classes. `rounded-full` pill shape per design system
- [x] **Remove gradient overlay div** (lines 18-23) — no hero image to fade
- [x] **Background:** use `bg-[var(--background)]` with the body gradients (already set in globals.css from UI-D1). The atmospheric radial gradients give enough visual interest without a photo
- [x] **Vertical spacing:** hero section should fit above the fold on a 390px × 844px viewport (iPhone 14 size). Test: can you see both CTA buttons without scrolling?

---

#### UI-19b: Value props section

- [x] Keep the 3 feature rows (daywork, permanent, smart features) — they communicate well
- [x] Bump icon containers to `h-12 w-12` (from `h-10 w-10`) for better visual weight
- [x] Bump feature titles to `text-[15px] font-semibold` (from `text-sm`)
- [x] Section background: `bg-[var(--surface)]` (from `bg-muted/30`) — matches the surface pattern used elsewhere

---

#### UI-19c: How it works section

- [x] Keep the crew/employer photo cards — they work well
- [x] Keep the 3-step numbered list
- [x] Step number circles: use `bg-[var(--accent)]` (from `bg-primary`)
- [x] Consider: if the page feels too long on mobile, this section could be cut. Evaluate visually.

---

#### UI-19d: Footer

- [x] Keep simple — DockWalker tagline + login link
- [x] Use `text-[var(--tertiary)]` for footer text
- [x] Add Terms / Privacy links if they exist (check if routes exist)

---

#### Verify

- [x] On 390px viewport: logo + name + tagline + both CTAs visible above the fold without scrolling
- [x] No full-bleed stock photo as hero — logo is the primary visual
- [x] Page feels like DockWalker, not a template
- [x] Dark mode: atmospheric gradients visible, logo looks good against dark background
- [x] Light mode: clean, professional
- [x] CTAs use `Button` component with `rounded-full`
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, UI-16, Fix-z-index, UI-17, Fix-UI-17, UI-18, epaulette-fixes, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
