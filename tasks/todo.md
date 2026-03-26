# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

(empty)

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Permanent crew withdrawal auto-revert — employer should decide

When crew withdraws after being selected for a permanent role, `apply_projection` automatically sets the posting back to `active`. The employer gets no notification, no prompt, no choice. Needs: migration, API route, UI banner, context API, tests. Full spec preserved in git history.

### Billing IAP bypass redesign

4-phase project: in-app billing page, email-to-web magic link, web purchase page, old flow cleanup. Full spec preserved in git history.

### Deactivated user server-side sign-out

Needs admin client to revoke auth session after deactivation. 403 guard already in place.

### OG social sharing image

Create 1200x630px branded image at `apps/web/public/images/brand/og-image.png`. Code already references it.

### Agent market as discover mode

Merge `/discover/market` into the main discover page as an agent-specific mode.

### Resilience Tests

Discover, Chat, Apply, Post form, Availability overlay error handling tests.

### Component Tests for Permanent UI

PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard.

### Component Tests for Form Pickers

LocationPicker, RolePicker, FlagStatePicker, AvailabilityOverlay, ProfileOverlay, ImageCropper.

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

Add RFC 2369 `List-Unsubscribe` header to all outgoing emails for better deliverability.

### Form validation — styled inline errors (SUG-012)

Replace browser-native validation with styled inline errors matching the design system.

### Invalid URL error pages (SUG-013)

Review page and vessel edit page should show "not found" instead of generic API error when given non-existent IDs.

### Edit experience "Unknown vessel" prefix (SUG-017 secondary)

After vessels RLS fix resolves the name lookup, verify the vessel_type prefix (M/Y vs S/Y) is correct. Currently defaults to M/Y.

---

## Done

(See git history for completed stages 51-152, UI-0 through UI-19, availability-model-overhaul, cron-trigger-fix, all fix batches, template name cap, messages test cleanup, pre-TestFlight native changes, workflow protocol, Playwright baseline, pre-TestFlight fix batch, rollback + test fixes)
