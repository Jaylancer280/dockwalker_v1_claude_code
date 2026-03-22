# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum, template name cap, messages test cleanup)
