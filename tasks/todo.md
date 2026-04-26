# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Multi-nationality — phase 2

Phase 1 (`profiles.nationality_ids uuid[]` column + GIN index + backfill) shipped in migration 00114, schema v114. Legacy `nationality_id` column still in place; readers/writers haven't migrated yet. Phase 2 wires the full stack.

#### Projection

- [ ] Migration `00115_multi_nationality_projection.sql` — CREATE OR REPLACE `apply_projection` based on the latest 00108 body. Two PROFILE handlers change:
  - **PROFILE.CREATED**: insert `nationality_ids` from `coalesce(jsonb_array_elements_text(p_payload->'nationality_ids'), array[(p_payload->>'nationality_id')::uuid])` — accept either array (new) or single legacy field, normalize to array. Also keep writing `nationality_id` = first element of the resolved array, so legacy reads still work during transition.
  - **PROFILE.UPDATED**: same pattern — when payload has `nationality_ids`, replace; when payload has only legacy `nationality_id`, write `array[id]` to the array column AND the single column.
  - Other handlers untouched.

#### Event payload types

- [ ] `packages/types/src/events.ts` — add `nationality_ids?: string[]` to `PROFILE.CREATED` and `PROFILE.UPDATED` payloads. Keep `nationality_id?: string | null` field marked deprecated (still present for projections that haven't fully migrated).

#### API routes

- [ ] `apps/web/src/app/api/onboarding/route.ts` — accept `profile.nationalityIds: string[]`, write to event payload as `nationality_ids`. Also continue to set `nationality_id = profile.nationalityIds[0]` for backward compat.
- [ ] `apps/web/src/app/api/profile/route.ts` GET + PATCH — read/write the array.
- [ ] All routes that read `nationalities:nationality_id(...)` PostgREST embed (`apps/web/src/app/api/daywork/[id]/available-crew/route.ts:176`, `apps/web/src/app/api/permanent/[id]/review/route.ts:50`, `apps/web/src/app/api/daywork/[id]/applicants/route.ts:57`) — replace embed with: SELECT `nationality_ids` from profiles, then a separate `from('nationalities').select('id, name, flag_emoji').in('id', allIds)` lookup, build a map, attach to each profile.

#### UI

- [ ] `apps/web/src/components/searchable-nationality-select.tsx` — convert to multi-select. Either swap to a `HierarchicalPills`-style component, or extend the existing select to accept `value: string[]` and `onChange: (ids: string[]) => void`. Render selected items as removable chips above the search input.
- [ ] `apps/web/src/app/(app)/profile/_components/profile-summary-section.tsx` — render multiple flag emojis next to the name when there are multiple nationalities (e.g. `🇿🇦🇬🇧`). The `Profile` interface field changes from `nationalities: { id, name, flag_emoji } | null` to either `nationalities: Array<...>` or stays single + computed in the page.
- [ ] `apps/web/src/app/(app)/profile/page.tsx` — change `nationalityId: string | null` state to `nationalityIds: string[]`.
- [ ] `apps/web/src/app/(app)/profile/_components/profile-edit-form.tsx` — same state change, multi-select component.
- [ ] `apps/web/src/app/onboarding/_components/profile-step.tsx` — same state change.
- [ ] (mobile deferred per `feedback_no_mobile.md`)

#### Tests

- [ ] `__tests__/api/profile-view.test.ts` — mock `nationality_ids: []` (or array fixture).
- [ ] `__tests__/api/permanent-review.test.ts` — mock crew profile array.
- [ ] `__tests__/api/onboarding.test.ts` — assert `nationality_ids` in event payload.

#### BUILD_STATE entry

- [ ] Schema bump v114 → v115 when 00115 lands.
- [ ] Fix 234 (Multi-nationality phase 2) entry covering projection + types + API + UI.

#### Done condition

A user can pick British + South African in onboarding or profile edit, see both flags rendered next to their name, and have employers see both flags on their applicant card. Existing single-nationality profiles continue to work without manual intervention (backfilled).

---

### Date + time pickers — visual upgrades

User feedback: text inputs for dates feel clunky vs visual; the existing calendar icon next to `dd/mm/yyyy` should open a real popup calendar. Time picker (currently `<input type="time">`) is broken on some browsers and hard to use — replace with a scroll-wheel/spinner pattern.

#### Date picker (popup calendar)

- [ ] Add `apps/web/src/components/ui/calendar.tsx` — wrap `react-day-picker` (or shadcn's Calendar) inside a `Popover` anchored to the existing calendar icon in `apps/web/src/components/ui/date-input.tsx`. Click icon → calendar opens. Click date → fills the text input AND closes popover.
- [ ] Keep the manual `dd/mm/yyyy` text input intact — desktop power users who type fast prefer it. Calendar icon is the alternate path, not a replacement.
- [ ] Position logic — the popover must NOT clip off-screen. Use `Popover` with `collisionPadding` and let Radix flip the placement automatically (top/bottom/left/right). Verify at small viewport (mobile) and near page edges.
- [ ] All 11 existing `DateInput` callsites inherit the change — daywork post, permanent post, experience forms, onboarding, discover filters, postponement overlay, etc. Per BUILD_STATE Stage 196 history.
- [ ] Keep the `min` / `max` / disabled-date logic that DateInput currently honors (e.g. permanent posting start dates can't be too far in the past). Calendar grays out invalid days.

#### Time picker (scroll wheel / spinner)

- [ ] Single callsite right now: `apps/web/src/app/(app)/messages/[engagementId]/_components/checklist-form-overlay.tsx:215` (`type="time"`).
- [ ] Replace with a paired `<Select>` for hours (0-23 or 1-12 + AM/PM) and minutes (00, 15, 30, 45, or 5-min steps). iOS-style scroll-wheel UX — large tappable rows, snap-to-value, 60-fps smooth scroll.
- [ ] Either build it (using a virtualised list library or pure CSS scroll-snap) or pull `react-mobile-picker` / similar. Vet license + bundle size before pulling.
- [ ] Output format stays HH:mm string so the rest of the form/event logic doesn't change.

#### Done condition

Tapping any date field shows a calendar popover that doesn't clip off-screen. Tapping the time field on the checklist setter shows a smooth scroll-wheel.

---

### Vessels V2 — multi-name/flag history + admin curation queue (post-launch)

Same admin-review pattern as Locations V2 but for vessels. IMO is already locked in as the immutable anchor (CLAUDE.md core invariant) — this proposal adds the temporal layer that real-world yacht ownership churn requires (rename after sale, reflag after sanctions, etc.). Avoids legal exposure on Equasis/MarineTraffic scraping by using **manual admin enrichment** rather than automated import.

#### Why this matters

A crew member's experience on `MY Vessel X` from 2018-2020 (Cayman flag) under IMO 1010545 is historically correct even if that hull is now `MY Vessel Y` (Malta flag). The IMO is the anchor; names and flag states are time-variable.

#### Schema

- [ ] Migration `00117_vessel_history.sql`:
  - New table `vessel_names` — `(id uuid PK, vessel_id FK, name text, effective_from date, effective_to date null, source text 'curated'|'user_submitted'|'pending', created_at)`. Append-only. Latest with `effective_to is null` is the current name; historical entries persist forever.
  - New table `vessel_flag_states` — same shape: `(id, vessel_id, flag_state_id FK, effective_from, effective_to, source, created_at)`.
  - Add columns to `vessels`: `gross_tonnage int null`, `beam_meters numeric(6,2) null`, `year_built int null`, `builder text null`, `flag_state_id uuid null FK` (current flag, denormalized), `source text 'curated'|'user_submitted'|'pending' default 'curated'`, `hidden_at timestamptz null`. The denormalized `vessels.name` and `vessels.flag_state_id` are kept as "current" — projection updates them when a new name/flag record with `effective_to=null` lands.
  - GIN index on `vessel_names(name)` via pg_trgm for fuzzy search across historical names.

#### Events (event-sourced per CLAUDE.md mission)

- [ ] New event types in `packages/types/src/events.ts`:
  - `VESSEL.RENAMED` — payload `{ vessel_id, name, effective_from, effective_to? }`. Closes the previous name record (sets `effective_to = effective_from - 1 day`) and inserts a new one. Updates `vessels.name`.
  - `VESSEL.REFLAGGED` — payload `{ vessel_id, flag_state_id, effective_from, effective_to? }`. Same pattern for flag states.
  - `VESSEL.METADATA_UPDATED` — payload `{ vessel_id, gross_tonnage?, beam_meters?, year_built?, builder? }`. Admin enrichment events. Single event for any combination of metadata fields (each optional, coalesce in projection).
- [ ] Migration `00118_vessel_history_projection.sql` — extend `apply_projection` to handle the three new event types.

#### Entry points (where users add a vessel)

The pending-vessel flow fires from any of these, all routed through a shared "Add a vessel" component:

- [ ] **Crew adding experience** — existing IMO lookup at `apps/web/src/app/(app)/profile/add-experience/...`. Already wired; just needs the manual fallback when IMO not found.
- [ ] **Employer/Agent posting daywork** — `apps/web/src/app/(app)/daywork/post/...`.
- [ ] **Employer/Agent posting permanent** — `apps/web/src/app/(app)/daywork/post/_components/permanent-post-form.tsx`.
- [ ] **Standalone vessel manager (agents)** — new page `apps/web/src/app/(app)/vessels/page.tsx` or similar. Lets agents pre-curate vessel data outside any specific posting context. Important: agents managing multiple yachts may add vessels in bulk without immediate experience or posting attached.

All four entry points reach the same `<AddVesselDialog>` component which calls a shared route.

#### Manual add flow

> Only fires AFTER IMO lookup returns no match. Don't surface a manual form when canonical hits exist.

- [ ] New route `apps/web/src/app/api/vessels/request/route.ts` — auth-required POST. Body `{ imo_number, name, vessel_type, size_band_id, loa_meters, flag_state_id?, year_built?, builder?, gross_tonnage?, beam_meters? }`. Server-side: validates IMO is 7 digits and unique, inserts vessel with `source='pending'`, inserts initial `vessel_names` and `vessel_flag_states` (if provided) entries with `source='pending'`. Returns the new vessel id. Existing `/api/vessels/lookup` already handles IMO uniqueness — re-use that logic.
- [ ] Manual form fields: **IMO Number** (required, 7 digits), **Vessel Name** (required), **Vessel Type** (motor/sail/etc, dropdown), **LOA** (meters), **Size Band** (auto-derived from LOA if possible), **Flag State** (optional, dropdown), **Year Built** (optional), **Builder** (optional). Last three fields are nice-to-have at submit; admin can fill in during review.

#### Admin notification

- [ ] In-app admin notification on `vessels.source='pending'` insert. Reuse `notifyAdminsOfSupport` pattern: lookup admins, insert notification rows of type `admin_vessel_pending`, deep_link `/admin/vessels/pending`. Title `'New vessel request'`, body `'<user> added <name> (IMO <imo>)'`.

#### Admin queue

- [ ] New page `apps/web/src/app/admin/vessels/pending/page.tsx`. Lists every vessel with `source='pending'`, ordered by `created_at desc`. Each row shows: submitting user, submitted on, IMO, current name, current flag, all metadata fields (editable inline). Three action buttons:
  - **APPROVE** — _"Mark this vessel as canonical. Edit fields above (typos, capitalization) and add enrichment data (gross tonnage, beam, year built, builder, flag state) before clicking. The submitting user and all future users will see this vessel record. Use this when the IMO is real and the data has been verified (Equasis or similar)."_ → flips `source` to `'curated'` on vessels + vessel_names + vessel_flag_states. Same UUID retained.
  - **MERGE** — _"This IMO already exists in the database. Pick the canonical match below. The submitter's experience entry / posting will be re-pointed to the canonical vessel. If the submitted name doesn't match the canonical's current name, it's added as a historical alias to vessel_names so future searches by either name resolve to the same hull. Use this when the same IMO has been added before under a different name."_ → opens IMO-keyed picker against canonical-only vessels. On select: emit `VESSEL.RENAMED` event if name differs (using submitter's experience date range as effective_from/to), repoint all FKs (`crew_experiences.vessel_id`, `dayworks.vessel_id`, `permanent_postings.vessel_id`, `daywork_templates.vessel_id`, `permanent_templates.vessel_id`), delete pending vessel row.
  - **HIDE** — _"Keep this submission private to the user who created it. They'll still see it on their own profile / posting / experience, but it won't appear in anyone else's vessel search and won't accumulate as canonical data. Use for unverifiable submissions you don't want to approve OR merge — for example, if you can't find any record of the IMO on Equasis."_ → sets `vessels.hidden_at = now()`. Submitting user's experience/posting still resolves the FK normally; everyone else's search filters out hidden + pending.

- [ ] Admin can also **add historical names/flags inline** during review — e.g., user submits "Black Pearl" but admin's Equasis check shows the hull is currently "Sea Wolf" with prior name "Black Pearl" 2015-2020. Admin enters both into `vessel_names` with appropriate effective dates. Single transaction.

#### Display logic (UI work, deferrable)

- [ ] Crew experience display picks name from `vessel_names` whose `[effective_from, effective_to)` overlaps the experience's `[start_date, end_date)`. Fall back to current `vessels.name` if no match. Same for flag.
- [ ] IMO lookup endpoint extended to fuzzy-search across `vessel_names.name` (not just `vessels.name`), so typing "Sea Wolf" finds the hull even if it's currently "Black Pearl".
- [ ] Optional polish: hover/tap text on historical names — `"Now MY Black Pearl"`.

#### Tests

- Migration smoke test: insert a vessel with multiple name records spanning different effective dates, verify display logic picks the right name for a given experience date range.
- Admin queue: approve/merge/hide actions have integration coverage.
- VESSEL.RENAMED / VESSEL.REFLAGGED event handling in projection.
- Manual add flow from each of the four entry points.

#### Done condition

- A crew member adding experience on a hull whose IMO isn't in the DB gets the manual add form, fills it in, sees the vessel persist on their experience.
- An agent managing a fleet can pre-add vessels via `/vessels` (or wherever the standalone manager lives) without any experience or posting attached.
- Admin gets in-app notification, opens `/admin/vessels/pending`, enriches with Equasis data, approves.
- Crew member's old experience on the same IMO under a different name still displays the historical name correctly because `vessel_names` covers the overlapping date range.

#### Schema version

Migration 00117 + 00118 — schema bumps depend on whether multi-nationality phase 2 ships first (would be 00115/00116) or after.

---

### Locations V2 — OSM fallback + manual request + admin curation queue

Schema (migration 00113) already in place: `source` ('curated' | 'osm'), `latitude`, `longitude`, `osm_place_id` on cities; `source` on ports. Need to extend `source` CHECK to include `'pending'`. Three layers of fallback for "user can't find their location":

#### Layer 1 — OSM Nominatim live fallback (~3-4 hr)

- [x] New route `apps/web/src/app/api/locations/search-external/route.ts` — shipped in Wave B (Fix 242).
- [x] New route `apps/web/src/app/api/locations/canonicalize/route.ts` — shipped in Wave B (Fix 242).
- [x] Updated `apps/web/src/components/location-picker.tsx` — OSM fallback wired (port-optional only) in Wave B.

#### Layer 2 — Manual "Request this location" form (~2 hr)

> Only fires AFTER both canonical AND OSM Nominatim return zero. Cheap path for the long tail of obscure marinas not in either dataset.

- [x] Migration `00117_locations_pending_v1.sql` — Wave A. Schema v116 → v117.
- [x] Migration `00118_locations_pending_search_filter.sql` — Wave C. Replaces `search_locations` and `top_locations` with versions that filter pending + hidden cities/ports. Schema v117 → v118.
- [x] Picker manual fallback: `LocationRequestModal` opens when canonical AND OSM both come back empty (or in `port-required` mode after canonical empty). Shipped in Wave C (Fix 243).
- [x] New route `apps/web/src/app/api/locations/request/route.ts` — shipped in Wave C (Fix 243).
- [x] New route `apps/web/src/app/api/locations/regions/route.ts` — populates the modal's country picker. Shipped in Wave C (Fix 243).

#### Layer 3 — Admin notification + curation queue (~2 hr)

- [ ] In-app admin notification on new pending row. Reuse the existing `notifications` table — when `/api/locations/request` runs, look up admins (`is_admin=true, deactivated_at is null, blocked_at is null`) and insert a notification per admin: `type='admin_location_pending'`, `title='New location request'`, `body='<user> added <name> in <country>'`, `deep_link='/admin/locations/pending'`. Pattern mirrors `notifyAdminsOfSupport` from Fix 231.
- [ ] New page `apps/web/src/app/admin/locations/pending/page.tsx` — lists every row across regions/cities/ports with `source='pending'`, ordered by `created_at desc`. Each row shows: submitted by, submitted on, the parent chain (region → city → port), action buttons.
- [ ] Three action buttons per row, each with a **clear, unambiguous tooltip and confirmation copy** so admin never wonders what's about to happen:
  - **APPROVE** — _"Mark this location as canonical. Edit fields above (typos, capitalization) before clicking. The submitting user and all future users will see this exact spelling. Use this when the location is real and unique."_ → updates row(s) in place, flips `source` to `'curated'`. Same UUID retained — submitting user's FK still resolves.
  - **MERGE** — _"This is a duplicate of an existing location. Pick the canonical match below. The submitting user's profile/posting will be re-pointed to that match, and this duplicate row will be deleted. Use this when an admin or curated entry already covers it."_ → opens a search picker against canonical-only rows, on selection: UPDATE every FK referencing the pending row's id to point at the canonical id (profiles, dayworks, permanent_postings, crew_experiences, vessels), then DELETE the pending row.
  - **HIDE** — _"Keep this submission private to the user who created it. They'll still see it on their own profile, but it won't appear in anyone else's searches and won't be canonical. Use this for unverifiable submissions you don't want to approve OR merge."_ → no-op on the row (it stays `source='pending'`), but mark `hidden_at = now()` (new column on cities/ports). The pending queue filters out hidden rows. Search RPC already excludes `source='pending'`.

- [ ] FK ripple list for MERGE — confirm no FK is missed: `profiles.location_city_id`, `profiles.location_port_id`, `dayworks.location_city_id`, `dayworks.location_port_id`, `permanent_postings.city_id`, `permanent_postings.port_id`, `crew_experiences.location_port_id`, `vessels.home_port_id` (verify in schema). Wrap UPDATE+DELETE in a transaction.
- [ ] Tests: external route mocks Nominatim; canonicalize route covers region creation + city upsert idempotency; request route covers region/city/port insert chain; admin queue page renders pending rows; approve/merge/hide actions have integration tests.

#### Done condition

- A user typing "Port Azure" sees: canonical hits → OSM hits → "Add it manually" button. They fill the form, hit submit, see "Port Azure" persist on their profile within 2 seconds.
- Admin gets in-app notification, opens `/admin/locations/pending`, sees the entry with full context, can approve/merge/hide with zero ambiguity about which button does what.
- After approve, the user refreshes and sees the corrected canonical name. After merge, the user sees the existing canonical name. After hide, the user keeps seeing their submitted text but no one else's search includes it.

#### Schema changes summary

- Migration 00117 shipped: extends `cities.source` and `ports.source` CHECKs to include `'pending'`; adds `hidden_at timestamptz null` to both. Schema v116 → v117.
- Migration 00118 shipped: `search_locations` and `top_locations` exclude pending + hidden rows. Schema v117 → v118.

---

## Queue

### Locations V1 — remaining follow-ups

> Original Stage 217 audit list; C1-C3 shipped earlier. Remaining items:

- [ ] Live-picker UI sanity pass — spot-check 20 random non-curated ports via fuzzy search; confirm city/country context renders
- [ ] Move `TOWN_ALIASES` + `COUNTRY_CODE_FIXES` from `scripts/marina-extraction/3c_normalize.py` into a versioned JSON config under `supabase/seed/` — reduces drift when extending curated hubs
- [ ] Document admin workflow for merging OSM district near-duplicates (e.g. if users report "Muğla" marinas in multiple towns)

---

## BLOCKED — external/lawyer

### Legal pages go-live

`/privacy` and `/terms` pages render with placeholder values wired in `apps/web/src/lib/legal-placeholders.ts` (Delaware incorporation, Nautalink Technologies Inc., admin@nautalink.io support/DPO, EU Frankfurt Supabase region).

- [ ] **Lawyer review of `/privacy` and `/terms` wording** (source drafts: `tasks/privacy-policy-spec.md` + `tasks/founder-drafts.md` §1) — placeholder VALUES are correct; the POLICY TEXT still needs legal review.
- [ ] Decide: cookie consent banner needed for target jurisdictions? (Functional cookies only — likely not required under GDPR, but check local law)

---

## Pre-launch QA (do before opening to real users)

### Google Sign-In edge cases

> Provider is live (OAuth client in Google Cloud under nautalink.io org,
> Supabase provider enabled, identity linking on). Basic sign-up/sign-in
> verified end-to-end. The items below are edge-case verifications.

- [ ] Sign up via Google in incognito → confirm display_name prefilled from Google profile on onboarding.
- [ ] As an OAuth-only user (no email/password identity), visit `/auth/forgot-password` → confirm the "Signed up with Google?" inline note + Google button render above the reset form.
- [ ] As an OAuth-only user, visit Settings → Account → confirm change-password section is hidden and replaced with "manage your password at Google" link.
- [ ] As an existing email/password user, sign in with Google using the same email → confirm the two identities merge into one account (manual linking is on).

### Stripe live mode QA

- [ ] Customer Portal flow: subscribe → click "Manage subscription" in app → land in Stripe Customer Portal → cancel from there → confirm app flips to Free.
- [ ] Failed payment recovery: use a card known to fail 3DS → confirm app shows graceful error, no orphaned subscription state.
- [ ] Subscription update via Stripe dashboard (e.g. change plan) → confirm `customer.subscription.updated` webhook fires and app reflects new plan.

---

## Deferred — intentional

### Custom Supabase auth domain ($10/mo)

> Cosmetic only — currently Google Sign-In account picker shows
> `hwpcuehqawullzqbmcdv.supabase.co` instead of "DockWalker". Stripe
> auth and other flows unaffected.

- Setup path when ready: Supabase Project Settings → Custom Domains → add `auth.dockwalker.io` → CNAME at Namecheap → wait for SSL → update Google OAuth client's redirect URI to use the custom domain → update Auth URL Configuration in Supabase.

### Vercel staging branch

> Skipped today; collapse-to-one-project setup is correct for solo
> pre-launch dev. Add when starting heavy feature work or when needed
> as a stable preview URL for Stripe test webhooks.

- Setup path: `git checkout -b staging && git push -u origin staging` → optional: attach `staging.dockwalker.io` as custom subdomain assigned to staging branch → split currently-Production+Preview env vars into Production-only (live) + Preview-only (test) entries (especially `STRIPE_*` keys to avoid feature branches hitting live mode).

### Apex → www 301 redirect

> Vercel currently 307s `dockwalker.io` → `www.dockwalker.io`.
> Bit us on Stripe webhook delivery (twice — both occasions documented in
> `tasks/lessons.md`). Browsers don't cache 307; making it 301 saves a
> round-trip on cold visits and avoids the same landmine if any future
> service pings the apex.

### WhatsApp via Meta Cloud API

> Telegram already covers crew/employer notification needs. WhatsApp
> migration is a v2 feature, not launch-blocking.

- Get dedicated number (prepaid SIM or Google Voice for Workspace)
- Register with Meta Cloud API directly (not Twilio — see lessons file for why)
- Swap Twilio dispatcher for Meta Graph API calls
- Submit templates for Meta approval

### Sensitive flag rotation on remaining "Needs Attention" vars

> Vercel flagged several env vars (Anthropic, OpenAI, Upstash, Supabase
> service role) as "should be Sensitive but isn't." Fix requires rotating
> the secret at the source, then re-adding to Vercel marked Sensitive
> (since Sensitive values can't be edited — only set on creation).

> Low priority pre-launch (solo developer). Do when adding team members.

---

## Backlog

> Active backlog. Pick items into Queue when ready.

### Deferred post-launch

- **Voice calling — replace Twilio + browser QA before unmute.** Phone button in chat header is gated behind a "Coming soon" toast (Fix 222d); `IncomingCallListener` unmounted from the app layout. `use-voice-call.ts`, `voice-call-context.tsx`, `call-bar.tsx`, `incoming-call-listener.tsx`, `turn-credentials` route, `call-ended` route all retained as dead code. When unmuting: (1) decide on managed RTC provider — LiveKit Cloud is the preferred replacement over Twilio TURN+Supabase-Realtime-signaling (SFU routing, call history, recording capability); (2) swap the hand-rolled `RTCPeerConnection` stack in `use-voice-call.ts` for the provider's SDK; (3) restore phone button's real `onClick` wiring to `voiceCall.startCall` + gate on `isPermanent && status === 'active'`; (4) re-mount `IncomingCallListener` in `(app)/layout.tsx`; (5) run browser QA matrix (Chrome/Firefox/Safari × desktop+mobile, glare resolution, network drops, backgrounded tab, multi-tab, offline user). Audit-trail gap: currently only `MESSAGE.SENT` records a call; add `CALL.STARTED`/`CALL.ENDED` events in the ledger at the same time.

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.
- **CSRF origin validation** — add origin check middleware for POST/PATCH/DELETE routes (defense-in-depth, mitigated by SameSite cookies).
- **Stripe support runbook** — document refund-vs-cancel separation. Refund alone leaves subscription active until period end (correct Stripe design); for immediate revocation, refund + explicitly cancel subscription.

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
- **Chat textarea send-then-snap-back** — when textarea grows multi-line then shrinks on send, layout shifts visibly. iOS-keyboard-specific; needs visualViewport API or careful keyboard-state detection. Cosmetic, not blocking.
- **Stripe success URL Apple Pay timeout** — observed during live testing: completing checkout via Apple Pay sometimes shows "session timed out" before redirect. Stripe-side issue or our success URL handler; investigate when seen by real users.
- **Notification handler `roleContext` mismatch** — handlers like `handleDayworkApplied` hardcode `roleContext: 'employer'` even when recipient is an agent. Fix 228 patched the count endpoint to ignore the filter for agents; proper fix is to set `roleContext` per recipient identity at handler dispatch time.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.
