# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix UI-17 (commit the 2 line fixes already applied)

---

## Queue

### Fix UI-17: Two missed items (already applied, needs commit)

- [x] `settings/_components/danger-zone-section.tsx`: `bg-destructive/10` → `bg-[var(--destructive-lo)]`
- [x] `notifications/page.tsx`: add `font-mono` to timestamp

---

### Stage UI-18: Image Assets Integration

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

- [ ] Write a one-off Node script using `sharp` to resize needed images. **Source:** `assets/images/` (originals, untouched). **Output:** `apps/web/public/images/` (resized copies only — this is the web-served directory). Same subfolder structure: `public/images/onboarding/`, `public/images/empty-states/`, `public/images/brand/`. Heroes 800px wide, empty states 400px wide, JPEG quality 85. Originals in `assets/` stay as-is.
- [ ] Delete the resize script after running (one-time use)
- [ ] Verify: `assets/images/` still contains all originals, `public/images/` contains only resized copies, no originals committed to `public/`

---

#### UI-18b: Tier 1 — First impressions

**Landing page hero (`app/page.tsx`):**

- [ ] Full-width hero image behind headline: `onboarding_hero_aerial_01.jpeg`
- [ ] Gradient overlay: `linear-gradient(to bottom, transparent 30%, var(--background) 100%)`
- [ ] Max height 400px, `next/image` with `priority`

**Landing "How it works" section:**

- [ ] Step illustrations: `crew_deckside_01` (crew step), `vessel_helm_01` (employer step)
- [ ] 200px rounded cards, `object-cover`, dark mode desaturation

**Auth pages (login, signup, forgot-password, reset-password):**

- [ ] Subtle background atmosphere: `onboarding_hero_bow_01.jpeg`
- [ ] Very low opacity (`0.06` dark, `0.04` light), full-bleed behind form
- [ ] Or skip if it feels forced — evaluate visually

**Onboarding welcome step:**

- [ ] Hero image below heading: `onboarding_hero_lounge_01.jpeg` or `_suite_01`
- [ ] 200px height, `rounded-[14px]`, gradient fade to background at bottom

**Onboarding identity step (crew vs employer choice):**

- [ ] Visual choice cards: `crew_rope_01.jpeg` (crew), `vessel_helm_chair_01.jpeg` (employer)
- [ ] 120px height inside selection cards, `object-cover`, border on selected

---

#### UI-18c: Tier 2 — Key empty states

**Discover — "No jobs found":**

- [ ] Replace Briefcase icon with `crew_deckside_02.jpeg`
- [ ] 150px, `rounded-[14px]`, centred above text

**Profile — "No experiences":**

- [ ] Replace Ship icon with `crew_teak_01.jpeg`
- [ ] 150px, `rounded-[14px]`, centred above "Add experience" CTA

**Vessels — "No vessels yet":**

- [ ] Replace Ship icon with `vessel_drydock_01.jpeg`
- [ ] 150px, `rounded-[14px]`, centred above text

**Messages — "No active messages":**

- [ ] Replace MessageSquare icon with `onboarding_hero_dining_01.jpeg`
- [ ] 150px, `rounded-[14px]`

**Docky — "Ask Docky" welcome:**

- [ ] Replace LifeBuoy icon with `vessel_helm_02.jpeg`
- [ ] 180px, `rounded-[14px]`

---

#### UI-18d: Tier 3 — Leave as-is

No images needed for these low-traffic empty states (keep Lucide icon + text):

- Notifications, Applied, Invitations, Templates, Permanent mine tabs

---

#### Verify

- [ ] Landing page hero image loads, gradient overlay readable, not distracting on mobile
- [ ] Auth pages: subtle background OR no image if forced
- [ ] Onboarding welcome + identity steps have photography
- [ ] 5 key empty states have images (discover, profile, vessels, messages, docky)
- [ ] Dark mode: images desaturated (`saturate(0.85) brightness(0.7)`)
- [ ] No layout shift (explicit width/height on all `next/image`)
- [ ] Images served at mobile-appropriate sizes (resized, not originals)
- [ ] Both themes look intentional
- [ ] `npx tsc --noEmit` — zero errors
- [ ] All tests pass

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
