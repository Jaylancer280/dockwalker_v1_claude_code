# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Quick fix: Card background image — lighter overlay + responsive sizing

**Context:** The department background image on job cards is way too dark (85% black at bottom). Needs to be significantly lighter and more frosted — the image should be noticeable as a background, not buried under a dark wall. Also the image `sizes` hint is hardcoded to `400px` which won't scale when we make the layout responsive.

**Files:**

- `apps/web/src/app/(app)/discover/_components/daywork-card.tsx`
- `apps/web/src/app/(app)/discover/_components/permanent-job-card.tsx`

**Checklist:**

- [x] Lighten the gradient overlay on both cards. Change `from-black/85 via-black/65 to-black/45` to `from-black/50 via-black/30 to-black/15` + `drop-shadow-sm` on text container
- [x] Add `backdrop-blur-sm` to the overlay div for a frosted glass effect instead of pure darkness
- [x] Update the `sizes` attribute on the Image to be responsive: `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"`
- [x] Apply same changes to both daywork and permanent card components
- [ ] Visually verify: the department photo should be clearly recognisable behind the text, not just a dark tint

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **OG social sharing image** — see `tasks/founder-drafts.md` § 7.
- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.

---

## Done

(See git history for completed stages 51-176. Mobile Phases 1-6 complete + UI primitives. EAS config stage 173. Vercel build fix. Stage 174: hat switcher copy, full-bleed cards, header toggle, JWT claims, batch vessel lookup, favicon. Stage 175: LookupsProvider, middleware header dedup, parallel fetches. Stage 176: NotificationCountsProvider.)
