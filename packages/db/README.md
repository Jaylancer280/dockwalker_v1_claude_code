# @dockwalker/db

Database helper functions for the DockWalker monorepo. Wraps Supabase client creation and core RPCs.

Depends on `@supabase/supabase-js` and `@dockwalker/types`.

## Files

| File            | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client.ts` | `createClient()` (anon key, browser-side), `createServiceClient()` (service role key, server-side), `createMobileClient(url, anonKey, storage)` (explicit params + storage adapter for mobile)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/events.ts` | `appendEvent<T>()` — generic typed helper that calls `append_event` RPC; payload type is constrained by `EventPayloadMap[T]` for compile-time validation. Accepts an optional `idempotencyKey?: string` (since Fix 257 / migration 00124) — when supplied, a retry of the same event from the same person resolves to the original event id without re-running the projection. `appendEvents<T>()` — batch helper that calls `append_events_batch` RPC for 2+ events in a single transaction (all-or-nothing); falls back to `appendEvent` for single events. `checkNoOverlap()` — calls `check_no_overlap` RPC to verify no date conflicts before accepting crew. `checkNoOverlapExcluding()` — like `checkNoOverlap` but takes explicit dates and excludes a specific engagement ID (for postponement proposals). `AppendEventParams<T>` type exported for external use. |
| `src/index.ts`  | Barrel re-export of client and event functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-side only)

## Usage

```ts
import { createServiceClient, appendEvent } from '@dockwalker/db';

const supabase = createServiceClient();
const eventId = await appendEvent(supabase, {
  eventType: 'DAYWORK.POSTED',
  aggregateId: dayworkId,
  aggregateType: 'daywork',
  roleContext: 'employer',
  payload: { ... },
  personId: userId,
});
```

## Scripts

```bash
npm run type-check   # tsc --noEmit
```
