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

## Architectural Notes

- Core domain state is event-sourced through `append_event`.
- `daywork_templates` and `user_preferences` are intentional exceptions: they are owner-scoped CRUD utility data and not part of the ledger.
- NDA vessel exposure for crew goes through `get_vessel_public`, not direct vessel table reads.
- Onboarding is atomic through `onboard_person`, which appends `PERSON.CREATED` and `PROFILE.CREATED` together.
- All domain routes (read and write) use `requireDomainUser()` from `src/lib/auth/require-domain-user.ts`. This guard returns 401 for unauthenticated users and 409 for users missing `persons` or `profiles` rows. Only `auth/me` and `onboarding` are excluded.
- Discovery (`GET /api/daywork/discover`) is open: crew see all active postings. Filters are explicit: `roleId`, `portId`, `startDate`, `endDate`. Ordering is recency only. Own postings and previously-interacted postings are excluded at the DB level (not post-fetch) so the 50-row limit applies to genuinely discoverable jobs. Applying is gated end-to-end: the UI blocks apply actions when availability is not set or explicitly not-available, and the apply API (`POST /api/daywork/:id/apply`) enforces the same check server-side, returning 403 for crew without active availability windows.
- My Applications (`GET /api/daywork/applications`): crew-only route returning pending applications (`applied`, `viewed`, `shortlisted`) with hydrated daywork details and NDA-safe vessel names. Displayed in the "Applied" tab on the Discover page. Withdraw uses the existing `POST /api/daywork/:id/withdraw` which appends `APPLICATION.WITHDRAWN` to the ledger.
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
- Settings page (`/settings`): accessible via gear icon on profile header. Account management (change password/email, sign out), appearance (theme, distance units, currency display — all localStorage), privacy & data (profile visibility toggle for crew, GDPR data export as JSON, account deletion via `PERSON.DEACTIVATED`), and about info. Sign out moved from profile to settings.
- Preferences (`GET/PATCH /api/preferences`): upserts `user_preferences` row. Currently supports `profile_visible` boolean (crew only). CRUD, not event-sourced.
- Account deactivation (`POST /api/account/deactivate`): appends `PERSON.DEACTIVATED` event. Sets `deactivated_at` on `persons` via projection. Profile hidden immediately via RLS filter. Data scrub is a deferred admin process.
- Account data export (`GET /api/account/export`): GDPR data portability. Returns JSON with profile, events, messages, engagements, availability, vessels, and preferences.
- Location selection uses the `LocationPicker` component (`src/components/location-picker.tsx`) — a searchable hierarchical Region → City → Port/Marina popover. Two modes: `port-required` (post-daywork, profile, onboarding, discover filters) requires a specific port selection; `port-optional` (availability overlay) allows city-only selection with optional port drill-down. The component self-fetches location data from Supabase.
