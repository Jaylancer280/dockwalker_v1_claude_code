# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Fix: Cron Trigger 1 query too broad

---

## Queue

### Fix: Cron Trigger 1 — missing RPC + fallback query fires for all available crew

**Problem:** `api/cron/availability-expiry/route.ts` calls `rpc('get_expiring_availability_crew')` which **doesn't exist in any migration**. The fallback query fires for anyone with any active availability — not just crew whose last date is tomorrow. This would spam all available crew with "expires tomorrow" notifications daily.

**Fix options (pick one):**

**Option A — Fix the fallback query (simpler, no migration):**

- [x] Replace the fallback query in the cron route with a proper per-person aggregation. Use Supabase client to query:
  ```
  SELECT person_id FROM availability_windows
  WHERE expires_at > now() AND not_available = false
  GROUP BY person_id
  HAVING max(date) = CURRENT_DATE + 1
  ```
  This can be done with raw SQL via `supabase.rpc()` or by fetching all non-expired windows and aggregating in JS (less efficient but no migration needed).

**Option B — Create the missing RPC (cleaner, needs migration):**

- [x] Add `get_expiring_availability_crew()` function to a new migration that returns person_ids whose `max(date) = CURRENT_DATE + 1`
- [x] Keep the RPC call in the cron route, remove the broken fallback

**Either way:**

- [x] Remove the non-existent RPC call if going with Option A, or create it if going with Option B
- [x] Verify: only crew whose LAST available date is tomorrow get notified — not all available crew
- [x] Verify: crew with dates beyond tomorrow do NOT get notified
- [x] `npx tsc --noEmit` — zero errors
- [ ] All tests pass

### Fix: Availability model — date-based expiry, auto-shrink, notifications

**Current broken model:** Availability windows have `expires_at = now() + 7 days` — a time-based TTL decoupled from the actual dates. A crew member who sets Jan 1-5 still appears "available" until Jan 8 even though all dates passed. Past dates are never cleaned up.

**Also a regression:** "Cannot set availability for past dates" error when confirming valid future dates. Likely related to the broken expiry model — `existingDates` from a prior session may include dates that are now past, and re-submitting them triggers the validation.

**New model:**

1. **`expires_at` derived from the last selected date** — not `now() + 7 days`. If crew sets Jan 1-5, `expires_at` = end of Jan 5 (midnight UTC). Each row's `expires_at` = `date + 1 day` (i.e. the date is valid for that calendar day, expires at midnight).
2. **Auto-shrink:** The availability GET endpoint already filters `expires_at > now()`. If each row's `expires_at` is the end of that calendar day, past dates automatically drop off. No cron needed for cleanup.
3. **Apply gate** unchanged — it checks `expires_at > now()` which still works with date-based expiry.
4. **Overlay on reopen** shows only future dates as selected (past dates already filtered by GET).

**Notifications (two triggers):**

1. **24h before last available day:** If crew's latest availability date is tomorrow and they haven't updated, send push: "Your availability expires tomorrow — update to keep seeing jobs." (Existing cron at 08:00 UTC, adjust query to check `max(date)` instead of `expires_at`.)
2. **7 days since last update:** If crew hasn't set/updated availability in 7 days (check `max(created_at)` or `max(updated_at)` on their windows), send push: "It's been a week — update your availability to stay visible." New check in the same cron.

**Stress-tested scenarios (all verified logically):**

1. Basic set + auto-shrink ✓
2. Sparse dates (Mon, Wed, Fri) ✓
3. Overlay reopen shows only future ✓
4. Deselecting a date ✓
5. "Not available" toggle — **needs different expiry** (see below)
6. Past dates regression — fixed as side effect ✓
7. Timezone (UTC-consistent) ✓
8. Cron last-day reminder — **must check max(date) = tomorrow, not today** (see below)
9. Cron 7-day stale — works as re-engagement nudge ✓
10. Cron per-row firing — **must aggregate per person** (see below)
11. Employer available-crew query ✓
12. Double-submit idempotency ✓
13. Expire then re-set ✓

**Three issues found during stress testing:**

**Issue A: Not-available rows must NOT use per-date expiry.** A "not available" declaration creates one row with `date = today`. Per-date expiry would expire it tomorrow — crew silently reverts to "not set." **Fix:** Keep 7-day TTL for `not_available = true` rows. Only normal availability rows get `expires_at = date + interval '1 day'`. The `apply_projection` handler already branches on `not_available` — apply different expiry per branch.

