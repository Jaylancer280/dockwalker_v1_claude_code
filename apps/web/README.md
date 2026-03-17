# DockWalker Web

Next.js 16 app for the DockWalker daywork marketplace. This app contains:

- App Router pages in `src/app`
- API route handlers in `src/app/api`
- Supabase SSR/auth helpers in `src/lib/supabase`
- Vitest tests in `__tests__`

## Prerequisites

- Node.js 20+
- npm
- Supabase CLI available through `npx supabase`

## Environment

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Required variables (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is required because server routes append ledger events through RPCs.

## Local Development

From the repo root:

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
```

App URL: `http://localhost:3000`

Local Supabase defaults from `supabase/config.toml`:

- API: `http://127.0.0.1:54321`
- DB: `127.0.0.1:54322`
- Studio: `http://127.0.0.1:54323`

## Database Notes

Current schema version: see [BUILD_STATE.md](../../BUILD_STATE.md)

The current app expects the following RPCs to exist in `public`:

- `append_event`
- `check_no_overlap`
- `check_no_overlap_excluding`
- `onboard_person`
- `clear_availability_dates`
- `get_vessel_public`

If you see errors like:

```text
Could not find the function public.onboard_person(...) in the schema cache
```

your database is behind the code. Apply migrations and refresh the local stack:

```bash
npx supabase db reset
npx supabase stop
npx supabase start
```

For a linked remote project, use:

```bash
npx supabase db push
```

## Available Scripts

From the repo root:

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm test
```

From `apps/web` directly:

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm run test
npm run test:integration   # requires local Supabase running
```

Capacitor helpers:

```bash
npm run cap:sync          # sync web assets to native projects
npm run cap:open:ios      # open Xcode
npm run cap:open:android  # open Android Studio
npm run cap:build         # static export + cap sync (cross-platform)
```

`cap:build` sets `CAPACITOR_BUILD=1` which switches `next.config.ts` to static export mode (`output: 'export'`), producing the `out/` directory that `capacitor.config.ts` expects as `webDir`. Normal `npm run build` stays in server mode for Vercel.

## Testing

Primary checks:

```bash
npm run lint
npm run type-check
npm test
```

The API tests mock `@/lib/supabase/server` and call route handlers directly. Component tests mock `@/lib/supabase/client` and render pages to verify UI behaviour (e.g. canonical dropdown population). Both are fast unit tests that do not require a running database.

Integration tests (`npm run test:integration`) run against a real local Supabase instance and verify that events emitted with the same payload shape as the API routes are correctly projected into materialised tables. They require `npx supabase start` and `npx supabase db reset` to be run first. These tests are excluded from the default `npm test` run.

## Infrastructure

- **Health check:** `GET /api/health` — public, no auth, no DB. Returns `{ status: 'ok', timestamp }`. Use for uptime monitoring and load balancer checks.
- **Body size limit:** Server actions body size is set to 1MB in `next.config.ts` (`experimental.serverActions.bodySizeLimit`). Route handlers use the Next.js default (also 1MB).
- **Avatar upload:** MIME type validation + magic byte validation (JPEG/PNG/WebP). Max 2MB. Spoofed Content-Type headers are rejected.
- **Rate limiting:** Upstash Redis via Next.js middleware (`proxy.ts`). Global: 100 requests/60s per IP for all API routes. Write routes (POST/PATCH/DELETE): 30 requests/60s per IP. Exempt: `/api/health`, `/api/webhooks/*`. Graceful no-op when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are not configured (local dev). Set up: create an Upstash Redis store at [upstash.com](https://upstash.com) or via the Vercel integration, copy REST URL + token to env vars.

## Architectural Notes

- Core domain state is event-sourced through `append_event`.
- `daywork_templates`, `user_preferences`, and `device_tokens` are intentional exceptions: they are owner-scoped CRUD utility data and not part of the ledger.
- Push notifications are delivered via `src/lib/push-delivery.ts` (FCM HTTP v1 + APNs HTTP/2) and triggered by `src/lib/push-triggers.ts` which maps domain events to notifications. `notifyOnEvent()` is called fire-and-forget after `appendEvent`/`appendEvents` in 12 API routes. Requires env vars: `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_PATH`. Gracefully no-ops when not configured. Foreground notifications shown via `PushToast` component (auto-dismiss 5s banner); tap navigation uses `resolveDeepLinkUrl()` for deep linking (chat, discover, review screens). Badge management deferred pending plugin install.
- NDA vessel exposure for crew goes through `get_vessel_public`, not direct vessel table reads.
- Onboarding is atomic through `onboard_person`, which appends `PERSON.CREATED` and `PROFILE.CREATED` together. The onboarding UI is a 6-step flow: welcome → identity → experience fork (green/experienced) → profile → vessel experience (experienced only) → hat selection. Green crew manually declare experience bracket and vessel size exposure. Experienced crew add vessel experience entries (IMO lookup, vessel details, role, dates, salary, rotation) — experience bracket and vessel size exposure are auto-derived.
- All domain routes (read and write) use `requireDomainUser()` from `src/lib/auth/require-domain-user.ts`. This guard returns 401 for unauthenticated users and 409 for users missing `persons` or `profiles` rows. Only `auth/me` and `onboarding` are excluded.
- Discovery (`GET /api/daywork/discover`) is open: crew see all active postings. Filters are explicit: `roleId`, `portId`, `startDate`, `endDate`, `certificationId`, `experienceBracketId`, `sizeBandId`. Optional `cursor` param (ISO timestamp) for cursor-based pagination — returns `has_more` boolean and `next_cursor` for stable infinite scroll. Ordering is recency only. Own postings and previously-interacted postings are excluded at the DB level (not post-fetch) so the 50-row batch size applies to genuinely discoverable jobs. `certificationId` uses `.contains()` on the `required_certification_ids` array (special value `none` filters for jobs with no cert requirements via `.eq('required_certification_ids', '{}')`); `experienceBracketId` uses `.eq()` — both are DB-level. `sizeBandId` is a post-fetch filter on vessel data (from `get_vessel_public` RPC) since size band is resolved server-side. Applying is gated end-to-end: the UI blocks apply actions when availability is not set or explicitly not-available, and the apply API (`POST /api/daywork/:id/apply`) enforces the same check server-side, returning 403 for crew without active availability windows.
- My Applications (`GET /api/daywork/applications`): crew-only route returning pending applications (`applied`, `viewed`, `shortlisted`) with hydrated daywork details and NDA-safe vessel names. Displayed in the "Applied" tab on the Discover page. Withdraw uses the existing `POST /api/daywork/:id/withdraw` which appends `APPLICATION.WITHDRAWN` to the ledger.
- Applicants (`GET /api/daywork/:id/applicants`): employer-only route returning enriched applicants for a posting. Optional query params: `certificationId` (uuid — filters applicants whose profile `certification_ids` includes this cert), `minAvailableDays` (number — filters applicants with `available_days >= N`). Filters are post-enrichment since availability overlap is computed in JS. Enrichment adds `available_days`, `availability_city`, `availability_not_available`, and `past_daywork_count` to each applicant.
- Available Crew (`GET /api/daywork/:id/available-crew`): employer-only route returning crew with matching availability in the same city who haven't applied or been invited. Requires active daywork owned by the caller. Default: filters by daywork's `role_id`; pass `allRoles=true` to skip role filter. Excludes: employer themselves, crew who already applied, crew already invited. Returns `{ crew, invitation_count, invitation_limit: 2 }`. Sorted by `available_days` DESC, limited to 50.
- Invite (`POST /api/daywork/:id/invite`): employer-only route to send a daywork invitation. Body: `{ crewPersonId }`. Validates crew exists, has no existing application or invitation, and pending invitation count < 2. Appends `DAYWORK.INVITED` event. Returns `{ invitation: { id, status } }` with 201.
- Invitations (`GET /api/daywork/invitations`): crew-only route returning pending invitations with hydrated daywork details (role, vessel, location, dates, rate, job number), employer display name, and NDA-safe vessel data. Batch-fetches dayworks, employer profiles, and vessels via `get_vessel_public` RPC.
- Invitation Respond (`POST /api/daywork/invitations/:id/respond`): crew-only route. Body: `{ action: 'accept' | 'decline' }`. Accept validates availability and atomically appends `DAYWORK.INVITATION_ACCEPTED` + `DAYWORK.APPLIED` via `appendEvents`. Decline appends `DAYWORK.INVITATION_DECLINED`. Guards: crew hat, invitation ownership, pending status, active daywork.
- My Jobs (`GET /api/daywork/mine`) supports `status`, `roleId`, and `portId` query params.
- Daywork postings require `dayRate` (positive number) and `currency` (EUR/USD/GBP/AED, defaults to EUR). Day rate is NOT optional.
- Employer cancellation (`POST /api/engagements/:id/cancel-employer`) requires structured reason: `reason_category`, optional `reason_text`, `relist_requested`, optional `relist_reason_category`/`relist_reason_text`. Relist reasons are employer-private.
- Crew cancellation (`POST /api/engagements/:id/cancel-crew`) requires structured reason: `reason_category` (`personal_reasons`, `found_other_work`, `unsafe_conditions`, `other`), optional `reason_text`. Daywork stays `in_progress` — employer decides relist vs cancel.
- Respond to crew cancel (`POST /api/engagements/:id/respond-crew-cancel`): employer chooses `{ action: 'relist' }` or `{ action: 'cancel' }` after crew-initiated cancellation.
- Postponement proposal (`POST /api/engagements/:id/propose-postponement`): once-only per engagement. Blocked when work has started (`work_started_status = 'confirmed'`). Returns `{ outcome: 'conflict' }` without acting when crew has scheduling conflict; employer must confirm with `confirm_conflict: true` to cancel and relist.
- Postponement response (`POST /api/engagements/:id/respond-postponement`): crew accepts or rejects proposed dates. Rejection cancels engagement but does NOT auto-relist.
- Relist with dates (`POST /api/engagements/:id/relist-with-dates`): employer manually relists after crew rejection using proposed dates stored on the engagement.
- Work started (`POST /api/engagements/:id/work-started`): mutual confirmation that work has begun. Either party initiates (`action: 'initiate'`), the other confirms (`action: 'confirm'`). Once confirmed, postponement is blocked.
- Rating (`POST /api/engagements/:id/rate`) now accepts both `completed` and `cancelled` engagements. Cancelled context has a lighter rating form.
- Checklist set (`POST /api/engagements/:id/checklist`): employer sets or updates pre-arrival checklist. Body: `{ items: [{ id, label, value }] }`. Emits `CHECKLIST.SET` + system message. Resets crew acknowledgements on update.
- Checklist toggle (`POST /api/engagements/:id/checklist/toggle`): crew toggles acknowledgement of a single item. Body: `{ item_id, checked }`. Emits `CHECKLIST.ITEM_TOGGLED`.
- Availability (`POST /api/availability`): crew sets availability. Normal mode requires `startDate`, `endDate`, and `cityId` (town-level FK to cities). Optional `portId` (FK to ports, validated to belong to cityId). Enforces 14-day rolling window (today through today+13). Hard 7-day expiry. "Not available" mode: `{ notAvailable: true, cityId }` — skips date validation, writes single marker row. `DELETE /api/availability` clears specific dates (`{ dates: [...] }`) or all availability (`{ clearAll: true }`). `GET /api/availability` returns windows with `city_id`, `port_id`, resolved city and port names, and `status` field (`available` | `not_available` | `null`).
- Settings page (`/settings`): accessible via gear icon on profile header. Account management (change password/email, sign out), appearance (distance & size units with km/mi+ft/NM options, currency display — localStorage), privacy & data (GDPR data export as JSON, account deletion via `PERSON.DEACTIVATED`), and about info. Sign out moved from profile to settings.
- Unit conversion system (`src/lib/units.ts`): centralized currency symbols (`currencySymbol()`), distance conversion (km/mi/NM via `convertDistance()`), length conversion (m/ft via `metersToFeet()`/`feetToMeters()`), vessel size band label converter (`convertSizeBandLabel()`). `src/hooks/use-preferences.ts` reads localStorage preferences (defaults: EUR, km). Forms default currency to user preference. Vessel sizes display in user's preferred unit (metres or feet for imperial users).
- Vessel creation (`POST /api/vessels`): accepts `loaMeters` (exact LOA in metres) instead of `sizeBandId`. Size band is auto-derived from LOA by querying `vessel_size_bands` ordered by `min_meters`. Returns 400 if LOA doesn't match any band. The create form accepts LOA in the user's preferred unit (m or ft) and shows the auto-derived band as a hint. Open to all authenticated users (crew can create vessels for experience entries). IMO uniqueness is per-registrant (`UNIQUE(imo_number, owner_person_id)`).
- Vessel update (`PATCH /api/vessels/[id]`): updates vessel fields (name, vesselType, loaMeters, ndaFlag). LOA changes auto-derive size band. NDA immutability guard: returns 400 if trying to set `ndaFlag: false` when current value is `true`. Owner-only. Note: `vesselOperation` removed from vessels (Stage 69 — soft data lives on crew_experiences).
- Vessel lookup (`GET /api/vessels/lookup?imo=`): returns existing vessel data for IMO suggestion during experience entry. Any authenticated user can look up. Returns `{ found: boolean, vessel? }`.
- Crew experiences (`GET/POST /api/experiences`, `PATCH/DELETE /api/experiences/[id]`): CRUD for crew experience history. Salary fields stored server-side but NEVER returned in API responses. POST validates required fields (vesselId, roleId, startDate, vesselOperation), vessel operation (private/charter), contract type, end-date >= start-date, description length (250 chars). PATCH/DELETE verify ownership.
- Onboarding (`POST /api/onboarding`): extended to accept `experiences` array for experienced crew. Each entry triggers vessel creation (if needed) + `EXPERIENCE.ADDED` event. Green crew fields (`shoreExperience`, `motivation`, `languages`, `availableToStart`) passed through to `PROFILE.CREATED` payload. `onboarding_version: 2` set for all new onboardings.
- Push tokens (`POST /api/push-tokens`): upserts device token for push notifications. Body: `{ token: string, platform: 'apns' | 'fcm' | 'web' }`. Returns 201. (`DELETE /api/push-tokens`): removes token. Body: `{ token: string }`. Returns 200. Both require authentication. Client-side `push-notifications.ts` handles registration (with localStorage change detection) and sign-out cleanup (`deregisterPushToken()`).
- Daywork extend (`POST /api/daywork/:id/extend`): extends an active posting's end_date. Body: `{ endDate: string, workingDays?: number, workingDayDates?: string[] }`. Validates ownership, active status, endDate >= today. Appends `DAYWORK.EXTENDED` event.
- Daywork post (`POST /api/daywork`): now accepts optional `workingDayDates` string array and optional `positionsAvailable` (default 1, range 1-20). When `workingDayDates` provided, `workingDays` is derived from array length. Validates dates within range and no duplicates.
- Message read cursor (`POST /api/messages/:engagementId/read`): upserts read cursor for current user on engagement. Called on chat mount and visibility change.
- Notifications (`GET /api/notifications`): lists notifications for current user, supports `?unread_only=true`. Returns `{ notifications, unread_count }`.
- Notifications read (`POST /api/notifications/read`): marks notifications as read. Body: `{ notificationIds: string[] }` or `{ all: true }`.
- Notifications count (`GET /api/notifications/count`): lightweight combined unread count (notifications + messages) for badge polling.
- Profile avatar (`POST /api/profile/avatar`): multipart form upload, validates JPEG/PNG/WebP and <=2MB, uploads to Supabase Storage `avatars/{userId}/avatar.{ext}`, appends `PROFILE.UPDATED` event. (`DELETE /api/profile/avatar`): removes file from storage, sets avatar_url to null.
- Daywork update positions (`POST /api/daywork/:id/update-positions`): employer-only. Body: `{ positionsAvailable: number }`. Validates >= 1, >= current filled count, <= 20, daywork must be active. Appends `DAYWORK.POSITIONS_UPDATED` event. Projection handles fill-triggered transition to `in_progress`.
- View profile (`GET /api/profile/[personId]`): context-gated read-only view of another user's profile. Requires engagement, application, or invitation relationship. Crew profiles include experiences (no salary), certifications, vessel size exposure. Employer profiles include non-NDA vessels, role specializations, active posting count. Returns 403 if no context.
- Account deactivation (`POST /api/account/deactivate`): appends `PERSON.DEACTIVATED` event. Sets `deactivated_at` on `persons` via projection. Profile hidden immediately via RLS filter. Data scrub is a deferred admin process.
- Account data export (`GET /api/account/export`): GDPR data portability. Returns JSON with profile, events, messages, engagements, availability, vessels, and preferences.
- Location selection uses the `LocationPicker` component (`src/components/location-picker.tsx`) — a searchable hierarchical Region → City → Port/Marina popover. Two modes: `port-required` (post-daywork, profile, onboarding, discover filters) requires a specific port selection; `port-optional` (availability overlay) allows city-only selection with optional port drill-down. The component self-fetches location data from Supabase.
