# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-16: Post Forms & Mine Pages Reskin + Crop Fix

---

## Queue

### Fix: Avatar crop buttons unreachable on mobile

The `ImageCropper` modal (`components/image-cropper.tsx`) has Cancel + Confirm buttons that the user cannot reach on mobile. The `react-easy-crop` `Cropper` component inside `relative flex-1` likely expands beyond the viewport or its internal absolute positioning covers the button bar.

- [x] Add `overflow-hidden` to the cropper container div (line 60): `<div className="relative flex-1 overflow-hidden">` — this constrains the cropper's internal absolutely-positioned elements to the flex-1 area
- [x] If that's insufficient: change the button bar to use `shrink-0` explicitly: `<div className="shrink-0 flex items-center justify-center gap-4 bg-[var(--surface)] p-4 pb-safe">` — ensures flexbox doesn't collapse the bar
- [x] Test on phone: after selecting a photo, crop modal shows with Cancel + Confirm buttons **visible and tappable** at the bottom

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
