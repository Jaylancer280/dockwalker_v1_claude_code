# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### BUG: Permanent withdrawal has no rating path

**Root cause:** `PERMANENT.WITHDRAWN` sets engagement status to `'closed'` (migration 00059 line 697), but `canRate` in `page.tsx` line 528-532 only checks for `'completed'` and `'cancelled'`. Daywork cancellations use `'cancelled'` status which IS ratable — permanent withdrawals use `'closed'` which is NOT.

- [ ] Decide: should `'closed'` engagements with outcome `'withdrew'` be ratable? If yes:
  - Add `(context?.status === 'closed' && context.outcome === 'withdrew' && !context.has_rated)` to `canRate` in `page.tsx`
  - Add a banner for closed-with-withdrawal in `chat-footer.tsx` (like CancellationBanner but simpler)
  - Verify the rating API (`/api/engagements/[id]/rate`) accepts `'closed'` status — currently only allows `'completed'` and `'cancelled'`

### BUG: DateInput transparent overlay may block interaction on some devices

**Symptom:** Permanent post form start date reported as "unclickable." Same `DateInput` component used by daywork (which works).

**Possible cause:** The `opacity-0` native date input now sits on top and captures taps, but on some Android browsers/webviews the native picker doesn't open from a transparent input — the tap is absorbed silently.

- [ ] Test on the same device after deployment lands — may already be fixed
- [ ] If still broken: add explicit calendar icon button next to the date input that calls `showPicker()` on tap (visual affordance + programmatic trigger)
- [ ] Alternative: reverse stacking — put text input on top (for typing), keep native input behind with `pointer-events-none`, and rely solely on `showPicker()` with a fallback message "type date manually"

---

## BLOCKED — user action required

### Stripe setup

- [x] Test mode: products, prices, test webhook (`https://www.dockwalker.io/api/webhooks/stripe`), and test env vars all configured. Full checkout → webhook → DB upsert → Crew Pro entitlement unlock verified end-to-end against real Vercel deployment.
- [ ] Live mode go-live: (1) toggle Stripe Workbench to live mode, (2) recreate Crew Pro + Employer Pro products + prices, (3) point the existing live webhook at `https://www.dockwalker.io/api/webhooks/stripe` (the live one was created against the apex and will 307), (4) swap `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREW_PRO`, `STRIPE_PRICE_EMPLOYER_PRO` in Vercel Production env vars for live values, (5) redeploy.
- [ ] Set `NEXT_PUBLIC_APP_URL=https://www.dockwalker.io` in Vercel Production env vars (currently falls back to `http://localhost:3000` — checkout still works because the apex-to-www redirect absorbs the broken URL, but it's one extra hop and masks future bugs).

### WhatsApp setup

- [ ] Get dedicated number (prepaid SIM or Google Voice for Workspace)
- [ ] Register with Meta Cloud API directly (not Twilio)
- [ ] Swap Twilio dispatcher for Meta Graph API calls
- [ ] Submit templates for Meta approval

### User testing

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
