# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

UI-18 fixes + Department Thumbnails

---

## Queue

### Fix: Empty state images too small

The empty state images render as narrow thumbnails (150px height, auto width) floating in the card. They should fill the card width.

- [x] `empty-state.tsx` line 27: change `h-[150px] w-auto` to `w-full h-[150px]` — image fills card width, cropped to 150px height via `object-cover`
- [x] Verify on phone: empty state image spans the full card width, no awkward padding on sides

---

### Replace VesselChip with Department Thumbnails

**Goal:** Replace the "MY"/"SY" VesselChip square on job cards with department-themed photography thumbnails. The vessel type designation is redundant — "M/Y Serenity" already shows below. Department photos make cards visually richer.

**Department → image pool:**

| Department         | Images (from `assets/images/`)                                                                                    | Count |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ----- |
| Deck / Bridge      | `crew_deckside_01/02`, `crew_rope_01/02`, `crew_teak_01`, `vessel_helm_01/02`                                     | 7     |
| Interior           | `core_hospitality_01`, `onboarding_hero_dining_01/02`, `onboarding_hero_lounge_01/02`, `onboarding_hero_suite_01` | 6     |
| Galley             | `core_chef_01/02/03`                                                                                              | 3     |
| Engineering        | `vessel_engine_01`, `vessel_drydock_01/02`, `vessel_shipyard_lift_01/02`                                          | 5     |
| Hybrid departments | Use primary department pool (deck_engineering → deck, deck_interior → deck, galley_interior → galley)             |

**Selection logic:** Deterministic pseudo-random per card — hash the job ID (or posting ID) to pick an index from the department's image array. Same card always shows the same image, but adjacent same-department cards show different photos.

**Implementation:**

- [x] Resize department thumbnails to 80×80px (square crop, JPEG quality 85) using sharp — output to `apps/web/public/images/departments/` with naming convention `{department}_{index}.jpg` (e.g. `deck_01.jpg`, `galley_02.jpg`)
- [x] Create `DepartmentChip` component to replace `VesselChip` — same dimensions (38×38 md, 32×32 sm), `rounded-[10px]`, `object-cover`, `next/image`. Props: `department: string`, `seed: string` (job ID for deterministic selection)
- [x] Wire department from role data — roles already have a `department` field. Check if discover/mine/review API responses include department, add if missing
- [x] Replace `VesselChip` in `daywork-card.tsx` and `permanent-job-card.tsx` with `DepartmentChip`
- [x] Add `DepartmentChip` to cards that don't currently have a chip: application cards, invitation cards, mine page posting cards, review applicant cards — evaluate which benefit
- [x] Fallback: if department unknown or no images, show a generic vessel image
- [x] Update any component tests that reference `VesselChip`

**Verify:**

- [x] Discover cards show department photos instead of MY/SY
- [x] Adjacent same-department cards show different photos
- [x] Same card always shows the same photo (deterministic)
- [x] Images look sharp at 38×38 — not blurry
- [x] Dark mode desaturation on thumbnails
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
