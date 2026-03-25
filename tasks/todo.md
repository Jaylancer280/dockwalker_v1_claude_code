# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-15b: Profile device-testing fixes

---

## Queue

### Stage UI-15b: Profile device-testing fixes

**Goal:** Fix 2 issues found during device testing of the profile reskin.

**Will touch:** `components/image-cropper.tsx`, `profile/_components/experience-details-section.tsx`

**Will NOT touch:** API routes, migrations, types, business logic.

---

#### Fix 1: Avatar crop confirm button hidden on mobile

The `ImageCropper` modal (`components/image-cropper.tsx`) has Cancel + Confirm buttons in a bottom bar (`bg-black p-4`). On mobile devices with system navigation bars (iOS home indicator, Android gesture bar), the buttons are obscured because the bar lacks safe area padding.

- [x] Add `pb-safe` to the button bar container (line 73): `bg-black p-4 pb-safe` — this uses the existing `pb-safe` utility that maps to `env(safe-area-inset-bottom)`
- [x] Verify the cropper area (`flex-1`) doesn't expand to cover the buttons — the `flex flex-col` parent with `fixed inset-0` should naturally give `flex-1` to the cropper and shrink-0 to the button bar, but confirm
- [x] Also apply token-based styling while touching this file: button bar `bg-[var(--surface)]` instead of `bg-black`, modal backdrop keep `bg-black/90`

---

#### Fix 2: Date inputs overlap on mobile

The start/end date inputs in `experience-details-section.tsx` (line 116) use `grid grid-cols-2 gap-3`. On a 390px viewport inside `max-w-lg` with `px-4` padding, each column is ~234px — native `<input type="date">` elements render wider than this on mobile, causing visual overlap.

- [x] Change `grid grid-cols-2 gap-3` to `grid grid-cols-1 gap-3 sm:grid-cols-2` — stack vertically on mobile, side-by-side on wider viewports
- [x] Verify on 390px viewport: both date inputs fully visible, no overlap, labels clear

---

#### Verify

- [x] Open profile page on phone (or 390px viewport), tap avatar → crop modal: Cancel and Confirm buttons visible above system nav bar
- [x] Open add-experience page on phone: start date and end date inputs stack vertically with no overlap
- [x] Both fixes work in light and dark mode
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass

---

### Stage UI-15: Profile & Experience Reskin (COMPLETED)

**Goal:** Apply the design system to the profile page (collapsible sections, experience cards, cert/size pills, availability, career status), add/edit experience pages, profile overlay, and availability overlay.

**Will touch:** `profile/page.tsx`, all `profile/_components/`, `profile/add-experience/`, `profile/edit-experience/`, `components/profile-overlay.tsx`, `components/availability-overlay.tsx`, `components/epaulette-badge.tsx`.

**Will NOT touch:** API routes, migrations, types, business logic, non-profile pages.

**No decomposition needed:** Profile page is 702 lines but already delegates to 11 sub-components (Stage UI-0). All under 330 lines.

---

#### UI-15a: Profile page header + section containers

**Header (`page.tsx` ~line 428):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold tracking-tight`)

**Collapsible section buttons (throughout page.tsx and sub-components):**

- [x] Section containers: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-lg border border-border bg-card`)
- [x] Section title labels: `text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]` (replace `text-xs font-semibold uppercase tracking-wider`)
- [x] Collapsed preview text: `text-[13px] text-[var(--muted-foreground)]`

---

#### UI-15b: Profile sections content

**Summary section (`profile-summary-section.tsx`):**

- [x] Auto-derived labels: `text-[13px]`
- [x] Experience icon container: `bg-[var(--accent-lo)] text-[var(--accent)]` (replace `bg-primary/10 text-primary`)

**Experience section (`profile-experience-section.tsx`):**

