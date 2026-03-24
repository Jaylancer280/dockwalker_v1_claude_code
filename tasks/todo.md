# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

> No pending stages. All planned work through Stage 151 is complete.

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Resilience Tests

- [ ] Discover page: mock safeFetch error → no spinner stuck
- [ ] Chat page: mock safeFetch error → polling still sets up
- [ ] Apply action: mock error → toast shown, state clears
- [ ] Post form: mock error → toast shown, state clears
- [ ] Availability overlay: network fail → no unhandled rejection

### Component Tests for Permanent UI

- [ ] PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard

### Push-Triggers Further Decomposition

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

---
