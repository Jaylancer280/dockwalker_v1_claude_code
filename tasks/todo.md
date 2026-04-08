# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 201 — Post-audit remediation

---

## Queue

### Stage 201 — Post-audit remediation (from Stage 200 audit)

#### CRITICAL — Mission violation

- [x] **Remove positions-filled from crew views.** In `discover/_components/daywork-card.tsx:138-148`, replace `"{remaining}/{available} open"` with `"{available} positions"` (or `"Multiple positions"` when >1). Keep `"Last position!"` since it only reveals 1 remaining, not how many were filled.
- [x] **Remove positions-filled from applied tab.** In `discover/_components/applied-tab.tsx:250-253`, remove the `{positions_available - positions_filled}/{positions_available} open` badge entirely — crew viewing their applied jobs should not see fill counts.

#### HIGH — Bug fixes

- [x] **Add RPC error handling in discover route.** In `api/daywork/discover/route.ts:151`, destructure `error` from `get_vessels_public_batch` RPC and return 500 on failure. Same for profiles query at line 164.
- [x] **Complete form submit validation.** In `daywork/post/page.tsx:404-414`, add checks for `roleId`, `locationPortId`, `startDate`, `endDate`, and `dayRate` before showing the confirmation dialog. Set field-level error state for each missing field.
- [x] **Remove dead `vessel_id` from template application.** In `daywork/post/page.tsx:264`, delete `setVesselId(t.vessel_id ?? '');` — column was dropped in migration 00034.

#### MEDIUM — Code quality

- [x] **Adopt or remove SearchableSelect.** `components/ui/searchable-select.tsx` is imported nowhere. Either wire it into profile-edit-form or daywork-post-form dropdowns that would benefit from search, OR delete the file. If adopting, add ARIA attributes: `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"` on the panel, `role="option"` + `aria-selected` on each option.
- [x] **Add `aria-required="true"` to required form inputs.** In daywork post page, add the HTML `required` attribute and `aria-required="true"` to all inputs with `*` indicators (vessel, role, port, start date, end date, day rate).
- [x] **Add `beforeunload` flush for auto-save draft.** In `daywork/post/page.tsx`, add a `useEffect` that listens for `beforeunload` and immediately writes the current form state to `sessionStorage` — prevents data loss if tab closes within the 500ms debounce window.
- [x] **Add double-submit guard to onboarding.** In `onboarding/page.tsx`, add `submittingRef` pattern matching `daywork/post/page.tsx:416-420`.
- [x] **Strengthen combined filters test.** In `__tests__/api/daywork-discover.test.ts:351-382`, add assertions that each of the 7 filters was actually applied (assert on `filterProxy.eq`, `.contains`, `.gte`, `.lte` calls), not just the final result shape.

### Visual verification (manual)

- [ ] Cards show visible department tint with per-card angle variation
- [ ] Cards look consistent across discover, market, and messages
- [ ] Skeleton dimensions match real content (no layout shift)
- [ ] Discover page works with size band filter applied server-side
- [ ] Confirm 8 fewer lookups queries on warm page load
- [ ] Add `aria-label` to icon-only buttons (audit chat-header.tsx, bottom-nav.tsx)

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
- **Mobile Docky hooks/screens** — update for single-thread API.

---

## Done

(See git history for completed stages 51-200+. Recent: Stage 200 UX+perf polish batch — Safari UUID polyfill, card gradient fix, form asterisks+auto-save+validation, SearchableSelect, loading skeletons, empty state CTAs, safeFetch error differentiation, card padding/token normalization, 44px tap targets, status badge icons, lookups cache skip, discover size band DB pre-filter, cleanup.)