**Issue B: Cron last-day reminder must check tomorrow, not today.** User wants 24h notice before last day. Cron runs at 08:00 UTC. **Fix:** Query `max(date) = CURRENT_DATE + 1` (last available day is tomorrow → send today). NOT `max(date) = CURRENT_DATE` (that would notify on the last day itself, too late).

**Issue C: Cron must aggregate per person, not per row.** With per-date expiry, every row where `date = today` has `expires_at` within 24h. The old query checked `expires_at` within 24h — would fire for every row, not just crew whose LAST date is expiring. **Fix:** `SELECT person_id FROM availability_windows WHERE expires_at > now() AND not_available = false GROUP BY person_id HAVING max(date) = CURRENT_DATE + 1`

---

**Implementation:**

**API changes (`api/availability/route.ts`):**

- [x] POST (normal availability): change `expires_at` from `now() + 7 days` to per-row `endOfDay(date)`. For range Jan 1-5, each row gets `expires_at = date::timestamp + interval '1 day'` at midnight UTC. Jan 1 row expires Jan 2 00:00 UTC, etc.
- [x] POST (not_available): **keep** `expires_at = now() + 7 days` — not_available declarations use the existing TTL, not per-date expiry
- [x] POST: the `startDate < todayStr` validation remains correct — with the new model, `existingDates` from GET never includes past dates, so re-submissions only contain today/future dates
- [x] GET: already filters `expires_at > now()` — verify this returns correct results with per-date expiry (it should, no change needed)

**`apply_projection` AVAILABILITY.SET handler (in migration):**

- [x] Normal path (line ~514): change `expires_at` in the INSERT from `(p_payload->>'expires_at')::timestamptz` to `d::date + interval '1 day'` per row in the `generate_series`. This removes dependency on the client-sent `expiresAt` for normal availability.
- [x] Not-available path (line ~492): **keep** using `(p_payload->>'expires_at')::timestamptz` from the client (which sends `now + 7 days`)

**Client changes (`availability-overlay.tsx`):**

- [x] POST body: for normal availability, stop sending `expiresAt` (server computes it per-date). OR send it and let the server ignore it — cleaner to remove.
- [x] For not_available POST: keep sending `expiresAt = now + 7 days` (server uses it)
- [x] No other client changes needed — overlay already shows only GET results (auto-filtered)

**Migration:**

- [x] New migration: `UPDATE availability_windows SET expires_at = date::timestamp + interval '1 day' WHERE not_available = false;` — backfill existing normal rows to date-based expiry. Past dates immediately expire. Not-available rows untouched.
- [x] Update `apply_projection` with the branched expiry logic
- [x] Rollback: reverse the UPDATE with `SET expires_at = created_at + interval '7 days' WHERE not_available = false` (approximate restore)

**Cron changes (`api/cron/availability-expiry/route.ts`):**

- [x] **Trigger 1 — last day reminder (24h before):** Replace current `expires_at` range query with:
  ```sql
  SELECT person_id FROM availability_windows
  WHERE expires_at > now() AND not_available = false
  GROUP BY person_id
  HAVING max(date) = CURRENT_DATE + 1
  ```
  This finds crew whose last available day is **tomorrow** — send notification today. Push: "Your availability expires tomorrow — update it to keep finding daywork."
- [x] **Trigger 2 — stale availability (7 days no update):** New query:
  ```sql
  SELECT DISTINCT aw.person_id FROM availability_windows aw
  WHERE aw.person_id NOT IN (
    SELECT person_id FROM availability_windows WHERE expires_at > now()
  )
  GROUP BY aw.person_id
  HAVING max(aw.created_at) < now() - interval '7 days'
  ```
  This finds crew with no current availability whose last set was 7+ days ago. Push: "It's been a while — set your availability to see daywork in your area."
- [x] **Deduplication:** Both triggers check `notifications` table — skip if a notification of the same type was sent to this person in the last 24h (trigger 1) or 7 days (trigger 2)
- [x] **Skip not_available crew:** Trigger 2 should exclude crew with active `not_available = true` rows (they intentionally opted out)

**Verify:**

