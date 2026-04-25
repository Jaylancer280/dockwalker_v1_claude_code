# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

### Multi-nationality — full implementation (deferred from Fix 233 night)

User feedback: "add more options for nationality. For people like me, who have British and South African passports... selecting multiple nationalities is nicer." Approach B chosen: array column on profiles, true multi-select.

**Why deferred:** apply_projection is a 490-line function and CREATE OR REPLACE requires the full body. Doing surgical edits at the end of a long session is high-risk. Schema-only piece is safe to ship tonight; rest is for tomorrow's fresh session.

#### Schema (tonight, low risk)

- [ ] Migration `00114_multi_nationality_v1.sql`:
  - `alter table public.profiles add column if not exists nationality_ids uuid[] not null default '{}'`
  - Backfill: `update public.profiles set nationality_ids = array[nationality_id] where nationality_id is not null and array_length(nationality_ids, 1) is null`
  - GIN index for future filters: `create index if not exists idx_profiles_nationality_ids on public.profiles using gin (nationality_ids)`
  - Self-contained rollback drops the index + the column. **Do NOT drop nationality_id yet** — keep for backward compat until all reads migrate.
- [ ] Apply via `npx supabase db push`.

#### Projection (tomorrow)

- [ ] Migration `00115_multi_nationality_projection.sql` — CREATE OR REPLACE `apply_projection` based on the latest 00108 body. Two PROFILE handlers change:
  - **PROFILE.CREATED**: insert `nationality_ids` from `coalesce(jsonb_array_elements_text(p_payload->'nationality_ids'), array[(p_payload->>'nationality_id')::uuid])` — accept either array (new) or single legacy field, normalize to array. Also keep writing `nationality_id` = first element of the resolved array, so legacy reads still work during transition.
  - **PROFILE.UPDATED**: same pattern — when payload has `nationality_ids`, replace; when payload has only legacy `nationality_id`, write `array[id]` to the array column AND the single column.
  - Other handlers untouched.

#### Event payload types (tomorrow)

- [ ] `packages/types/src/events.ts` — add `nationality_ids?: string[]` to `PROFILE.CREATED` and `PROFILE.UPDATED` payloads. Keep `nationality_id?: string | null` field marked deprecated (still present for projections that haven't fully migrated).

#### API routes (tomorrow)

- [ ] `apps/web/src/app/api/onboarding/route.ts` — accept `profile.nationalityIds: string[]`, write to event payload as `nationality_ids`. Also continue to set `nationality_id = profile.nationalityIds[0]` for backward compat.
- [ ] `apps/web/src/app/api/profile/route.ts` GET + PATCH — read/write the array.
- [ ] All routes that read `nationalities:nationality_id(...)` PostgREST embed (`apps/web/src/app/api/daywork/[id]/available-crew/route.ts:176`, `apps/web/src/app/api/permanent/[id]/review/route.ts:50`, `apps/web/src/app/api/daywork/[id]/applicants/route.ts:57`) — replace embed with: SELECT `nationality_ids` from profiles, then a separate `from('nationalities').select('id, name, flag_emoji').in('id', allIds)` lookup, build a map, attach to each profile.

#### UI (tomorrow)

- [ ] `apps/web/src/components/searchable-nationality-select.tsx` — convert to multi-select. Either swap to a `HierarchicalPills`-style component, or extend the existing select to accept `value: string[]` and `onChange: (ids: string[]) => void`. Render selected items as removable chips above the search input.
- [ ] `apps/web/src/app/(app)/profile/_components/profile-summary-section.tsx` — render multiple flag emojis next to the name when there are multiple nationalities (e.g. `🇿🇦🇬🇧`). The `Profile` interface field changes from `nationalities: { id, name, flag_emoji } | null` to either `nationalities: Array<...>` or stays single + computed in the page.
- [ ] `apps/web/src/app/(app)/profile/page.tsx` — change `nationalityId: string | null` state to `nationalityIds: string[]`.
- [ ] `apps/web/src/app/(app)/profile/_components/profile-edit-form.tsx` — same state change, multi-select component.
- [ ] `apps/web/src/app/onboarding/_components/profile-step.tsx` — same state change.
- [ ] (mobile deferred per `feedback_no_mobile.md`)

#### Tests (tomorrow)

- [ ] `__tests__/api/profile-view.test.ts` — mock `nationality_ids: []` (or array fixture).
- [ ] `__tests__/api/permanent-review.test.ts` — mock crew profile array.
- [ ] `__tests__/api/onboarding.test.ts` — assert `nationality_ids` in event payload.

#### BUILD_STATE entry

- [ ] Schema bump v113 → v114 (or v115 if both migrations ship together).
- [ ] Fix 234 (Multi-nationality) entry covering all of the above.

#### Done condition

A user can pick British + South African in onboarding or profile edit, see both flags rendered next to their name, and have employers see both flags on their applicant card. Existing single-nationality profiles continue to work without manual intervention (backfilled).

---

### Locations V2 — OSM fallback (post-launch nice-to-have)

Live OSM Nominatim fallback for the long-tail city/port name not in the curated seed. Original urgency dropped after Fix 232 traced "no match" reports to the auth gate, not missing data. Schema columns (`source`, `latitude`, `longitude`, `osm_place_id`) and 11 gap-fill cities already shipped in migration 00113 — only the live API + UI fallback remains. Full plan in git history under the Fix 232 todo.

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
