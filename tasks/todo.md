# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix: Empty state image layout + Department chip size

---

## Queue

### Fix: Empty state image not filling card width

The image is constrained by the card's `px-6` padding and wrapped in its own `rounded-[14px] border` — creating a padded, double-bordered thumbnail instead of a full-width hero.

**Fix:** Restructure the `EmptyState` component so the image fills edge-to-edge at the top of the card, with text padded below. No image border — the card border is enough.

- [x] `empty-state.tsx`: Remove `px-6` from the outer div when `imageSrc` is present. Restructure layout:
  - Outer card: `rounded-[14px] border border-dashed border-[var(--border)] overflow-hidden text-center` (no horizontal padding)
  - Image: `w-full h-[180px] object-cover` directly inside the card (no wrapper div, no inner border, no inner rounded corners — the card's `overflow-hidden` + `rounded-[14px]` clips the image)
  - Text + action section below image: `px-6 py-6` (padding only on the text area)
  - When no `imageSrc` (icon-only): keep existing `px-6 py-10` layout with centred icon
- [x] Dark mode desaturation: keep `dark:saturate-[0.85] dark:brightness-[0.7]` on the image
- [x] Verify on phone: image fills full card width, rounds with the card corners at top, text is cleanly separated below on card background

---

### Fix: Epaulette badges — icons wrong, too small, missing on some cards

**Issues found (verified against code):**

1. **Galley "knife" icon is a lightning bolt:** `KnifeIcon` SVG path (`M11.5 1.5L5 9.5h3l-1 5 6.5-8h-3z`) is a zigzag/lightning bolt, not a knife. Replace with a proper chef's knife or chef's hat silhouette.

2. **Engineering "propeller" is unrecognizable:** `PropellerIcon` SVG is abstract blobs at 12px. Replace with a **gear/cog** icon — simpler, universally understood, reads clearly at small sizes.

3. **Interior crescent needs improvement:** Current `CrescentIcon` SVG may be too thin at 12px. Verify visually at new larger size — if still unclear, redraw as a bolder crescent.

4. **Applied cards sometimes missing epaulette:** `getEpaulette(roleName, department)` returns `null` when `roleName` isn't in `ROLE_EPAULETTE_MAP` AND no `department` prop is passed. The applied tab (`applied-tab.tsx`) passes `roleName` from the API but likely doesn't pass `department`. Fix: ensure all card components pass `department` alongside `roleName` to `EpauletteBadge`. Check API responses include `department` field — discover API does, verify applications/invitations APIs do too.

5. **Overall too small:** Current `sm` is `h-5` (20px), `md` is `h-6` (24px). Bump both sizes up.

**Implementation:**

- [x] Replace `KnifeIcon` SVG with a proper filled chef's knife silhouette (blade + handle, recognizable at 14px)
- [x] Replace `PropellerIcon` SVG with a filled gear/cog icon (6-8 teeth, centre hole, recognizable at 14px)
- [x] Verify `CrescentIcon` reads clearly — if not, redraw as bolder filled crescent
- [x] Bump badge sizes: `sm` from `h-5` to `h-6` (24px), `md` from `h-6` to `h-7` (28px). Increase icon sizes proportionally: `sm` 12→14px, `md` 14→16px. Increase stripe dimensions to match.
- [x] Ensure all card types pass `department` to `EpauletteBadge`: check `applied-tab.tsx`, `invitations-tab.tsx`, `permanent-application-card.tsx`, mine page cards. If API doesn't return department, add it to the query (roles table has department column)
- [x] Verify: every job card with a role shows an epaulette — no silent nulls

---

### Fix: Department chip larger — 56px → 64px

At 38px photos were blobs, at 56px (current) still too small per user feedback. Bump to 64px md / 48px sm.

**DepartmentChip component (`components/department-chip.tsx`):**

- [x] Change `md` size to 64×64: `h-16 w-16`
- [x] Change `sm` size to 48×48: `h-12 w-12`
- [x] Keep `rounded-[10px]`, `object-cover`, dark mode desaturation
- [x] Update `next/image` width/height props to match

**Re-resize thumbnails:**

- [x] Re-run sharp resize at 128×128px (2x retina for 64px display), overwrite existing files in `public/images/departments/`

**Card layout:**

- [x] Verify header row fits at 64px chip on 390px viewport — title needs `min-w-0 flex-1`
- [x] If 64px makes the header row too cramped, try the chip on its own row above the title instead of inline

**Verify:**

- [x] Department photos clearly recognizable at 64px
- [x] Card layout not broken on mobile
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass

---

### Stage UI-18: Image Assets Integration (MOSTLY COMPLETE)

**Goal:** Wire photography and branding into landing, onboarding, auth, and key empty states. Sharp is available via Node (`require('sharp')`) for resizing.

**Resize step:** One-off Node script — `sharp(input).resize(width).jpeg({ quality: 85 }).toFile(output)`. Max 800px wide for heroes, 400px for empty states. Output to `apps/web/public/images/` organised by category. Keep originals in `assets/images/`.

**Photo treatment rules:**

1. Never full-bleed on cards — gradient overlay for text readability
2. Max height 200px on mobile (except landing hero)
3. Dark mode: `filter: saturate(0.85) brightness(0.7)`
4. Always `object-cover` + `object-position`
5. `next/image` with explicit width/height — no layout shift
6. Empty state pattern: image (150–200px, `rounded-[14px]`, border) centred above text + CTA

---

#### UI-18a: Copy and resize assets

- [x] Write a one-off Node script using `sharp` to resize needed images. **Source:** `assets/images/` (originals, untouched). **Output:** `apps/web/public/images/` (resized copies only — this is the web-served directory). Same subfolder structure: `public/images/onboarding/`, `public/images/empty-states/`, `public/images/brand/`. Heroes 800px wide, empty states 400px wide, JPEG quality 85. Originals in `assets/` stay as-is.
- [x] Delete the resize script after running (one-time use)
- [x] Verify: `assets/images/` still contains all originals, `public/images/` contains only resized copies, no originals committed to `public/`

---

#### UI-18b: Tier 1 — First impressions

**Landing page hero (`app/page.tsx`):**

- [x] Full-width hero image behind headline: `onboarding_hero_aerial_01.jpeg`
- [x] Gradient overlay: `linear-gradient(to bottom, transparent 30%, var(--background) 100%)`
- [x] Max height 400px, `next/image` with `priority`

**Landing "How it works" section:**

- [x] Step illustrations: `crew_deckside_01` (crew step), `vessel_helm_01` (employer step)
- [x] 200px rounded cards, `object-cover`, dark mode desaturation

**Auth pages (login, signup, forgot-password, reset-password):**

- [x] Subtle background atmosphere: `onboarding_hero_bow_01.jpeg`
- [x] Very low opacity (`0.06` dark, `0.04` light), full-bleed behind form
- [x] Or skip if it feels forced — evaluate visually

**Onboarding welcome step:**

- [x] Hero image below heading: `onboarding_hero_lounge_01.jpeg` or `_suite_01`
- [x] 200px height, `rounded-[14px]`, gradient fade to background at bottom

**Onboarding identity step (crew vs employer choice):**

- [x] Visual choice cards: `crew_rope_01.jpeg` (crew), `vessel_helm_chair_01.jpeg` (employer)
- [x] 120px height inside selection cards, `object-cover`, border on selected

---

#### UI-18c: Tier 2 — Key empty states

**Discover — "No jobs found":**

- [x] Replace Briefcase icon with `crew_deckside_02.jpeg`
- [x] 150px, `rounded-[14px]`, centred above text

**Profile — "No experiences":**

- [x] Replace Ship icon with `crew_teak_01.jpeg`
- [x] 150px, `rounded-[14px]`, centred above "Add experience" CTA

**Vessels — "No vessels yet":**

- [x] Replace Ship icon with `vessel_drydock_01.jpeg`
- [x] 150px, `rounded-[14px]`, centred above text

**Messages — "No active messages":**

- [x] Replace MessageSquare icon with `onboarding_hero_dining_01.jpeg`
- [x] 150px, `rounded-[14px]`

**Docky — "Ask Docky" welcome:**

- [x] Replace LifeBuoy icon with `vessel_helm_02.jpeg`
- [x] 180px, `rounded-[14px]`

---

#### UI-18d: Tier 3 — Leave as-is

No images needed for these low-traffic empty states (keep Lucide icon + text):

- Notifications, Applied, Invitations, Templates, Permanent mine tabs

---

#### Verify

- [x] Landing page hero image loads, gradient overlay readable, not distracting on mobile
- [x] Auth pages: subtle background OR no image if forced
- [x] Onboarding welcome + identity steps have photography
- [x] 5 key empty states have images (discover, profile, vessels, messages, docky)
- [x] Dark mode: images desaturated (`saturate(0.85) brightness(0.7)`)
- [x] No layout shift (explicit width/height on all `next/image`)
- [x] Images served at mobile-appropriate sizes (resized, not originals)
- [x] Both themes look intentional
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, UI-16, Fix-z-index, UI-17, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