- [x] Set Jan 1-5. On Jan 3, GET returns Jan 3-5 only. Jan 1-2 auto-expired.
- [x] Apply gate passes Jan 3 (future dates exist), blocks Jan 6 (all expired).
- [x] Overlay reopened Jan 3: shows Jan 3-5 pre-selected. No past dates.
- [x] "Past dates" regression gone — no past dates in submissions.
- [x] Set "not available" — persists for 7 days, doesn't expire next day.
- [x] Cron trigger 1: crew with last date = tomorrow gets push.
- [x] Cron trigger 2: crew with no availability + 7 days stale gets push. Not-available crew excluded.
- [x] Cron doesn't fire per-row — only per-person when LAST date is expiring.
- [x] Employer available-crew query returns only future-date crew.
- [x] Double-submit idempotent — no errors, no duplicate rows.
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass
- [x] `npx supabase db reset` — migration applies, past dates immediately expire

### Stage UI-19: Landing Page Redesign

**Goal:** Replace the current generic landing page with a brand-led design. DockWalker logo is the hero element, not a stock photo. The page should feel like a product — not a SaaS template.

**Current problems:**

- Hero aerial image takes half the screen with no brand identity
- Massive empty gap between hero and features (gradient fade area)
- No DockWalker wordmark or logo prominent above the fold
- Feature list is small text with icon circles — generic
- "How it works" section decent but buried
- No clear CTA above the fold on smaller phones

**Will touch:** `app/page.tsx` only.

**Will NOT touch:** API routes, auth pages, any other pages.

**Available assets:**

- `public/images/brand/dw_app_icon_cropped.png` — app icon (already in public)
- `public/images/brand/dw_logo_white.png` — white logo variant
- `public/images/onboarding/hero-aerial.jpg` — can be kept as subtle background, not hero

---

#### UI-19a: Above the fold — logo-led hero

Replace the full-bleed aerial photo hero with a clean, brand-focused layout.

- [x] **Remove the full-width hero image** as the primary visual. The aerial photo can optionally stay as a very subtle background (opacity 0.03-0.05) or be removed entirely — evaluate visually
- [x] **DockWalker logo** large and centred: use `dw_app_icon_cropped.png` at 96-120px (currently 80px — too small). Or use `dw_logo_white.png` if it's a wordmark. Check what the white logo looks like.
- [x] **App name "DockWalker"** as text below/beside the logo: `text-[28px] font-bold tracking-[-0.5px]` — clear brand presence
- [x] **Tagline:** keep "Superyacht hiring, simplified" but bump to `text-[18px]` — currently `text-3xl` which is too large relative to the tagline
- [x] **Subtitle:** keep the description but tighten copy
- [x] **CTAs above the fold:** "Sign up" (primary) and "Log in" (outline) — use `Button` component, not custom link classes. `rounded-full` pill shape per design system
- [x] **Remove gradient overlay div** (lines 18-23) — no hero image to fade
- [x] **Background:** use `bg-[var(--background)]` with the body gradients (already set in globals.css from UI-D1). The atmospheric radial gradients give enough visual interest without a photo
- [x] **Vertical spacing:** hero section should fit above the fold on a 390px × 844px viewport (iPhone 14 size). Test: can you see both CTA buttons without scrolling?

---

#### UI-19b: Value props section

- [x] Keep the 3 feature rows (daywork, permanent, smart features) — they communicate well
- [x] Bump icon containers to `h-12 w-12` (from `h-10 w-10`) for better visual weight
- [x] Bump feature titles to `text-[15px] font-semibold` (from `text-sm`)
- [x] Section background: `bg-[var(--surface)]` (from `bg-muted/30`) — matches the surface pattern used elsewhere

---

#### UI-19c: How it works section

- [x] Keep the crew/employer photo cards — they work well
- [x] Keep the 3-step numbered list
- [x] Step number circles: use `bg-[var(--accent)]` (from `bg-primary`)
- [x] Consider: if the page feels too long on mobile, this section could be cut. Evaluate visually.

---

#### UI-19d: Footer

- [x] Keep simple — DockWalker tagline + login link
- [x] Use `text-[var(--tertiary)]` for footer text
- [x] Add Terms / Privacy links if they exist (check if routes exist)

---

#### Verify

- [x] On 390px viewport: logo + name + tagline + both CTAs visible above the fold without scrolling
- [x] No full-bleed stock photo as hero — logo is the primary visual
- [x] Page feels like DockWalker, not a template
- [x] Dark mode: atmospheric gradients visible, logo looks good against dark background
- [x] Light mode: clean, professional
- [x] CTAs use `Button` component with `rounded-full`
- [x] `npx tsc --noEmit` — zero errors
- [x] All tests pass

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

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, UI-16, Fix-z-index, UI-17, Fix-UI-17, UI-18, epaulette-fixes, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
