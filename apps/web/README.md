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
- `daywork_templates` is an intentional exception: it is owner-scoped CRUD utility data and not part of the ledger.
- NDA vessel exposure for crew goes through `get_vessel_public`, not direct vessel table reads.
- Onboarding is atomic through `onboard_person`, which appends `PERSON.CREATED` and `PROFILE.CREATED` together.
- All domain routes (read and write) use `requireDomainUser()` from `src/lib/auth/require-domain-user.ts`. This guard returns 401 for unauthenticated users and 409 for users missing `persons` or `profiles` rows. Only `auth/me` and `onboarding` are excluded.
- Discovery (`GET /api/daywork/discover`) is open: crew see all active postings without availability gating. Filters are explicit: `roleId`, `portId`, `startDate`, `endDate`. Ordering is recency only.
- My Jobs (`GET /api/daywork/mine`) supports `status`, `roleId`, and `portId` query params.
- Daywork postings require `dayRate` (positive number) and `currency` (EUR/USD/GBP/AED, defaults to EUR). Day rate is NOT optional.
