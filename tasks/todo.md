# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Admin Launch Dashboard — Phase 2: Dashboard UI

**Spec:** `tasks/admin-launch-dashboard.md`
**Isolation:** Zero contamination to existing app. See spec §Isolation Decisions.

#### Phase 0 — Fix admin auth (code-only)

- [x] Rewrite `apps/web/src/lib/auth/require-admin.ts` — DB-check `is_admin` instead of trusting fast path
- [x] Add proxy guard in `apps/web/src/lib/supabase/middleware.ts` — redirect non-admins from `/admin/*`
- [x] Tests: admin routes 200 for admin, 403 for non-admin (existing 17 tests pass)

#### Phase 1 — Blocking + user deletion fix

**Migration:**

- [x] Write migration 00097: `blocked_at` + `last_event_at` columns, `cancelled_by` CHECK, 4 new handlers, `last_event_at` write, backfill (63 handlers total)
- [x] Write rollback (59 handlers, self-contained)
- [x] `npx supabase db push` — applied successfully

**Blocking enforcement (isolated):**

- [x] Create `lib/auth/check-not-blocked.ts` — standalone blocked check guard
- [x] Add blocked user redirect in `middleware.ts` (DB query, no-op for existing users)
- [x] Create `/blocked` page (static, email fallback)

**API routes:**

- [x] `POST /api/admin/users/:personId/block` — cascade via `appendEvents`
- [x] `POST /api/admin/users/:personId/unblock` — emit `ADMIN.USER_UNBLOCKED`
- [x] Replace `DELETE /api/admin/users/:personId` — scrub + ban instead of hard-delete
- [x] Add 4 new event types to `packages/types/src/events.ts`

**Tests (1029 total, +10 new):**

- [x] Block: 403 non-admin, 400 self-block, 400 admin-on-admin, 400 invalid category, 400 already blocked, 200 happy path
- [x] Unblock: 403 non-admin, 400 missing reason, 400 not blocked, 200 happy path
- [x] Delete: 403 non-admin, 400 self-delete, 404 missing, 400 admin target, 200 scrub+ban, 500 ban failure

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
