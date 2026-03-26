# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

UI bug fixes and UX improvements (5 items)

---

## Queue

### Fix: Permanent post form crash — empty SelectItem value

- [x] In `permanent-form-sections.tsx` line 338, change `<SelectItem value="">Any</SelectItem>` to `<SelectItem value="any">Any</SelectItem>`
- [x] In `permanent-post-form.tsx`, update the `experienceBracketId` state init from `''` to `'any'` (or keep `''` and add `onValueChange` handler that maps `'any'` back to `''`)
- [x] Verify form submission logic at ~line 194 still sends `null` when "Any" is selected (currently does `experienceBracketId || null` — if using `'any'` sentinel, change to `experienceBracketId === 'any' ? null : experienceBracketId`)
- [x] Check if the daywork post form has the same pattern for experience bracket — if so, apply the same fix for consistency

### Fix: Tab state resets to first tab on page refresh

- [x] In `discover/page.tsx`: persist `activeTab` to `sessionStorage` on change, restore on mount (follow Mine page's `MY_JOBS_TAB_STORAGE_KEY` pattern)
- [x] In `messages/page.tsx`: persist active tab (`'active'` | `'history'`) to `sessionStorage` on change, restore on mount
- [x] Verify Mine page already works correctly (it should — uses sessionStorage)
- [x] Test: refresh on each tab of Discover, Messages, and Mine — tab should persist within a session

### Add: Employer hat "How candidates see my profile" preview

- [x] In `profile/page.tsx`, when `!isCrewHat && person.identity_type !== 'agent'` (employer hat), add a "How candidates see you" button alongside the existing "My jobs" button
- [x] Wire the button to open `ProfileOverlay` with the user's own `person_id` (same pattern as crew/agent preview)
- [x] `ProfileOverlay` already renders an employer view (lines 358-450) — verify it works for self-view (it should, since `/api/profile/[personId]` allows self-access)

### Fix: Date fields overlap on mobile — stack vertically on small screens

- [x] In `daywork/post/page.tsx` ~line 415: change `grid grid-cols-2 gap-3` to `grid grid-cols-1 sm:grid-cols-2 gap-3`

### UX: Add person icon to permanent card "Posted by" text

- [x] In `permanent-job-card.tsx` ~line 210: add a `User` icon (from lucide-react) inline before or after the "Posted by {name}" text inside the existing button
- [x] Size the icon to match surrounding text (`h-3 w-3` or `h-3.5 w-3.5`)
- [x] Keep the existing `hover:text-primary hover:underline` behaviour

### Fix: Profile page scrolls to empty space after save/cancel edit

- [x] In `profile/page.tsx` line 388 (after `setEditing(false)` in `handleSave`): add `window.scrollTo(0, 0)`
- [x] In `profile/page.tsx` line 451 (cancel button `onClick`): add `window.scrollTo(0, 0)` after `setEditing(false)`

### UX: Replace identity pill with career status pill

**Profile page:**

- [x] Replace identity badge with career status badge (3 states: available now / after notice / not looking)
- [x] Only apply for crew identity. For agent identity, keep showing "Agent" badge
- [x] Uses existing `permAvail` state — no new data fetching needed

**ProfileOverlay — employer-facing view:**

- [x] Add `permanent_availability` and `notice_period_days` to the `CrewProfile` interface
- [x] Add `permanent_availability, notice_period_days` to the profile select query in `/api/profile/[personId]/route.ts`
- [x] Pass the fields through in `buildCrewProfile`
- [x] Render career status badge in `CrewProfileView` — same three states, same colours
- [x] For `EmployerProfile` view in ProfileOverlay: no career status badge (employers don't have this field)

### Fix: Availability overlay — LocationPicker z-index + save not reflecting

**LocationPicker dropdown z-index:**

- [x] Bumped PopoverContent from z-50 to z-[70] globally (renders above z-60 overlay)

**Save doesn't reflect on profile — needs real DB testing:**

- [ ] After `npx supabase db reset`, manually test availability save flow
- [ ] Check `expires_at` values if GET returns empty
- [ ] If timezone-related, fix in `apply_projection`'s expiry calculation or GET filter

### Fix: Vessel creation form freezing and LOA input issues

- [x] Replaced Dialog with inline expandable Card form (no focus trap, no nested portals)
- [x] Removed Dialog/DialogTrigger/DialogContent imports
- [x] Changed LOA input from `type="number"` to `type="text" inputMode="decimal"`
- [x] Redesigned vessel cards: M/Y or S/Y prefix on name, IMO subtitle, dot-separated metadata (Motor · 45m · 30-50m), NDA badge + edit button top-right

### Seed: Add two new test users

- [x] User 3 `g@1`: Stewardess "Profile Three" in Palma, STCW+ENG1, 1 vessel experience (M/Y Azure Dream 40m), auto-derived brackets
- [x] User 4 `d@1`: Auth only, no onboarding — tests redirect to onboarding flow

### Fix: PermanentPosting type mismatches — UUIDs typed as numbers

- [x] In `packages/types/src/models.ts`, change `PermanentPosting` + `PermanentTemplate`: `role_id: string`, `port_id: string`, `experience_bracket_id: string | null`, `required_certification_ids: string[]`
- [x] In `packages/types/src/events.ts`, change `PERMANENT.APPLICATION_BLOCKED` payload: `missing_certification_ids: string[]`
- [x] Fixed downstream: removed `parseInt` conversion in permanent apply route
- [x] Run `tsc --noEmit` — zero errors

### UX: NDA toggle caveat — vessel details revealed on acceptance

- [x] `vessels/page.tsx` NDA toggle: "Hide vessel identity from crew until they accept a position"
- [x] `vessels/[id]/edit/page.tsx` NDA toggle: same change

### Fix: console.error statements will fail pre-commit

- [x] `push-notifications.ts` line 43: replaced with descriptive comment
- [x] `push-notifications.ts` line 76: replaced with descriptive comment
- [x] `push-delivery.ts` line 171: replaced with `throw new Error()`
- [x] Verified zero `console.*` in `apps/web/src/`

### Fix: Size band filter is post-fetch — pagination breaks

- [x] Option B: fetch 200 (daywork) / 200 (permanent) when sizeBandId set, filter, trim to batch size
- [x] `hasMore` recomputed after filter (uses post-filter length > BATCH_SIZE)

### Fix: Toast container z-index conflicts with bottom nav

- [x] Changed toast container from `z-50` to `z-[60]`

### Fix: Docky sanitiser is insufficient for XSS prevention

- [x] Installed `dompurify` + `@types/dompurify`
- [x] Replaced regex `sanitiseHtml` with `DOMPurify.sanitize()` — covers javascript: URIs, data: URIs, SVG, CSS injection

### UX: Daywork + permanent post confirmation overlay

- [x] Daywork: replaced Dialog with BottomSheet showing full posting summary (vessel, role, dates, rate, positions, certs, meals, notes, NDA flag)
- [x] Permanent: added BottomSheet confirmation (vessel, role, start date, salary range, live aboard, shortlist cap, certs, notes)
- [x] Both: "Post job" + "Back to edit" buttons, scrollable content via BottomSheet
- [x] VesselSelector: added `onNameChange` callback so parent can display vessel name in confirmation

### UX: Auto-derived profile fields appear editable but aren't

- [x] Added "(auto-derived)" label to Experience and Vessel Size Exposure in view mode
- [x] Fields already hidden in edit mode — label clarifies why they can't be changed

### UX: No template deletion

- [x] Added trash icon button next to template select on both daywork and permanent post forms
- [x] DELETE routes already existed for both — wired with owner-scoped RLS

### Fix: Notification read route doesn't validate IDs

- [x] Added UUID regex validation + 100-element cap before `.in()` query

### Fix: Vessel creation from post form is a dead end

- [x] Both forms save state to sessionStorage before navigating to `/vessels?returnTo=...`
- [x] Vessels page auto-opens form when `returnTo` param present, redirects back after creation
- [x] Form state restored from sessionStorage on mount

### Fix: Permanent review page duplicate useEffect

- [x] Replaced duplicated fetch logic with single `loadApplicants()` call in useEffect
- [x] Fixed dependency array: `[loadApplicants]` (includes `postingId` via useCallback deps)

### Fix: Permanent discover live aboard filter type handling

- [x] API route now accepts both `'true'` and `'yes'` for live aboard filter

### UX: Discover page availability state goes stale

- [x] Added `checkAvailability()` to visibilitychange handler — re-fetches when tab regains focus

### Fix: Permanent crew withdrawal auto-reverts posting — employer should decide

When crew withdraws after being selected for a permanent role, `apply_projection` (`PERMANENT.WITHDRAWN` handler, migration 00073 lines 489-490) automatically sets the posting back to `active`. The employer gets no notification, no prompt, no choice — the posting silently reappears in the discovery feed. This is wrong: the employer should decide whether to repost or close, same as the daywork crew-cancel response pattern.

**Migration (new):**

- [ ] Change `PERMANENT.WITHDRAWN` handler: when `v_app_status = 'selected'`, do NOT set posting to `active`. Instead keep it in `in_negotiation` (or introduce a new `selection_reverted` status if cleaner — check if the `permanent_postings_status` CHECK constraint needs expanding)
- [ ] Set a `withdrawn_by` or `selection_reverted` flag on the posting (or reuse existing columns) so the API/UI can distinguish "employer hasn't responded yet" from "actively negotiating"
- [ ] Rollback file must restore the current auto-revert behavior

**API route (new): `POST /api/permanent/[id]/respond-withdrawal`**

- [ ] Two actions: `repost` (sets posting to `active`) and `cancel` (sets posting to `cancelled`, notifies remaining applicants)
- [ ] Hat check: employer/agent only
- [ ] Ownership check: must be the posting owner
- [ ] Status check: posting must be in the held state (not already `active` or `cancelled`)
- [ ] Append `PERMANENT.SELECTION_REVERTED` event on repost (already exists in the event types) or a new event if semantics differ
- [ ] On cancel: append `PERMANENT.CANCELLED_BY_EMPLOYER`, notify all pending/shortlisted applicants

**UI (chat page banner):**

- [ ] In `messages/[engagementId]/page.tsx` or `banners.tsx`: when employer views a closed permanent engagement where `outcome = 'withdrew'` AND posting is still in the held state (employer hasn't responded), show a banner: "Crew withdrew from this position. Would you like to repost or close it?"
- [ ] Two buttons: "Repost role" (calls respond-withdrawal with `action: 'repost'`) and "Close posting" (calls respond-withdrawal with `action: 'cancel'`)
- [ ] Follow the exact same UX pattern as the daywork `CrewCancelResponse` banner (relist vs cancel)
- [ ] After employer responds, refresh context and hide the banner

**Context API:**

- [ ] Add `withdrawal_responded` flag to `/api/messages/[engagementId]/context` — derived from posting status (if posting is no longer in the held state, employer has responded)
- [ ] Return `outcome` field for permanent engagements so the UI knows it was a crew withdrawal

**Tests:**

- [ ] Withdrawal from selected status: posting stays in held state, NOT `active`
- [ ] Employer responds with `repost`: posting moves to `active`
- [ ] Employer responds with `cancel`: posting moves to `cancelled`
- [ ] Non-owner cannot respond (403)
- [ ] Cannot respond if posting already `active` or `cancelled` (400)
- [ ] Withdrawal from non-selected status (applied, shortlisted): no employer prompt needed, posting stays `active` (existing behavior unchanged)

### Fix: Deactivated users can still call API routes

`requireDomainUser()` in `apps/web/src/lib/auth/require-domain-user.ts` queries the `persons` table but never checks `deactivated_at`. A user who deactivates their account keeps their auth session and can still hit all protected endpoints. RLS hides other users' data, but they can read their own and potentially append events.

- [x] Added `deactivated_at` to person select + 403 guard after lookup
- [ ] Optionally also sign the user out server-side (deferred — needs admin client)
- [x] Added dedicated `requireDomainUser` test file (4 tests: 401 unauth, 409 no person, 403 deactivated, 200 ok)

### Redesign: Billing flow — IAP bypass via email-to-web

Replace the current in-app Stripe checkout flow with an Apple IAP bypass: in-app page shows tiers (no prices), "Email me" CTA sends a magic link, user purchases in the browser, returns to app with subscription active.

**Phase 1: In-app billing page redesign**

- [ ] Rewrite `apps/web/src/app/(app)/billing/page.tsx`: remove "Subscribe" button, remove Stripe checkout redirect, remove feature comparison pricing
- [ ] Make tiers data-driven: array of `{ id, name, description, features[] }` objects at the top of the file. No prices shown. Tier details TBD — structure should support 2-4 tiers without code changes
- [ ] Each paid tier shows an "Email me about this" button (or similar neutral CTA — exact copy TBD)
- [ ] Free tier shows "Current plan" badge if user has no active subscription
- [ ] Active subscription shows the tier name + "Active" badge + "Manage subscription" link (this link opens a mailto or sends an email — NOT the Stripe portal in-app)
- [ ] Keep the Docky paywall UX as-is: 402 → limit card → "Upgrade" button → navigates to `/billing`

**Phase 2: Email-to-web magic link**

- [ ] New migration: `subscription_tokens` table — `id UUID PK`, `person_id UUID FK`, `plan TEXT`, `created_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ` (default `now() + interval '24 hours'`), RLS: service role only
- [ ] Rollback file for the migration
- [ ] New email template: `subscriptionInfoEmail()` in `apps/web/src/lib/email/templates.ts` — branded email with tier name, brief description, and a CTA button linking to `/subscribe/{plan}?token={token}`
- [ ] New API route: `POST /api/billing/request-info` — accepts `{ plan }`, generates a token row in `subscription_tokens`, sends the email via Resend, returns 200. Rate limit: max 3 emails per person per hour to prevent spam
- [ ] Wire the "Email me" button on the billing page to call this route, show a success toast: "Check your email"

**Phase 3: Web purchase page**

- [ ] New route: `apps/web/src/app/subscribe/[plan]/page.tsx` — outside the `(app)` layout (no bottom nav, no auth required via middleware). Minimal layout: DockWalker logo, plan name, purchase form
- [ ] On mount: validate token from URL query param against `subscription_tokens` table — check exists, not expired, plan matches. If invalid/expired, show error with "Request a new link" CTA
- [ ] On valid token: create Stripe checkout session (reuse existing `create-checkout` logic but triggered from this page, not the in-app billing page). Redirect to Stripe hosted checkout
- [ ] Stripe success URL: `/subscribe/success` — simple confirmation page: "You're subscribed! Open DockWalker to continue." with a deep link back to the app (`com.dockwalker.app://billing?success=true`)
- [ ] Stripe cancel URL: `/subscribe/[plan]?token={token}&cancelled=true` — show "Purchase cancelled" with option to try again
- [ ] After successful checkout: delete the used token (one-time use)

**Phase 4: Cleanup old flow**

- [ ] Remove or repurpose `POST /api/billing/create-checkout` — it should only be callable from the web subscribe page, not from the in-app billing page. Add a guard: reject requests that originate from the app (check referer or add a `source` param)
- [ ] Remove `POST /api/billing/create-portal` route — subscription management moves to email-based support or a web-only portal link sent via email (same pattern)
- [ ] Keep `GET /api/billing/status` — unchanged, still needed for in-app subscription detection
- [ ] Keep Stripe webhook — unchanged, still processes `checkout.session.completed` etc.
- [ ] Keep `requireSubscription()` — unchanged, still gates Docky
- [ ] Keep `subscriptions` table — unchanged
- [ ] Update tests: remove checkout/portal tests, add request-info + token validation tests

**Tests:**

- [ ] `POST /api/billing/request-info`: 401 unauth, 400 invalid plan, 200 sends email + creates token, 429 rate limited
- [ ] Token validation: expired token rejected, wrong plan rejected, used token rejected, valid token creates checkout session
- [ ] End-to-end: request-info → email sent → open link → Stripe checkout → webhook fires → `GET /api/billing/status` returns active plan

### Fix: Wire 4 dead email templates

- [x] `applicationReceivedEmail` wired for `DAYWORK.APPLIED` — sends to employer
- [x] `newMessageEmail` wired for `MESSAGE.SENT` (non-system) — sends to recipient
- [x] `permanentShortlistedEmail` wired for `PERMANENT.SHORTLISTED` — sends to crew
- [x] `permanentPlacementConfirmedEmail` wired for `PERMANENT.PLACEMENT_CONFIRMED` — sends to crew
- [x] All respect `email_enabled` preference + no-push-token gate

### Add: OG meta tags + social sharing image

- [x] Added OpenGraph + Twitter Card meta tags to layout.tsx (using existing app icon — dedicated 1200x630 OG image TBD as design asset)
- [ ] Create a 1200x630px OG image asset at `apps/web/public/images/brand/og-image.png`
- [ ] Add terms of service and privacy policy links to the landing page footer

### Pre-TestFlight: Capacitor native code changes

Code-level changes needed before TestFlight/Play Store builds. External config (Firebase credentials, deep link domains, signing keys, app store submissions) is tracked in `tasks/founder-todo.md` — not duplicated here.

- [ ] **iOS push entitlement:** Add `aps-environment` key (value: `development` for TestFlight, `production` for release) to `ios/App/App/App.entitlements`
- [ ] **iOS permissions:** Add `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` to `ios/App/App/Info.plist` (required for avatar upload)
- [ ] **Android permissions:** Add `android.permission.CAMERA` and `android.permission.READ_MEDIA_IMAGES` to `AndroidManifest.xml`
- [ ] **.gitignore:** Add patterns for `google-services.json`, `GoogleService-Info.plist`, `*.mobileprovision`, `*.p8`, `*.p12`
- [ ] **AppDelegate.swift:** Add `UNUserNotificationCenter.current().delegate = self` in `didFinishLaunchingWithOptions` for iOS push notification handling

---

## Post-TestFlight

> Deferred work. Not blocking launch. Prioritise based on real user feedback.

### Agent market as discover mode (152h)

Merge `/discover/market` into the main discover page as an agent-specific mode.

### Resilience Tests

- [ ] Discover, Chat, Apply, Post form, Availability overlay error handling tests

### Component Tests for Permanent UI

- [ ] PermanentJobCard, PermanentJobFeed, PermanentPostForm, PermanentReviewPage, PermanentApplicationCard

### Component Tests for Form Pickers

- [ ] LocationPicker, RolePicker, FlagStatePicker, AvailabilityOverlay, ProfileOverlay, ImageCropper — smoke tests (render, selection callback, error states)

### Onboarding True Atomicity

### App Feature Guide

### Negotiation Timeout

### Weekly Check-In Cron (Permanent)

### Email: List-Unsubscribe header

Add RFC 2369 `List-Unsubscribe` header to all outgoing emails for better deliverability. Currently emails link to `/settings` in the footer but have no one-click unsubscribe mechanism.

---

## Done

(See git history for completed stages 51-139, 141a, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, UI-0, Fix-UI-0, UI-D1, UI-D2, UI-D3, UI-D4, UI-D5, UI-13a, UI-13b, UI-13c, UI-14, UI-15, UI-15b, Fix-UI-15b, UI-16, Fix-z-index, UI-17, Fix-UI-17, UI-18, epaulette-fixes, UI-19, availability-model-overhaul, cron-trigger-fix, fixes 118a/123a/123b/127a/128a/128b/131a/139a-f/140a-e/143g/144-batch/fix1-addendum/144-cert/145a/146a/147a, template name cap, messages test cleanup)
