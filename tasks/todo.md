# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### CRITICAL: Password reset broken + Account deletion incomplete

**Done condition:** Password reset flow works end-to-end. Deleted users cannot sign in. Test users can be fully removed via admin RPC.

#### Password reset fix

- [x] Update `/auth/callback/route.ts` — handle both `code` (PKCE) and `token_hash`+`type` (fallback) flows
- [x] Update `/auth/reset-password/page.tsx` — use `onAuthStateChange` to detect `PASSWORD_RECOVERY` event instead of relying solely on `getSession()`
- [x] Update login page — show clear message for banned/deactivated users instead of raw Supabase error

#### Account deletion hardening

- [x] Make ban failure a hard error in `/api/account/deactivate/route.ts` — if ban fails, return 500 (not silent success)
- [x] Fix middleware — check deactivated on `/onboarding` path too (currently skipped, creates redirect loop)

#### Admin user cleanup (FK constraint fix)

- [x] Add migration with `admin_delete_person(target_id)` RPC — deletes all child rows in FK order, then persons row
- [x] Add rollback for the migration
- [x] Update tests for deactivate route (ban failure = 500)
- [x] Update tests for callback route (token_hash flow)
- [x] Verify type-check + lint pass

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

- [ ] Create Stripe products (Crew Pro 4.99, Employer Pro 14.99). Set up webhook. Set 4 Vercel env vars.

### WhatsApp setup

- [ ] Request Twilio WhatsApp sender access (2-4 weeks — START NOW)
- [ ] Submit templates, set env vars, sign DPA

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
