# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix UI-15b: Date inputs still overlapping

---

## Queue

### Fix UI-15b: Date inputs still overlapping

The previous fix (`grid-cols-1 sm:grid-cols-2`) doesn't work because the Capacitor webview on phones reports a viewport ≥640px, so `sm:grid-cols-2` activates — but the `max-w-lg` (512px) container can't fit two native date inputs side-by-side.

- [x] `experience-details-section.tsx` line 116: change `grid grid-cols-1 gap-3 sm:grid-cols-2` to just `grid grid-cols-1 gap-3` — always stack date inputs vertically. Two date pickers never fit cleanly in a 512px-max container on any device.
- [x] Verify on phone (or 390px viewport): start and end date inputs stack with no overlap

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
