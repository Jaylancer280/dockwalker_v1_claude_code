# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage UI-13: Chat & Messages Reskin

---

## Queue

### Stage UI-13: Chat & Messages Reskin

**Goal:** Apply the design system from `tasks/ui-guidance.md` to the messages list and chat pages. Same tokens, typography, card anatomy, badge system, and motion patterns proven on discover.

**Will touch:** `messages/page.tsx`, `messages/[engagementId]/page.tsx`, all `_components/` files in the chat directory.

**Will NOT touch:** API routes, migrations, types, business logic, non-messages pages.

**Pre-reskin rule:** Chat page is 1,078 lines with 26 `useState`. Must decompose before reskinning.

---

#### UI-13a: Chat page decomposition

The chat page (`messages/[engagementId]/page.tsx`) is 1,078 lines with 26 `useState`. Extract logical groups into focused sub-components in the existing `_components/` directory.

- [x] Extract **ChatHeader** component (~lines 522-726): sticky header with back link, other party name, kebab action menu (view profile, daywork actions, permanent actions, cancel). Receives `context`, `isCrew`, `isEmployer`, `isPermanent` + action callbacks
- [x] Extract **MessageList** component (~lines 728-810): scrollable message area with summary card (daywork or permanent), checklist card, system messages, user message bubbles, timestamps. Receives `messages`, `context`, `userId`, `loading` + scroll refs
- [x] Extract **ChatFooter** component (~lines 812-896): footer with banners (work-started, postponement, completion, cancellation) and message input form. Receives `context`, banner state, input state + handlers
- [x] Extract **ChatDialogs** component (~lines 939-1075): complete confirmation dialog, permanent dialogs (confirm placement, revert selection, close conversation, cancel posting). Receives dialog open states + handlers
- [x] Page.tsx reduced to: state declarations, data loading (context + messages + realtime), handler functions, and composition of the 4 extracted components + overlay conditionals
- [x] Target: page.tsx 672 lines (handlers need state access), no extracted component > 300 lines (270, 120, 145, 129)
- [x] Verify: zero behavioral change — all chat interactions work identically
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)

---

#### UI-13b: Messages list page reskin

The messages list (`messages/page.tsx`, 219 lines) is small enough to reskin directly.

**Header:**

- [x] Background: `bg-[var(--surface)]` (not `bg-background`)
- [x] Border: `border-b border-[var(--border)]`
- [x] Page title: `text-[24px] font-bold tracking-[-0.5px]` (match discover header)
- [x] Tab labels (Active/History): use `UnderlineTabs` component if not already, or match its styling

**Thread cards (conversation list items):**

- [x] Card base: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (match discover cards, replace `rounded-lg`)
- [x] Remove `hover:bg-accent` — hover is `hover:border-[var(--border-hi)]` (border-only, no bg change)
- [x] Other party name: `text-[15px] font-semibold tracking-[-0.3px]`
- [x] Role/vessel subtitle: `text-[13px] text-[var(--muted-foreground)]`
- [x] Last message preview: `text-[13px]`
- [x] Timestamp: `font-mono text-[11px] text-[var(--tertiary)]`
- [x] Unread indicator: use `--accent` token
- [x] "Action needed" badge: use `status-filling` badge variant (warning colour with pulsing dot)
- [x] "Cancelled" badge: use `status-cancelled` badge variant
- [x] History items: keep reduced opacity treatment
- [x] Entrance animation: staggered `translateY(14px) → 0`, `opacity 0 → 1`, 500ms — same pattern as discover feed

**Verify:**

- [x] Messages list looks cohesive with discover page
- [x] Both themes work
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass (856/856)

---

#### UI-13c: Chat page reskin

Apply tokens and typography to the decomposed chat page and all its sub-components.

**Chat header (new ChatHeader component):**