- [x] Experience cards: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-lg border border-border bg-card`)
- [x] Vessel name / role: `text-[15px] font-semibold tracking-[-0.3px]`
- [x] Detail grid labels: `text-[11px] text-[var(--tertiary)]` (replace `text-[11px] text-muted-foreground`)
- [x] Detail values: `text-[13px]`
- [x] Total experience badge: `font-mono text-[11px]` — verify uses token colours
- [x] Delete button: keep `variant="destructive"`
- [x] Epaulette badges: preserve — gold/silver colours are intentional insignia, not design tokens

**Looking For section (`profile-looking-for-section.tsx`):**

- [x] Availability status — replace hardcoded emerald:
  - "Available immediately" dot: `bg-[var(--success)]` (replace `bg-emerald-500`)
  - "Available immediately" text: `text-[var(--success)]` (replace `text-emerald-600 dark:text-emerald-400` — remove `dark:` class)
  - "Not available" dot/text: keep `text-destructive` (already token-based)
  - "Not set" text: keep `text-[var(--muted-foreground)]`
- [x] Career status labels: `text-[13px]`
- [x] Desired role / port: `text-[13px]`

**About section (`profile-about-section.tsx`):**

- [x] Bio: `text-[13px]`
- [x] Cert pills: `bg-[var(--surface)] border border-[var(--border)] rounded-full px-2 py-0.5 text-xs` (replace `bg-muted`)
- [x] Visa pills: same treatment
- [x] Language pills: same treatment
- [x] Size band pills: same treatment

**Agent section (`agent-profile-section.tsx`):**

- [x] Same section container and label patterns as crew sections

---

#### UI-15c: Add/edit experience pages

**Headers (`add-experience/page.tsx`, `edit-experience/[id]/page.tsx`):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Back link: `text-[var(--muted-foreground)] hover:text-[var(--foreground)]`

**IMO lookup section (`imo-lookup-section.tsx`):**

- [x] Found vessel card: `rounded-[14px] border border-[var(--success)]/40 bg-[var(--success-lo)]` (replace `border-success/40 bg-success/5` — use token)
- [x] Dropdown menu: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-md bg-background shadow-lg` — remove shadow)

**Vessel details section (`vessel-details-section.tsx`):**

- [x] Vessel name prefix (M/Y, S/Y): verify uses token text colour

**Experience details section (`experience-details-section.tsx`):**

- [x] Form labels: `text-[var(--muted-foreground)]`
- [x] Form containers: verify `rounded-lg` inputs (8px per guidance)

**Private intelligence section (`private-intelligence-section.tsx`):**

- [x] Section hint text: `text-[var(--muted-foreground)]`
- [x] Left border accent: `border-l-2 border-[var(--border)]` (replace `border-muted` if hardcoded)

---

#### UI-15d: Profile overlay + availability overlay

**Profile overlay (`components/profile-overlay.tsx`):**

- [x] Overlay sheet: `rounded-[14px]` (replace `rounded-2xl`) — match card system radius
- [x] Remove `shadow-xl` (no shadows per guidance)
- [x] Header: `bg-[var(--surface)] border-b border-[var(--border)]`
- [x] Section headers: `text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]`
- [x] Experience cards within overlay: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]`
- [x] Detail grid: `text-[13px]`
- [x] Cert/size pills: same token treatment as profile page
- [x] Availability status: same `--success` token fix as profile-looking-for

**Availability overlay (`components/availability-overlay.tsx`):**

- [x] Overlay sheet: `rounded-t-[14px]` (replace `rounded-t-2xl`)
- [x] Calendar today ring: `ring-1 ring-[var(--accent)]` (replace `ring-primary`)
- [x] Selected day: `bg-[var(--success)] text-white` — verify already token-based
- [x] Hover state: `hover:bg-[var(--accent-lo)]` (replace `hover:bg-accent`)
- [x] "Not available" toggle: `border-[var(--destructive)]` — verify already token-based
- [x] Month labels: `text-[var(--muted-foreground)]`
- [x] Confirm button: uses Button default variant — should inherit `--accent`

---

#### Verify all fixes

- [x] Profile header uses `bg-[var(--surface)]`
- [x] All section containers: `rounded-[14px]`, token borders and backgrounds
- [x] Experience cards match discover card anatomy
- [x] No hardcoded emerald/green anywhere — availability uses `--success` token
- [x] Cert/visa/language/size pills use `bg-[var(--surface)]` + border tokens
- [x] Profile overlay: no shadow, token-based throughout
- [x] Availability calendar: token-based ring and selection colours
- [x] Epaulette badges: gold/silver/slate preserved (intentional insignia)
- [x] Add/edit experience forms: headers use `--surface`, IMO dropdown no shadow
- [x] Both themes work
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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
