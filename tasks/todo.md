# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

(empty — pick from Backlog or start new work)

---

## BLOCKED — user action required

### Stripe setup

- [ ] Create Stripe products (Crew Pro 4.99, Employer Pro 14.99). Set up webhook. Set 4 Vercel env vars.

### WhatsApp setup

- [ ] Request Twilio WhatsApp sender access (2-4 weeks — START NOW)
- [ ] Submit templates, set env vars, sign DPA

### User testing

- [ ] Verify agent My Jobs — post job as agent, check My Jobs.

### Voice calling Session 3 — Browser testing (manual)

- [ ] Chrome desktop + Android
- [ ] Firefox
- [ ] Safari macOS + iOS
- [ ] Glare resolution, network drop, background tab, multi-tab, offline user, busy signal, hangup during navigation

### Visual verification (manual)

- [ ] Cards show visible department tint with per-card angle variation
- [ ] Cards look consistent across discover, market, and messages
- [ ] Skeleton dimensions match real content (no layout shift)
- [ ] Discover page works with size band filter applied server-side
- [ ] Confirm 8 fewer lookups queries on warm page load
- [ ] Add `aria-label` to icon-only buttons (audit chat-header.tsx, bottom-nav.tsx)

### Rate limiting local test (manual)

- [ ] Test locally: >100 requests to `/api/health` in 60s (should pass, exempted). >100 requests to `/api/profile` (should 429 if Redis configured, pass-through if not). >30 POST requests to `/api/daywork` in 60s (should 429 on write limit).

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012). (Partially addressed by P1-A inline validation.)
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.
- **Admin identity type change** — deferred, medium-high effort, admin-only.
- **Chat page server-rendering** — stream context/messages server-side instead of client-side spinners.
- **Scroll position restoration** — restore scroll on back navigation from detail views.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — needs Xcode debugger.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7.
- **Mobile OTA update test**.
