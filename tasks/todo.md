# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-17: Remaining Pages Reskin

---

## Queue

### Stage UI-17: Remaining Pages Reskin

**Goal:** Apply the design system to every remaining page: settings, billing, vessels, notifications, docky, onboarding, auth, landing. After this stage, no page in the app uses the old style.

**Will touch:** `settings/`, `billing/`, `vessels/`, `notifications/`, `docky/`, `onboarding/`, `(auth)/`, landing `page.tsx`, `discover/market/`.

**Will NOT touch:** API routes, migrations, types, business logic, pages already reskinned (discover, messages, chat, review, profile, mine, post).

---

#### UI-17a: Settings page + sections

**Settings page (`settings/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`, title `text-[24px] font-bold tracking-[-0.5px]` (replace `text-lg font-bold tracking-tight`)

**Account section (`account-section.tsx`):**

- [x] Card containers: verify `rounded-[14px]` (replace any `rounded-xl`)

**Appearance section (`appearance-section.tsx`):**

- [x] Theme toggle selected: `bg-[var(--accent)] text-white` (verify `text-white` is intentional — white on accent is correct)
- [x] Card container: `rounded-[14px]` (replace `rounded-xl`)

**Notifications section (`notifications-section.tsx`):**

- [x] Toggle switch track: `bg-[var(--accent)]` when on, `bg-[var(--border)]` when off (replace `bg-primary` / `bg-muted`)
- [x] Toggle switch thumb: `bg-white` is fine — standard switch pattern
- [x] Card container: `rounded-[14px]` (replace `rounded-xl`)

**Danger zone section (`danger-zone-section.tsx`):**

- [x] Alert box: `bg-[var(--destructive-lo)]` (replace `bg-destructive/10`)
- [x] Card containers: `rounded-[14px]` (replace `rounded-xl`)

---

#### UI-17b: Billing + Vessels + Notifications pages

**Billing page — SKIP.** Billing flow is being redesigned (Apple IAP bypass via email-to-web). Do not reskin the current page.

**Vessels page (`vessels/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`, title `text-[24px] font-bold tracking-[-0.5px]`
- [x] Vessel cards: verify `<Card>` component used (inherits `rounded-[14px]`)
- [x] Vessel type badge, LOA, size band: `text-[13px]`

**Vessel edit page (`vessels/[id]/edit/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`
- [x] Back link: `text-[var(--muted-foreground)]`

**Notifications page (`notifications/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`, title `text-[24px] font-bold tracking-[-0.5px]`
- [x] Notification cards: verify token borders/backgrounds
- [x] Timestamps: `font-mono text-[11px] text-[var(--tertiary)]`
- [x] Unread indicator: `bg-[var(--accent)]`

---

#### UI-17c: Docky pages

**Docky list page (`docky/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`, title `text-[24px] font-bold tracking-[-0.5px]`
- [x] Conversation cards: `rounded-[14px]` (replace `rounded-xl`)
- [x] Timestamps: `font-mono text-[11px] text-[var(--tertiary)]`

**Docky conversation page (`docky/[conversationId]/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`
- [x] User message bubble: `bg-[var(--accent)] text-white` (replace `bg-primary text-primary-foreground`)
- [x] Assistant message bubble: `bg-[var(--card)] border border-[var(--border)]` (replace `bg-muted`)
- [x] Message input: `bg-[var(--card)] border border-[var(--border)] focus:ring-[var(--accent)]` (replace `bg-muted`)
- [x] Footer: `bg-[var(--surface)] border-t border-[var(--border)]`
- [x] Suggestion chips: verify token-based styling

---

#### UI-17d: Agent market feed

**Market page (`discover/market/page.tsx`):**

- [x] Header: `bg-[var(--surface)]`, title `text-[24px] font-bold tracking-[-0.5px]`
- [x] Job cards: verify same card anatomy as discover feed (should mostly inherit)
- [x] Filter panel: verify token-based

---

#### UI-17e: Onboarding

**All step files (`onboarding/_steps/`):**

- [x] Choice card buttons: `rounded-[14px]` (replace `rounded-xl` across welcome, hat-selection, identity, experience-fork)
- [x] Hat selection: replace `bg-sea`, `bg-navy-light` with `bg-[var(--accent-lo)]` or appropriate token
- [x] Experience fork: replace `bg-success` choice button with `bg-[var(--success-lo)]`, `bg-sea` with `bg-[var(--accent-lo)]`
- [x] Profile step: all `rounded-xl` containers → `rounded-[14px]`
- [x] Vessel experience step: experience card `rounded-[14px]`
- [x] Step titles: keep `text-xl font-bold` — these are step headings inside a flow, not page titles

---

#### UI-17f: Auth pages + landing page

**Auth pages (login, signup, forgot-password, reset-password):**

- [x] All use `<Card>` component which already has `rounded-[14px]` — verify no overrides
- [x] Page titles: keep `text-xl font-bold` — auth forms are focused, not full pages
- [x] Main container backgrounds: verify `bg-background` (correct for full-page auth layouts)

**Landing page (`app/page.tsx`):**

- [x] Feature icons: replace `bg-sea/10 text-sea`, `bg-teal/10 text-teal`, `bg-navy/10 text-navy` with design token colours (`bg-[var(--accent-lo)] text-[var(--accent)]` or similar)
- [x] CTA buttons: verify use Button component variants
- [x] Hero section: verify no hardcoded colours

---

#### Verify all fixes

- [x] Every page header in the app uses `bg-[var(--surface)]` (except auth/landing which are full-page layouts)
- [x] No `rounded-xl` remaining on cards/containers (all `rounded-[14px]`)
- [x] No hardcoded green, amber, emerald colours anywhere (billing page excluded — being redesigned)
- [x] No `dark:` variant classes anywhere in the codebase (token system handles both themes)
- [x] Docky message bubbles match chat page pattern
- [x] Settings toggles use token colours
- [x] Onboarding choice cards use `rounded-[14px]` + token backgrounds
- [x] Both themes work across all pages
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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, UI-16, Fix-z-index, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