- [ ] Background: `bg-[var(--surface)]` (not `bg-background`)
- [ ] Border: `border-b border-[var(--border)]`
- [ ] Other party name: `text-[15px] font-semibold tracking-[-0.3px]`
- [ ] Action menu dropdown: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` — remove `shadow-lg` (no shadows in dark mode per guidance)
- [ ] Menu items: `hover:bg-[var(--accent-lo)]` (not `hover:bg-accent`)
- [ ] Destructive menu items: keep `text-destructive`

**Message bubbles:**

- [ ] Sent (own): `bg-[var(--accent)] text-white rounded-2xl rounded-br-md` (replace `bg-primary text-primary-foreground`)
- [ ] Received (other): `bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl rounded-bl-md` (replace `bg-accent text-foreground` — needs border to be visible against background)
- [ ] System messages: `bg-[var(--surface)] text-[var(--tertiary)] rounded-lg text-xs` (replace `bg-muted/60`)
- [ ] Timestamps: `font-mono text-[10px] text-[var(--tertiary)]` (replace `text-muted-foreground/60`)

**Message input:**

- [ ] Input: `rounded-full border border-[var(--border)] bg-[var(--card)] text-sm focus:ring-1 focus:ring-[var(--accent)]` (replace `bg-accent`, `focus:ring-primary`)
- [ ] Send button: keep `rounded-full`, uses default button variant (already `bg-[var(--accent)]`)
- [ ] Footer background: `bg-[var(--surface)]` (not `bg-background`)
- [ ] Footer border: `border-t border-[var(--border)]`

**Summary cards (daywork-summary-card.tsx, permanent-summary-card.tsx):**

- [ ] Card base: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-xl bg-accent/50`)
- [ ] Section title: `text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]`
- [ ] Field values: `text-[13px]`
- [ ] Rate/salary: `font-mono text-[17px] font-bold tracking-[-0.5px]`
- [ ] Rate period suffix: `text-[11px] font-medium text-[var(--muted-foreground)] opacity-60`
- [ ] Job ref: `font-mono text-[11px] text-[var(--tertiary)]`
- [ ] Icon colours: `text-[var(--muted-foreground)]` (replace raw `text-muted-foreground`)
- [ ] Permanent summary "Live aboard" badge: use `status-open` badge variant (replace hardcoded `bg-green-100 text-green-800`)

**Checklist card (checklist-card.tsx):**

- [ ] Card base: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `bg-accent/50`)
- [ ] Checkbox styling: use `--accent` for checked state
- [ ] Completed items: keep `line-through`

**Banners (banners.tsx):**

- [ ] All banner containers: `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-lg bg-accent/50`)
- [ ] Advisory boxes (crew cancel response, etc.): `rounded-lg border border-[var(--border-hi)] bg-[var(--accent-lo)]` (replace `border-primary/20 bg-primary/5`)
- [ ] Status icons: keep `text-[var(--accent)]`, `text-[var(--success)]`, `text-[var(--destructive)]`
- [ ] Banner text: `text-[13px]`
- [ ] Stars: `fill-[var(--accent)] text-[var(--accent)]` for active (replace `fill-primary text-primary`)

**Form overlays (cancel, crew-cancel, postponement, checklist, rating):**

- [ ] All overlays use `BottomSheet` — verify it already uses token-based styling from UI-0
- [ ] Form option buttons (selected): `border-[var(--accent)] bg-[var(--accent)] text-white` (replace `border-primary bg-primary text-primary-foreground`)
- [ ] Form option buttons (unselected): `border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hi)]` (replace `bg-accent hover:bg-accent/80`)
- [ ] Form text inputs: `rounded-lg border border-[var(--border)] bg-[var(--card)] focus:ring-1 focus:ring-[var(--accent)]` (replace `bg-accent focus:ring-primary`)
- [ ] Warning box in cancel-form-overlay.tsx: replace hardcoded `border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400` with `border-[var(--warning)]/30 bg-[var(--warning-lo)] text-[var(--warning)]` — remove `dark:` class
- [ ] Star rating: `fill-[var(--accent)] text-[var(--accent)]` for active, `text-[var(--tertiary)]` for inactive (replace `fill-primary text-primary`, `text-muted-foreground/30`)

**Rating summary (rating-summary.tsx):**

- [ ] Border: `border-t border-[var(--border)]`
- [ ] Labels: `text-[var(--muted-foreground)]`

**Job details unavailable fallback (chat page ~line 744):**

- [ ] `rounded-[14px] border border-[var(--border)] bg-[var(--card)]` (replace `rounded-lg bg-accent/30`)

**Verify:**

- [ ] Chat page looks cohesive with messages list and discover
- [ ] Message bubbles readable in both themes — sent stands out, received has border contrast
- [ ] Summary cards match discover card anatomy
- [ ] Banners and overlays use token colours — no hardcoded colours remain
- [ ] All banner interactions work (work-started, postponement, completion, cancellation, rating)
- [ ] All overlay forms work (cancel, crew-cancel, postponement, checklist, rating)
- [ ] Both themes work
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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
