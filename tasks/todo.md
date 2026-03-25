# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix: Avatar crop buttons STILL unreachable

---

## Queue

### Fix: Avatar crop buttons covered by react-easy-crop shadow

Previous fixes (`overflow-hidden`, `shrink-0`, `pb-safe`) did not solve the problem. Root cause identified:

`react-easy-crop`'s `.reactEasyCrop_CropArea` uses `box-shadow: 0 0 0 9999em` with `color: rgba(0,0,0,0.5)` to create the dark overlay outside the crop circle. This `9999em` shadow bleeds out of the cropper container and visually covers the button bar below, even though the buttons exist in the DOM.

**Fix:** Add `z-10` (or `relative z-10`) to the button bar so it renders above the cropper's shadow overlay.

- [x] `image-cropper.tsx` line 73: add `relative z-10` to the button bar div — this lifts it above the cropper's `9999em` box-shadow overlay. Full class: `shrink-0 relative z-10 flex items-center justify-center gap-4 bg-[var(--surface)] p-4 pb-safe`
- [x] Test on phone: after selecting a photo, crop modal shows Cancel + Confirm buttons **visible and tappable** at the bottom, not covered by the dark overlay
- [x] Verify cropper still works: drag to reposition, pinch to zoom, circular crop area visible

---

### Fix: Profile overlay — square top corners + scrollability

The profile overlay (`components/profile-overlay.tsx`) has two visual issues on mobile:

**Square corners:** The outer container (line 113) has `w-full max-w-lg` and `rounded-[14px]`. On a phone (~390px), `max-w-lg` (512px) exceeds screen width, so the overlay renders at full viewport width with no horizontal gap. The rounded corners exist in the DOM but are invisible because there's no backdrop showing on either side.

**Scrollability is fine** — confirmed working with longer crew profiles. Short employer profiles just don't have enough content to scroll, which is expected.

- [x] Add horizontal inset to the overlay so rounded corners are visible: add `mx-3` to the overlay sheet div (line 113). This creates ~12px horizontal gap on each side, making the rounded corners and backdrop visible. Full class: `mx-3 mb-2 flex max-h-[calc(85vh-var(--nav-height,4rem))] w-full max-w-lg ...`
- [x] Verify on phone: overlay clearly shows rounded corners on all sides, dark backdrop visible around the edges
- [x] Verify content still scrollable on longer crew profiles

---

### Stage UI-16: Post Forms & Mine Pages Reskin

**Goal:** Apply the design system to the daywork/permanent post forms, posting type selector, and the mine page (posting cards across all tabs + templates). Same tokens proven on discover, chat, review, profile.

**Will touch:** `daywork/post/page.tsx`, `daywork/post/_components/`, `daywork/mine/page.tsx`, `daywork/mine/_components/`, `permanent/[id]/review/page.tsx` availability labels already done (UI-14).

**Will NOT touch:** API routes, migrations, types, business logic, non-post/mine pages.

---

#### UI-16a: Headers + posting type selector

**Daywork post page header (`daywork/post/page.tsx` ~line 339):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold`)

**Permanent post form header (`permanent-post-form.tsx` ~line 242):**

- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-xl font-bold`)

**Posting type selector (`posting-type-selector.tsx`):**

- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-2xl font-bold`)
- [x] Choice cards: `rounded-[14px]` (verify current `rounded-xl` maps correctly or update)
- [x] Hover: `hover:border-[var(--border-hi)]` (replace `hover:border-primary`)

**Mine page header (`daywork/mine/page.tsx` ~line 405):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold`)

---

#### UI-16b: Mine page posting cards

**Status badges (`daywork/mine/page.tsx` ~line 260):**

- [x] Replace hardcoded `statusColor` map with design token badge variants:
  - `active` → `status-open` badge variant (replace `bg-success text-white`)
  - `in_progress` → `status-filling` badge variant (replace `bg-primary text-primary-foreground`)
  - `cancelled` → `status-cancelled` badge variant (replace `bg-muted text-muted-foreground`)
  - `completed` → `status-closed` badge variant (replace `bg-sea text-white`)

**Posting card anatomy (`renderPostingCard` ~line 271):**

- [x] Card title: `text-[15px] font-semibold tracking-[-0.3px]` (replace `text-base`)
- [x] Job ref + vessel subtitle: `font-mono text-[11px] text-[var(--tertiary)]` for DW-XXXXX portion
- [x] Detail rows (location, dates, rate): `text-[13px] text-[var(--muted-foreground)]`
- [x] Rate: `font-mono text-[17px] font-bold tracking-[-0.5px]` for amount, `text-[11px] font-medium text-[var(--muted-foreground)] opacity-60` for `/day`
- [x] Experience/positions badges: keep `variant="secondary"` or update to `bg-[var(--surface)] border border-[var(--border)]` for consistency with discover cards
- [x] Notes: `text-[13px] text-[var(--muted-foreground)]`

---

#### UI-16c: Permanent mine section

**Permanent mine (`permanent-mine-section.tsx`):**

- [x] Tab buttons: use token-based active state — `border-[var(--foreground)] text-[var(--foreground)]` for active, `text-[var(--muted-foreground)]` for inactive (replace hardcoded `border-primary text-primary`)
- [x] Posting cards: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-xl border bg-card`)
- [x] Template cards: same `rounded-[14px]` treatment
- [x] In-negotiation banner: `bg-[var(--warning-lo)] text-[var(--warning)]` (replace hardcoded `bg-amber-50 text-amber-800`)
- [x] Card typography: same `text-[15px]` title, `text-[13px]` body, `font-mono` rate pattern

---

#### UI-16d: Post form toggle buttons

**Period/cert/language toggle buttons (`permanent-form-sections.tsx`):**

- [x] Selected state: `bg-[var(--accent)] text-white` (replace `bg-primary text-primary-foreground`)
- [x] Unselected state: `bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]` (replace `bg-muted text-foreground` / `bg-muted`)
- [x] Salary preview text: `text-[var(--accent)]` (replace `text-primary`)
- [x] Textarea: `bg-[var(--card)]` (replace `bg-background`)

**Daywork post form (`daywork/post/page.tsx`):**

- [x] Verify all form inputs use token-based styling (most should inherit from Input component)
- [x] Any `bg-muted` on toggle/pill buttons → same treatment as permanent form

---

#### Verify all fixes

- [x] Crop modal: Cancel + Confirm buttons visible and tappable on mobile device
- [x] All post/mine headers: `bg-[var(--surface)]`, `text-[24px]` titles
- [x] Mine page status badges use design token badge variants — no `bg-success text-white` or `bg-sea`
- [x] Posting cards: `text-[15px]` titles, `font-mono` rates, `text-[13px]` body
- [x] Permanent mine: no hardcoded `bg-amber-50`, tab buttons use tokens
- [x] Form toggle buttons: `--accent` selected state, `--card` unselected
- [x] Both themes work
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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
