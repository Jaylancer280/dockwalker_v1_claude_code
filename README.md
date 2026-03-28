# DockWalker

A hyper-focused, two-sided, real-time daywork hiring app for the superyacht industry. Crew seeking short-term work (1-14 day engagements) are matched with employers who need immediate cover via a Tinder-like swipe mechanic.

For the full product mission, design principles, and assessment criteria, see [DockWalker Mission](./dockwalker_mission.md).

## Monorepo Structure

```
apps/web/          Next.js 16 app (pages, API routes, Supabase auth)
apps/mobile/       Expo/React Native app (iOS + Android)
packages/types/    Shared TypeScript types (events, enums, models)
packages/db/       Database helpers (Supabase client, event append, overlap check)
packages/shared/   Shared pure business logic (units, languages, epaulettes)
supabase/          Migrations, rollbacks, seed data, config
turbo.json         Turborepo pipeline config
```

## Quick Start

```bash
npm install
npx supabase start
npx supabase db reset
npm run dev
```

See [apps/web/README.md](./apps/web/README.md) for detailed setup, environment variables, and available scripts.

## Architecture

- Event-sourced domain state via append-only ledger
- Supabase (PostgreSQL + RLS) for database and auth
- All domain events flow through `append_event` RPC
- Expo/React Native for native iOS and Android builds

See [CLAUDE.md](./CLAUDE.md) for architectural invariants, and [BUILD_STATE.md](./BUILD_STATE.md) for current build progress.
