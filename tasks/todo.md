# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-14: Review Pages Reskin

---

## Queue

### Stage UI-14: Review Pages Reskin

**Goal:** Apply the design system to the daywork review page (applicant swipe stack, shortlist tab, available crew tab) and permanent review page (applicant list, shortlist tab, negotiation banner). Same tokens, typography, card anatomy proven on discover and chat.

**Will touch:** `daywork/[id]/review/page.tsx`, all `_components/` in that directory, `permanent/[id]/review/page.tsx`.

**Will NOT touch:** API routes, migrations, types, business logic, non-review pages.

**No decomposition needed:** Daywork review page is 453 lines with components already extracted (Stage UI-0). Permanent review is 384 lines.

---

#### UI-14a: Daywork review page + header

**Review page header (`page.tsx`):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold tracking-tight`)
- [x] Positions badge: `bg-[var(--accent-lo)] text-[var(--accent)]` (replace `bg-muted`)
- [x] Permanent opportunity badge: `border border-[var(--border)]` — keep as-is if already token-based
- [x] Tab system: verify `UnderlineTabs` used, or match its styling
- [x] Filter button: already uses Button variants — verify `(active)` indicator uses `--accent` token

**Filter panel (`review-filter-panel.tsx`):**

- [x] Uses `<Card>` component — should inherit `rounded-[14px]` from UI-D2
- [x] Labels: `text-xs font-medium text-[var(--muted-foreground)]`
- [x] Verify inputs inherit token-based styling

---

#### UI-14b: Applicant swipe cards

The applicant card is a swipe stack identical to the discover daywork card pattern. Needs the same treatment.

**Applicant card (`applicants-tab.tsx` ~line 277):**

- [x] Card container: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-2xl border border-border bg-background shadow-lg` — remove shadow)
- [x] Preview card: keep `scale-[0.97] opacity-60`
- [x] Card name: `text-[15px] font-semibold tracking-[-0.3px]` (replace `text-lg font-bold`)
- [x] Role subtitle: `text-[13px] text-[var(--muted-foreground)]`
- [x] Detail rows (experience, location, certs): `text-[13px]`
- [x] Icon colours: `text-[var(--muted-foreground)]`
- [x] Bio: `text-[13px] text-[var(--muted-foreground)]`
- [x] Applied date: `font-mono text-[11px] text-[var(--tertiary)]` (replace `text-xs text-muted-foreground/60`)
- [x] Application message: `bg-[var(--surface)] rounded-md px-2.5 py-1.5 text-xs italic text-[var(--foreground)]` (replace `bg-accent` — same fix as UI-D5)
- [x] Cert/vessel/language badges: `bg-[var(--surface)] border border-[var(--border)] text-xs` (replace `variant="secondary"`)
- [x] "Shortlisted" star icon: `fill-[var(--warning)] text-[var(--warning)]` (replace `fill-amber-500`)
- [x] "Invited" badge: `bg-[var(--accent-lo)] text-[var(--accent)]` (replace `bg-primary/10 text-primary`)

**Swipe action labels (overlays that appear during drag):**

- [x] Accept: `border-[var(--success)] bg-[var(--success-lo)] text-[var(--success)]` (replace hardcoded `border-success bg-success/10 text-success`)
- [x] Reject: `border-[var(--destructive)] bg-[var(--destructive-lo)] text-[var(--destructive)]` (replace hardcoded `border-destructive bg-destructive/10 text-destructive`)
- [x] Shortlist: `border-[var(--warning)] bg-[var(--warning-lo)] text-[var(--warning)]` (replace hardcoded `border-amber-500 bg-amber-500/10 text-amber-500`)

**Circular action buttons (below card):**

- [x] Reject: `border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]` (replace hardcoded `border-destructive text-destructive`)
- [x] Shortlist: `border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning)]` (replace hardcoded `border-amber-500 text-amber-500 hover:bg-amber-500`)
- [x] Accept: `border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)]` (replace hardcoded `border-success text-success`)

---

#### UI-14c: Available crew tab

Same swipe card pattern as applicants, but for browsing available crew to invite.

**Available crew card (`available-crew-tab.tsx` ~line 232):**

- [x] Card container: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-2xl bg-background shadow-lg` — remove shadow)
- [x] Card name: `text-[15px] font-semibold tracking-[-0.3px]` (replace `text-lg font-bold`)
- [x] Detail rows: `text-[13px]`
- [x] Available days highlight: `text-[var(--success)]` (replace hardcoded `text-success` — already uses semantic token, verify it's `var()` wrapped)
- [x] Bio: `text-[13px] text-[var(--muted-foreground)]`
- [x] Cert/vessel/language badges: same treatment as applicant cards
- [x] "All roles" checkbox label: `text-[var(--muted-foreground)]`
- [x] Invitation count: `font-mono text-[11px] text-[var(--tertiary)]`

**Swipe action labels:**

- [x] Invite: `border-[var(--success)] bg-[var(--success-lo)] text-[var(--success)]` (replace hardcoded)
- [x] Pass: `border-[var(--destructive)] bg-[var(--destructive-lo)] text-[var(--destructive)]` (replace hardcoded)

**Circular action buttons:**

- [x] Pass: `border-[var(--destructive)] text-[var(--destructive)] hover:bg-[var(--destructive)]`
- [x] Invite: `border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)]`

---

#### UI-14d: Permanent review page

Different UI pattern — scrollable list, not swipe stack. But same token system.

**Header (`permanent/[id]/review/page.tsx`):**

- [x] Background: `bg-[var(--surface)]` (replace `bg-background`)
- [x] Border: `border-b border-[var(--border)]` (add explicit `border-[var(--border)]`)
- [x] Title: `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold`)
- [x] Tab system: verify uses token-based active state

**Negotiation banner (~line 201):**

- [x] `bg-[var(--warning-lo)] border-b border-[var(--warning)]/20 text-[var(--warning)]` (replace hardcoded `bg-amber-50 text-amber-800`)

**Applicant cards (~line 245):**

- [x] Card container: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-xl border bg-card p-4`)
- [x] Name: `text-[15px] font-semibold tracking-[-0.3px]` (replace `font-semibold`)
- [x] "In negotiation" badge: use `status-filling` badge variant (replace `variant="default"`)
- [x] Availability labels: replace hardcoded colors:
  - "Available immediately": `text-[var(--success)]` (replace `text-green-600`)
  - "Available after notice": `text-[var(--warning)]` (replace `text-amber-600`)
  - "Not looking": `text-[var(--muted-foreground)]` (keep)
- [x] Detail rows (experience, nationality, languages): `text-[13px] text-[var(--muted-foreground)]`
- [x] Application message: `bg-[var(--surface)] rounded-md px-2.5 py-1.5 text-xs italic text-[var(--foreground)]`
- [x] Applied date: `font-mono text-[11px] text-[var(--tertiary)]` (replace `text-xs text-muted-foreground`)
- [x] Action buttons: verify they use Button component variants (already do — `variant="outline"` for reject, default for shortlist/select)

---

#### Verify all fixes

- [x] Daywork review: applicant swipe cards match discover card anatomy — `rounded-[14px]`, no shadows, token borders
- [x] Swipe action labels use token colours — no hardcoded amber/success/destructive classes
- [x] Circular action buttons use `var()` token colours
- [x] Available crew tab matches applicant card styling
- [x] Permanent review cards: `rounded-[14px]`, token borders, no hardcoded green/amber
- [x] Negotiation banner uses warning tokens, no hardcoded amber-50
- [x] Filter panel inherits card styling
- [x] All headers use `bg-[var(--surface)]`
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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
