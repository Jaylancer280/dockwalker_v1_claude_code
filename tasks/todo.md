# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 144: User testing fixes (batch 2 — UX polish)

#### 144a — Career status takes too much space on profile

Currently a full card with header, checkbox, conditional radio buttons, and number input. For most crew it's a simple toggle.

- [ ] Collapse career status into the crew info section rather than a standalone card
- [ ] When "not looking" / toggled off: show single line "Not open to permanent roles" with edit pencil
- [ ] When toggled on: show compact summary "Available immediately" or "After X days notice" with edit pencil
- [ ] Editing opens inline or small expandable — not a full card taking permanent vertical space

#### 144b — "Find daywork" button copy and size

Currently `w-full` with "Find daywork" text. Too prominent and doesn't cover permanent.

- [ ] Change copy to "Browse jobs" (covers both daywork and permanent)
- [ ] Reduce width: remove `w-full`, use `w-fit` or auto-width
- [ ] Keep the Compass icon

#### 144c — Sign out should redirect to splash page

Currently `router.push('/auth/login')` after `supabase.auth.signOut()`.

- [ ] Change redirect to `router.push('/')` — the landing/splash page
- [ ] Verify middleware doesn't intercept unauthenticated `/` and redirect back to `/auth/login`

#### 144d — Splash page copy update

Current copy is daywork-only: "Superyacht daywork, simplified". Doesn't mention permanent hiring, Docky, invitations, or checklists.

- [ ] Update hero headline to cover both modes (e.g., "Superyacht hiring, simplified" or "Your superyacht career starts here")
- [ ] Update subheading to mention both daywork and permanent
- [ ] Update value prop cards:
  - Card 1: keep daywork focus but mention permanent too
  - Card 2: mention structured hiring pipeline (shortlist → select → place)
  - Card 3: hint at smart features — "AI career advisor, crew invitations, pre-arrival checklists"
- [ ] Update how-it-works steps to be mode-neutral
- [ ] Update footer tagline

#### 144e — IMO fuzzy search auto-trigger at 4 digits

Currently requires exactly 7 digits + explicit button click. User wants auto-search after 4+ digits for better UX.

- [ ] Modify `/api/vessels/lookup` to accept 4-7 digit input: use `LIKE '{imo}%'` for partial matches (prefix search, not full fuzzy), return up to 5 results
- [ ] In add-experience page: add `useEffect` watching `imoNumber` — when length >= 4, debounce 500ms then auto-call lookup
- [ ] Show results as a selectable dropdown list below the input (multiple matches possible with partial IMO)
- [ ] Keep the Search button as a manual fallback but make it enabled at 4+ digits
- [ ] Same change on edit-experience page
- [ ] Update vessel lookup tests for partial match behavior

---

### Stage 145: Web vs mobile layout optimization (separate track)

This is a larger UX workstream. Needs design direction from user before implementation.

- [ ] **Planning needed:** Which pages need web-specific layouts? (discover, profile, post form, review, chat, settings, billing)
- [ ] **Pattern decision:** responsive breakpoints (Tailwind `md:` / `lg:`) vs separate layout components?
- [ ] **Priority pages for web billing flow:** billing/page.tsx and settings (since Apple payment avoidance is the driver)
- [ ] **Max-width container:** add `max-w-lg mx-auto` or similar wrapper to prevent full-width stretch on desktop
- [ ] **Navigation:** bottom nav works on mobile but may need sidebar or top nav on desktop

> Defer detailed implementation until user provides specific layout preferences or screenshots.

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Resilience Tests

Component tests that verify UI recovery from network failures. safeFetch migration (141a) gives correct behavior by construction; these tests prove it.

- [ ] Discover page: mock safeFetch to return `{ ok: false }` on loadCards → verify: no spinner stuck, error state shown
- [ ] Chat page: mock safeFetch to return `{ ok: false }` on loadMessages → verify: no spinner stuck, polling still sets up
- [ ] Apply action: mock safeFetch to return `{ ok: false }` → verify: toast shown, applying state clears
- [ ] Post form: mock safeFetch to return `{ ok: false }` on submit → verify: toast shown, submitting state clears
- [ ] Availability overlay close → network fail → verify: no unhandled rejection, cached state preserved

### Component Tests for Permanent UI

Zero component tests exist for permanent job pages (cards, feed, review, mine, post form). API tests cover the critical paths but rendering regressions are only caught manually.

- [ ] PermanentJobCard: renders salary (exact vs range), "ASAP" for past dates, cert list, disabled apply when missing certs
- [ ] PermanentJobFeed: filter panel renders, empty state, pagination trigger
- [ ] PermanentPostForm: required field validation, salary preview, template load/save
- [ ] PermanentReviewPage: tab switching, shortlist cap indicator, negotiation banner
- [ ] PermanentApplicationCard: status labels (Under review / Shortlisted / Selected / Position filled), withdraw button visibility

### Push-Triggers Further Decomposition

If a third domain is added (e.g., `CONTRACT.*`), decompose `daywork-handlers.ts` (320 lines) further. Currently manageable but approaching the threshold.

### Onboarding True Atomicity

The re-entrant retry fix handles the failure case, but `onboard_person` + vessel/experience batch are still two DB calls. A single Postgres RPC wrapping the full onboarding flow would make it truly atomic. Build when onboarding failures appear in real data.

### App Feature Guide

On-signup slideshow/overlay showing screenshotted features. General UX, not permanent-specific. Build before promoting to experienced crew.

### Negotiation Timeout

Auto-revert selection after N days of no activity. Build when ghosted selections become a pattern in real data.

### Weekly Check-In Cron (Permanent)

Nudge employers with active permanent engagements that have no activity. Build when abandoned permanent engagements appear in real data.

---

## Done

(See git history for completed stages 51-139, 141a, 142, 143, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e, template name cap, messages test cleanup)
