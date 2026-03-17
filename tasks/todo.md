# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 91b: Stripe Webhook person_id Fix

---

## Queue

---

### Stage 91b: Stripe Webhook person_id Fix

**Goal:** Fix a bug where the `checkout.session.completed` webhook cannot resolve the person_id, causing the subscription upsert to fail.

**Bug:** In `create-checkout/route.ts`, `person_id` metadata is set on the Stripe **customer** object (`stripe.customers.create({ metadata: { person_id } })`). But in `webhooks/stripe/route.ts`, the webhook reads `session.metadata?.person_id` — that's the **session** metadata, which was never set. Result: `person_id` is `undefined`, the upsert writes `person_id: ''`, and the FK constraint to `persons(id)` fails.

**Fix:** Two changes needed — belt and suspenders.

- [x] Edit `apps/web/src/app/api/billing/create-checkout/route.ts` — add `metadata: { person_id: user.id }` to the `stripe.checkout.sessions.create()` call so the session itself carries the person_id:

  ```typescript
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?success=true`,
    cancel_url: `${origin}/billing?cancelled=true`,
    metadata: { person_id: user.id },
  });
  ```

- [x] Edit `apps/web/src/app/api/webhooks/stripe/route.ts` — add a fallback chain in `checkout.session.completed` handler. Try session metadata first, then look up the customer to get person_id from customer metadata or from the DB:

  ```typescript
  case 'checkout.session.completed': {
    const session = event.data.object;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    // Resolve person_id: session metadata (primary), then DB lookup by stripe_customer_id (fallback)
    let personId = session.metadata?.person_id;
    if (!personId) {
      const { data: existing } = await serviceClient
        .from('subscriptions')
        .select('person_id')
        .eq('stripe_customer_id', customerId)
        .single();
      personId = existing?.person_id;
    }

    if (!personId || !subscriptionId) break;

    // ... rest of handler uses personId instead of session.metadata?.person_id
  ```

  The DB fallback works because `create-checkout` upserts a subscription row with `stripe_customer_id` before creating the Checkout Session.

- [x] Update `__tests__/api/webhooks-stripe.test.ts` — the `checkout.session.completed` test already passes `metadata: { person_id: 'u1' }` on the session object, so it tests the happy path. Add one more test: session metadata missing, fallback to DB lookup by `stripe_customer_id`. Mock `serviceClient.from('subscriptions').select().eq().single()` to return `{ person_id: 'u1' }`.

- [x] No migration or documentation changes needed (bug fix within existing stage)

---

### Stage 90b: Rate Limit Redis Caching Fix

**Goal:** Fix wasteful Redis instance creation on every request.

**Problem:** `getRedis()` in `apps/web/src/lib/rate-limit.ts` creates a new `Redis` instance on every call. The `Ratelimit` instances (`_globalLimit`, `_writeLimit`) are cached at module level, but Redis is not — so after the first request, every subsequent request allocates a throwaway `Redis` object that gets garbage collected immediately. Upstash Redis is a lightweight REST wrapper so this isn't a crash risk, but it's unnecessary object churn on every API request.

**Fix:** Cache the Redis instance at module level, same pattern as the Ratelimit instances.

- [x] Edit `apps/web/src/lib/rate-limit.ts` — add a `_redis` module-level cache:

  ```typescript
  let _redis: Redis | null | undefined = undefined;

  function getRedis(): Redis | null {
    if (_redis !== undefined) return _redis;
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redis = null;
      return null;
    }
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return _redis;
  }
  ```

  Use `undefined` as the "not yet initialised" sentinel so `null` can mean "env vars missing, don't retry".

- [x] Verify existing tests still pass (no test changes needed — behaviour is identical, just fewer allocations)
- [x] No documentation changes needed (internal optimisation)

---

### Stage 90: Rate Limiting (Vercel + Upstash)

**Goal:** Protect API routes from abuse and accidental flood. Global rate limiting at the middleware layer, with per-route tiers.

**Done condition:** An unauthenticated client hitting any API route 100+ times in 60 seconds gets a 429. An authenticated user hitting a write route (POST/PATCH/DELETE) 30+ times in 60 seconds gets a 429. Health check and GET routes have higher limits.

**Will NOT touch:** Existing route logic, auth, RLS, frontend code.

**Infra decision:** Vercel hosting → Upstash Redis (Vercel's recommended KV store for serverless rate limiting). Upstash has a generous free tier (10K requests/day) and a first-party `@upstash/ratelimit` package designed for edge/serverless.

#### 1. Dependencies

- [x] Run `cd apps/web && npm install @upstash/ratelimit @upstash/redis`
- [x] Add to `apps/web/.env.example` after the push notifications block:
  ```
  # Rate limiting — optional (no rate limiting when not configured)
  UPSTASH_REDIS_REST_URL=
  UPSTASH_REDIS_REST_TOKEN=
  ```
- [x] **Local dev:** Rate limiting is a no-op when env vars are missing (graceful degradation, same pattern as push notifications)

#### 2. Rate Limiter Helper — `apps/web/src/lib/rate-limit.ts`

- [x] Create file:

  ```typescript
  import { Ratelimit } from '@upstash/ratelimit';
  import { Redis } from '@upstash/redis';
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';

  let _globalLimit: Ratelimit | null = null;
  let _writeLimit: Ratelimit | null = null;

  function getRedis(): Redis | null {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  // Global: 100 requests per 60 seconds per IP
  function getGlobalLimit(): Ratelimit | null {
    const redis = getRedis();
    if (!redis) return null;
    if (!_globalLimit) {
      _globalLimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60 s'),
        prefix: 'rl:global',
      });
    }
    return _globalLimit;
  }

  // Write routes: 30 requests per 60 seconds per IP
  function getWriteLimit(): Ratelimit | null {
    const redis = getRedis();
    if (!redis) return null;
    if (!_writeLimit) {
      _writeLimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        prefix: 'rl:write',
      });
    }
    return _writeLimit;
  }

  export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const path = request.nextUrl.pathname;
    const method = request.method;

    // Skip rate limiting for health check
    if (path === '/api/health') return null;

    // Skip non-API routes (pages are not rate limited at this layer)
    if (!path.startsWith('/api/')) return null;

    // Global limit — all API requests
    const globalLimit = getGlobalLimit();
    if (globalLimit) {
      const { success, remaining, reset } = await globalLimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(remaining),
            },
          },
        );
      }
    }

    // Write limit — POST, PATCH, DELETE only
    if (['POST', 'PATCH', 'DELETE'].includes(method)) {
      const writeLimit = getWriteLimit();
      if (writeLimit) {
        const { success, remaining, reset } = await writeLimit.limit(`${ip}:write`);
        if (!success) {
          return NextResponse.json(
            { error: 'Too many requests' },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
                'X-RateLimit-Remaining': String(remaining),
              },
            },
          );
        }
      }
    }

    return null; // not rate limited
  }
  ```

#### 3. Wire into Proxy — `apps/web/src/proxy.ts`

**Critical architectural detail:** Rate limiting CANNOT go in `updateSession()` (`middleware.ts`). That function early-returns for `/api/` routes at line 33 (`if (path.startsWith('/api/')) return supabaseResponse`) — so any rate limiting code inside it would never execute for API requests, which are the main target.

Rate limiting goes in `proxy.ts` BEFORE `updateSession()`:

- [x] Edit `apps/web/src/proxy.ts`:

  ```typescript
  import { type NextRequest } from 'next/server';
  import { updateSession } from '@/lib/supabase/middleware';
  import { checkRateLimit } from '@/lib/rate-limit';

  export async function proxy(request: NextRequest) {
    // Rate limit check runs first — rejects before any auth/DB work
    const rateLimitResponse = await checkRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    return await updateSession(request);
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  };
  ```

  - This ensures rate-limited requests never hit Supabase auth or DB — true early exit

**Runtime note:** `proxy.ts` runs as Next.js middleware (Edge-compatible on Vercel). `@upstash/ratelimit` and `@upstash/redis` use REST calls (no TCP), so they work at the Edge. This is why Upstash was chosen over a raw Redis client.

#### 4. Webhook Exemption

- [x] In `checkRateLimit()`, also skip `/api/webhooks/stripe` (Stage 91) — Stripe retries on 429 and has its own rate limiting. Keying on IP would block legitimate webhook bursts.
  ```typescript
  if (path === '/api/health' || path.startsWith('/api/webhooks/')) return null;
  ```

#### 5. Tests

- [x] `__tests__/lib/rate-limit.test.ts` — 6 tests (5 planned + 1 webhook exemption):
  1. Returns null when env vars not configured (graceful no-op)
  2. Returns null for `/api/health` (exempt)
  3. Returns null for non-API paths (pages not rate limited)
  4. Returns 429 when global limit exceeded (mock Ratelimit to return `{ success: false }`)
  5. Returns 429 on write limit exceeded (POST request, mock write limit failure)

  Mock strategy:

  ```typescript
  vi.mock('@upstash/ratelimit', () => ({
    Ratelimit: vi.fn().mockImplementation(() => ({
      limit: vi.fn(),
    })),
  }));
  vi.mock('@upstash/redis', () => ({
    Redis: vi.fn(),
  }));
  ```

#### 6. Documentation

- [x] Update `apps/web/README.md` — new env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), rate limiting section explaining limits (100/60s global, 30/60s writes), how to set up Upstash (create store in Vercel dashboard or upstash.com, copy REST URL + token)
- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 90] Rate limiting — Upstash Redis via middleware, 100/60s global + 30/60s write limits, exempt health + webhooks`
  - No migration (no DB changes)
  - Deferred decision: `Per-user rate limiting (requires keying on user ID from auth session — adds latency since auth check must run before rate limit)`

---

### Stage 91: Stripe Subscription Scaffolding

**Goal:** Payment infrastructure that any premium feature can use. No AI dependency.

**Done condition:** A crew member can subscribe to a plan, Stripe webhooks update their subscription status, and premium API routes can check subscription status before proceeding.

**Will NOT touch:** AI advisor, discovery, messaging, existing API routes (except adding subscription check helper).

#### 1. Dependencies

- [x] Run `cd apps/web && npm install stripe` (server-side SDK only)
- [x] Add to `apps/web/.env.example` after the push notifications block:
  ```
  # Stripe — optional (subscriptions disabled when not configured)
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  STRIPE_PRICE_CREW_PRO=
  STRIPE_PRICE_CREW_UNLIMITED=
  ```

#### 2. Types — `packages/types/src/`

- [x] Add to `packages/types/src/enums.ts`:
  ```typescript
  export type SubscriptionPlan = 'free' | 'crew_pro' | 'crew_unlimited';
  export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';
  ```
- [x] Add to `packages/types/src/models.ts` (import `SubscriptionPlan`, `SubscriptionStatus` from `./enums`):
  ```typescript
  export interface Subscription {
    id: string;
    person_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string | null;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string;
    updated_at: string;
  }
  ```
- [x] Both are already re-exported via `index.ts` (barrel exports `./enums` and `./models`)

#### 3. Migration — `supabase/migrations/00042_subscriptions.sql`

NOT event-sourced — Stripe-owned state, same precedent as `user_preferences`, `device_tokens`, `daywork_templates`. No `apply_projection` changes needed.

- [x] Create migration file with this exact SQL:

  ```sql
  -- =============================================================================
  -- Migration 00042: Subscriptions
  --
  -- 1. Create subscriptions table
  -- 2. RLS policies (owner read-only, service role writes)
  -- 3. Indexes
  -- =============================================================================

  -- ---------------------------------------------------------------------------
  -- 1. Subscriptions table
  -- ---------------------------------------------------------------------------
  create table public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references public.persons(id) unique,
    stripe_customer_id text not null unique,
    stripe_subscription_id text,
    plan text not null default 'free' check (plan in ('free', 'crew_pro', 'crew_unlimited')),
    status text not null default 'active' check (status in ('active', 'past_due', 'cancelled', 'trialing')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- ---------------------------------------------------------------------------
  -- 2. RLS — owner can read, only service role can write
  -- ---------------------------------------------------------------------------
  alter table public.subscriptions enable row level security;

  create policy "Owner can read own subscription"
    on public.subscriptions for select
    to authenticated
    using (person_id = auth.uid());
  ```

- [x] Create rollback `supabase/rollbacks/00042_subscriptions.down.sql`:
  ```sql
  -- =============================================================================
  -- Rollback 00042: Subscriptions
  -- =============================================================================
  drop policy if exists "Owner can read own subscription" on public.subscriptions;
  drop table if exists public.subscriptions;
  ```

#### 4. Stripe Client — `apps/web/src/lib/stripe.ts`

- [x] Create new file. Pattern: direct `process.env` read, graceful no-op when unconfigured (same as push-delivery.ts pattern).

  ```typescript
  import Stripe from 'stripe';

  let _stripe: Stripe | null = null;

  export function getStripe(): Stripe | null {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-04-30.basil', // use latest stable at time of implementation
        typescript: true,
      });
    }
    return _stripe;
  }
  ```

  Note: check the latest Stripe API version when implementing. The `apiVersion` string must match what's available.

#### 5. API Routes

All routes follow the existing pattern: import `requireDomainUser` from `@/lib/auth/require-domain-user`, destructure `{ user, person, supabase, serviceClient }` from `guard.value`, wrap handler body in try/catch, return `NextResponse.json(...)`.

**5a. `POST /api/billing/create-checkout`**

- [x] Create `apps/web/src/app/api/billing/create-checkout/route.ts`
- Pattern: `requireDomainUser()` guard → validate `plan` from body (`crew_pro` or `crew_unlimited`) → map plan to price ID from env (`STRIPE_PRICE_CREW_PRO` / `STRIPE_PRICE_CREW_UNLIMITED`) → check existing subscription row for `stripe_customer_id` → if none, create Stripe customer via `stripe.customers.create({ email, metadata: { person_id } })` → upsert subscription row with `stripe_customer_id` using `serviceClient` → create Checkout Session via `stripe.checkout.sessions.create({ customer, mode: 'subscription', line_items: [{ price: priceId, quantity: 1 }], success_url, cancel_url })` → return `{ url: session.url }`
- `success_url`: `${origin}/billing?success=true`
- `cancel_url`: `${origin}/billing?cancelled=true`
- Return 400 if `plan` invalid, 500 if Stripe not configured (`getStripe()` returns null), 500 on Stripe API error
- `request.headers.get('origin')` or `process.env.NEXT_PUBLIC_APP_URL` for URL base

**5b. `POST /api/billing/create-portal`**

- [x] Create `apps/web/src/app/api/billing/create-portal/route.ts`
- Pattern: `requireDomainUser()` guard → fetch subscription row from `supabase.from('subscriptions').select('stripe_customer_id').eq('person_id', user.id).single()` → 404 if no row → create portal session via `stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url })` → return `{ url: session.url }`
- `return_url`: `${origin}/billing`

**5c. `GET /api/billing/status`**

- [x] Create `apps/web/src/app/api/billing/status/route.ts`
- Pattern: `requireDomainUser()` guard → fetch subscription row: `supabase.from('subscriptions').select('plan, status, current_period_end').eq('person_id', user.id).single()` → if no row or error, return `{ plan: 'free', status: null }` → otherwise return `{ plan: row.plan, status: row.status, current_period_end: row.current_period_end }`

**5d. `POST /api/webhooks/stripe`**

- [x] Create `apps/web/src/app/api/webhooks/stripe/route.ts`
- **NO `requireDomainUser()` — this is a public endpoint like `/api/health`**. Stripe authenticates via signature.
- Must read raw body for signature verification: `const body = await request.text()`
- Verify: `stripe.webhooks.constructEvent(body, request.headers.get('stripe-signature')!, process.env.STRIPE_WEBHOOK_SECRET!)`
- Catch verification error → return 400
- Import `createServiceClient` directly from `@/lib/supabase/server` (no auth guard, need service role for DB writes)
- Handle these Stripe event types:
  - `checkout.session.completed`: extract `customer`, `subscription` from event.data.object → fetch subscription from Stripe API (`stripe.subscriptions.retrieve(subscriptionId)`) to get plan/status/period → upsert subscription row using `serviceClient.from('subscriptions').upsert({ person_id (from customer metadata), stripe_customer_id, stripe_subscription_id, plan (map price ID to plan name), status, current_period_start, current_period_end }, { onConflict: 'person_id' })`
  - `customer.subscription.updated`: extract subscription object → update row by `stripe_subscription_id`
  - `customer.subscription.deleted`: update status to `cancelled` by `stripe_subscription_id`
- Plan mapping: compare `subscription.items.data[0].price.id` against `STRIPE_PRICE_CREW_PRO` and `STRIPE_PRICE_CREW_UNLIMITED` env vars
- Return `{ received: true }` with status 200 for all handled events
- Return 200 for unhandled event types too (Stripe retries on non-2xx)

**Critical:** Next.js App Router doesn't expose raw body by default. Use `request.text()` to get the raw body string. Do NOT use `request.json()` before signature verification — that consumes the body.

#### 6. Subscription Check Helper

- [x] Create `apps/web/src/lib/require-subscription.ts`
- Pattern mirrors `requireDomainUser` — returns discriminated union:

  ```typescript
  import { NextResponse } from 'next/server';
  import type { SupabaseClient } from '@supabase/supabase-js';
  import type { SubscriptionPlan } from '@dockwalker/types';

  const PLAN_RANK: Record<SubscriptionPlan, number> = {
    free: 0,
    crew_pro: 1,
    crew_unlimited: 2,
  };

  type SubscriptionResult =
    | { ok: true; plan: SubscriptionPlan }
    | { ok: false; response: NextResponse };

  export async function requireSubscription(
    supabase: SupabaseClient,
    personId: string,
    minimumPlan: 'crew_pro' | 'crew_unlimited',
  ): Promise<SubscriptionResult> {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('person_id', personId)
      .single();

    const plan: SubscriptionPlan = data?.plan ?? 'free';
    const isActive = data?.status === 'active' || data?.status === 'trialing';

    if (!isActive || PLAN_RANK[plan] < PLAN_RANK[minimumPlan]) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Subscription required', minimum_plan: minimumPlan },
          { status: 402 },
        ),
      };
    }
    return { ok: true, plan };
  }
  ```

- Note: takes `supabase` and `personId` as params (not a guard itself — composed with `requireDomainUser`)

#### 7. Tests — `apps/web/__tests__/api/`

All test files follow the same mock pattern. Reference `__tests__/api/push-tokens.test.ts` for structure.

**Test import pattern** — import route handler functions directly:

```typescript
import { POST } from '@/app/api/billing/create-checkout/route';
import { GET } from '@/app/api/billing/status/route';
```

Call with: `const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({...}) }));`

**Mock setup shared across all billing tests:**

```typescript
const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

// Mock Stripe SDK
const mockStripe = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
};
vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockStripe,
}));
```

**Guard helper (reuse across tests):**

```typescript
function guardOk(overrides = {}) {
  const mockFrom = vi.fn();
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { from: vi.fn() },
      ...overrides,
    },
  };
}
```

- [x] `__tests__/api/billing-checkout.test.ts` — 4 tests:
  1. 401 unauth (guard returns `{ ok: false }`)
  2. 400 invalid plan (body `{ plan: 'invalid' }`)
  3. 201 happy path — new customer (no existing subscription row → creates customer → creates session → returns URL). Assert `mockStripe.customers.create` called, `mockStripe.checkout.sessions.create` called with correct price ID
  4. 201 happy path — existing customer (subscription row exists with `stripe_customer_id` → skips customer creation → creates session)

- [x] `__tests__/api/billing-portal.test.ts` — 3 tests:
  1. 401 unauth
  2. 404 no subscription row
  3. 200 happy path — returns portal URL

- [x] `__tests__/api/billing-status.test.ts` — 3 tests:
  1. 401 unauth
  2. 200 returns `{ plan: 'free' }` when no subscription row
  3. 200 returns plan + status when subscribed

- [x] `__tests__/api/webhooks-stripe.test.ts` — 4 tests:
  1. 400 invalid signature (`mockStripe.webhooks.constructEvent` throws)
  2. 200 handles `checkout.session.completed` — assert upsert to subscriptions table
  3. 200 handles `customer.subscription.updated` — assert update by `stripe_subscription_id`
  4. 200 handles `customer.subscription.deleted` — assert status set to `cancelled`
     Note: This route does NOT use `requireDomainUser`. Import `createServiceClient` mock directly:
  ```typescript
  const mockServiceClient = { from: vi.fn() };
  vi.mock('@/lib/supabase/server', () => ({
    createServiceClient: () => Promise.resolve(mockServiceClient),
  }));
  ```

#### 8. Documentation

- [x] Update `apps/web/README.md` — add Stripe env vars to the env table, add billing routes to the API routes section, add "Stripe Setup" section (create products in Stripe dashboard, copy price IDs to env, set webhook endpoint to `/api/webhooks/stripe`, select `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` events)
- [x] Update `packages/types/README.md` — add `Subscription`, `SubscriptionPlan`, `SubscriptionStatus` to the exports list
- [x] Update `BUILD_STATE.md`:
  - Completed Stages: add `[Stage 91] Stripe subscription scaffolding — subscriptions table, checkout/portal/status/webhook routes, subscription check helper`
  - Schema version: bump to `v42 — subscriptions (42 migrations applied)`
  - Migration table: add `00042_subscriptions.sql` row
  - Deferred decisions: add `Stripe product/price creation and dashboard setup (required before subscriptions work in any environment)`
- [x] **Pre-commit will fail** if BUILD_STATE.md schema version doesn't match migration file count. The check script counts `supabase/migrations/*.sql` files and compares to the version number in BUILD_STATE.md. Update version BEFORE committing.

---

### Stage 92: Docky Phase 1 — MCA Knowledge Base + Chat UI

**Goal:** Crew can ask general maritime career questions and get answers sourced from MCA documentation. No personalisation yet.

**Done condition:** Crew taps the Docky tab, starts a conversation, asks "What certs do I need to become a Bosun?", and gets an accurate answer from the LLM's general maritime knowledge. MCA source citations will appear once documents are ingested (deferred), but the RAG pipeline, chat UI, and conversation persistence all work end-to-end.

**Will NOT touch:** Employer hat, discovery, existing messages, profiles, Stripe (no paywall yet).

**Naming:** Tab = "Docky", icon = `LifeBuoy` (lucide-react), route = `/docky`

**LLM stack:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for generation + OpenAI `text-embedding-3-small` for embeddings (1536 dims)

**MCA corpus: DEFERRED.** The pgvector table and RAG pipeline are built in this stage, but no documents are ingested yet. Docky operates on the LLM's general maritime knowledge. When the RAG search returns empty, the system prompt tells the LLM to answer from general knowledge with appropriate caveats. MCA document ingestion will be a separate future stage.

#### 1. Dependencies

- [ ] Run `cd apps/web && npm install @anthropic-ai/sdk openai`
- [ ] Add to `apps/web/.env.example` after the Stripe block:
  ```
  # AI Advisor (Docky) — optional (tab hidden when not configured)
  ANTHROPIC_API_KEY=
  OPENAI_API_KEY=
  DOCKY_MODEL=claude-haiku-4-5-20251001
  ```

#### 2. Migrations

**Migration numbering:** If Stage 91 ships first, these are 00043 + 00044. If Stage 92 ships first, use 00042 + 00043. Adjust numbers based on what's already in `supabase/migrations/` at implementation time. Below assumes Stage 91 shipped (00042 taken).

**2a. `supabase/migrations/00043_pgvector_and_mca_chunks.sql`**

- [ ] Create migration:

  ```sql
  -- =============================================================================
  -- Migration 00043: pgvector Extension + MCA Document Chunks
  --
  -- 1. Enable pgvector extension
  -- 2. Create mca_document_chunks table
  -- 3. HNSW index for cosine similarity
  -- 4. match_mca_documents RPC
  -- 5. RLS
  -- =============================================================================

  -- ---------------------------------------------------------------------------
  -- 1. pgvector extension
  -- ---------------------------------------------------------------------------
  create extension if not exists vector with schema extensions;

  -- ---------------------------------------------------------------------------
  -- 2. MCA chunks table
  -- ---------------------------------------------------------------------------
  create table public.mca_document_chunks (
    id uuid primary key default gen_random_uuid(),
    content text not null,
    embedding extensions.vector(1536) not null,
    source_document text not null,
    source_url text,
    page_number int,
    section_title text,
    chunk_index int,
    created_at timestamptz not null default now()
  );

  -- ---------------------------------------------------------------------------
  -- 3. HNSW index (preferred for <10K rows)
  -- ---------------------------------------------------------------------------
  create index mca_chunks_embedding_idx
    on public.mca_document_chunks
    using hnsw (embedding extensions.vector_cosine_ops);

  -- ---------------------------------------------------------------------------
  -- 4. Similarity search RPC
  -- ---------------------------------------------------------------------------
  create or replace function public.match_mca_documents(
    query_embedding extensions.vector(1536),
    match_count int default 5,
    match_threshold float default 0.7
  )
  returns table (
    id uuid,
    content text,
    source_document text,
    source_url text,
    section_title text,
    similarity float
  )
  language plpgsql
  security definer
  as $$
  begin
    return query
    select
      mca.id,
      mca.content,
      mca.source_document,
      mca.source_url,
      mca.section_title,
      1 - (mca.embedding <=> query_embedding) as similarity
    from public.mca_document_chunks mca
    where 1 - (mca.embedding <=> query_embedding) > match_threshold
    order by mca.embedding <=> query_embedding
    limit match_count;
  end;
  $$;

  -- ---------------------------------------------------------------------------
  -- 5. RLS — service role writes, authenticated reads via RPC
  -- ---------------------------------------------------------------------------
  alter table public.mca_document_chunks enable row level security;

  create policy "Authenticated users can read MCA chunks"
    on public.mca_document_chunks for select
    to authenticated
    using (true);
  ```

- [ ] Create rollback `supabase/rollbacks/00043_pgvector_and_mca_chunks.down.sql`:
  ```sql
  -- =============================================================================
  -- Rollback 00043: pgvector + MCA Document Chunks
  -- =============================================================================
  drop function if exists public.match_mca_documents(extensions.vector(1536), int, float);
  drop policy if exists "Authenticated users can read MCA chunks" on public.mca_document_chunks;
  drop index if exists public.mca_chunks_embedding_idx;
  drop table if exists public.mca_document_chunks;
  -- Note: do NOT drop pgvector extension — other things may depend on it
  ```

**2b. `supabase/migrations/00044_advisor_conversations.sql`**

- [ ] Create migration:

  ```sql
  -- =============================================================================
  -- Migration 00044: Advisor Conversations + Messages
  --
  -- 1. advisor_conversations table
  -- 2. advisor_messages table
  -- 3. Indexes
  -- 4. RLS
  -- =============================================================================

  -- ---------------------------------------------------------------------------
  -- 1. Advisor conversations
  -- ---------------------------------------------------------------------------
  create table public.advisor_conversations (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references public.persons(id),
    title text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- ---------------------------------------------------------------------------
  -- 2. Advisor messages
  -- ---------------------------------------------------------------------------
  create table public.advisor_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.advisor_conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    sources jsonb,
    model_used text,
    input_tokens int,
    output_tokens int,
    created_at timestamptz not null default now()
  );

  -- ---------------------------------------------------------------------------
  -- 3. Indexes
  -- ---------------------------------------------------------------------------
  create index advisor_conversations_person_updated
    on public.advisor_conversations (person_id, updated_at desc);

  create index advisor_messages_conversation_created
    on public.advisor_messages (conversation_id, created_at);

  -- ---------------------------------------------------------------------------
  -- 4. RLS
  -- ---------------------------------------------------------------------------
  alter table public.advisor_conversations enable row level security;
  alter table public.advisor_messages enable row level security;

  create policy "Owner can CRUD own conversations"
    on public.advisor_conversations for all
    to authenticated
    using (person_id = auth.uid())
    with check (person_id = auth.uid());

  create policy "Owner can read/write own messages"
    on public.advisor_messages for all
    to authenticated
    using (
      conversation_id in (
        select id from public.advisor_conversations where person_id = auth.uid()
      )
    )
    with check (
      conversation_id in (
        select id from public.advisor_conversations where person_id = auth.uid()
      )
    );
  ```

- [ ] Create rollback `supabase/rollbacks/00044_advisor_conversations.down.sql`:

  ```sql
  -- =============================================================================
  -- Rollback 00044: Advisor Conversations + Messages
  -- =============================================================================
  drop policy if exists "Owner can read/write own messages" on public.advisor_messages;
  drop policy if exists "Owner can CRUD own conversations" on public.advisor_conversations;
  drop index if exists public.advisor_messages_conversation_created;
  drop index if exists public.advisor_conversations_person_updated;
  drop table if exists public.advisor_messages;
  drop table if exists public.advisor_conversations;
  ```

- [ ] Neither table is event-sourced — AI chat utility data, same precedent as `user_preferences`, `device_tokens`, `daywork_templates`

#### 3. Lib Files — `apps/web/src/lib/advisor/`

All new files in a new `advisor/` subdirectory under `src/lib/`.

**3a. `apps/web/src/lib/advisor/anthropic.ts`**

- [ ] Create file:

  ```typescript
  import Anthropic from '@anthropic-ai/sdk';

  let _client: Anthropic | null = null;

  export function getAnthropicClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    if (!_client) {
      _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return _client;
  }
  ```

**3b. `apps/web/src/lib/advisor/embeddings.ts`**

- [ ] Create file:

  ```typescript
  import OpenAI from 'openai';

  let _client: OpenAI | null = null;

  function getOpenAIClient(): OpenAI | null {
    if (!process.env.OPENAI_API_KEY) return null;
    if (!_client) {
      _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _client;
  }

  export async function generateEmbedding(text: string): Promise<number[]> {
    const client = getOpenAIClient();
    if (!client) throw new Error('OpenAI not configured');
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
  ```

**3c. `apps/web/src/lib/advisor/rag.ts`**

- [ ] Create file. Exports `searchMcaDocs(query: string, supabase: SupabaseClient, limit?: number): Promise<MCAChunk[]>`
- Calls `generateEmbedding(query)` then `supabase.rpc('match_mca_documents', { query_embedding: JSON.stringify(embedding), match_count: limit ?? 5, match_threshold: 0.7 })`
- **Important:** Supabase JS client sends vectors as JSON strings. The RPC parameter type handles conversion.
- Returns array of `{ content, source_document, source_url, section_title, similarity }`
- **Graceful empty:** If no chunks match (or table is empty — initial state), returns `[]`. The LLM pipeline handles this by omitting the MCA context block from the prompt, and the system prompt tells the LLM to answer from general knowledge.
- **Graceful no-op when OpenAI not configured:** If `generateEmbedding` throws (no API key), catch and return `[]` — Docky still answers, just without RAG.
- Define `MCAChunk` interface locally and export it

**3d. `apps/web/src/lib/advisor/llm.ts`**

- [ ] Create file. Exports:

  ```typescript
  export interface DockyResponse {
    answer: string;
    sources: Array<{
      document: string;
      section: string | null;
      url: string | null;
      relevance: number;
    }>;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }

  export async function askDocky(
    question: string,
    mcaContext: MCAChunk[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    crewContext?: string, // for Stage 93 — optional, unused in Stage 92
  ): Promise<DockyResponse>;
  ```

- Build messages array:
  1. System message with the prompt (use the `system` parameter)
  2. If `crewContext` provided, add as a user message: `"[CREW PROFILE]\n${crewContext}"`
  3. If `mcaContext.length > 0`, add as a user message: `"[MCA DOCUMENTATION]\n${mcaContext.map(c => ...).join('\n\n')}"` — **skip this block entirely when mcaContext is empty** (initial state with no docs loaded)
  4. Conversation history (last 10 messages)
  5. Current user question
- Call `client.messages.create({ model: process.env.DOCKY_MODEL ?? 'claude-haiku-4-5-20251001', max_tokens: 1024, system: SYSTEM_PROMPT, messages })` (use the `system` parameter, not a system message in the array)
- Extract answer from `response.content[0].text`
- Build sources from `mcaContext` (pass through the ones that were used)
- Return `{ answer, sources, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model }`

- [ ] System prompt (store as const in the file):

  ```
  You are Docky, a maritime career advisor built into DockWalker — the superyacht industry's daywork hiring app. You specialise in MCA certifications, career progression, and training requirements for yacht crew.

  Rules:
  - If MCA documentation is provided in context, cite specific documents (e.g. 'According to MIN 599...'). If no MCA context is provided, answer from your general maritime knowledge but note that your answer should be verified against official MCA publications.
  - If you are not confident in your answer, say so honestly.
  - Keep answers concise but thorough. Use bullet points for lists.
  - End each response with: 'Always verify with your flag state authority or an approved training centre.'
  - Never provide advice about IMO convention text.
  - Never diagnose medical conditions (for ENG1 questions, direct to an approved ENG1 doctor).
  - Be encouraging, especially to green crew entering the industry.
  ```

#### 4. MCA Document Ingestion — DEFERRED

MCA document corpus, PDF ingestion script, and `.gitignore` rules deferred to a future stage. The pgvector table and `match_mca_documents` RPC are deployed empty. Docky answers from LLM general knowledge until documents are loaded.

#### 5. API Routes

All routes use `requireDomainUser()` guard + crew hat check (`person.current_hat !== 'crew'` → 403). Wrap body in try/catch. Use `serviceClient` for writes that need to bypass RLS.

**5a. `POST /api/advisor/conversations`**

- [ ] Create `apps/web/src/app/api/advisor/conversations/route.ts` (export both POST and GET)
- POST: guard → hat check → `serviceClient.from('advisor_conversations').insert({ person_id: user.id }).select('id').single()` → return `{ id }` with 201
- GET: guard → hat check → `supabase.from('advisor_conversations').select('id, title, updated_at, advisor_messages(content)').eq('person_id', user.id).order('updated_at', { ascending: false }).limit(50)` — for message preview, use `.limit(1)` on the embedded `advisor_messages` relation ordered by `created_at asc`
- Return `{ conversations: [...] }` with 200

**5b. `DELETE /api/advisor/conversations/[id]`**

- [ ] Create `apps/web/src/app/api/advisor/conversations/[id]/route.ts` (export DELETE and keep open for GET messages)
- **Next.js 16 async params pattern** — all `[id]` routes use this exact signature:
  ```typescript
  export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // ...
  }
  ```
- DELETE: guard → hat check → `supabase.from('advisor_conversations').delete().eq('id', id).eq('person_id', user.id)` → if no rows deleted, 404 → else 204 (return `new NextResponse(null, { status: 204 })`)
- RLS handles ownership, but explicit `.eq('person_id', user.id)` as defense-in-depth

**5c. `POST /api/advisor/conversations/[id]/messages`**

- [ ] Create `apps/web/src/app/api/advisor/conversations/[id]/messages/route.ts` (export POST and GET)
- Same async params pattern: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`
- This is the most complex route. Pattern:
  1. Guard + hat check
  2. Validate ownership: `supabase.from('advisor_conversations').select('id, person_id').eq('id', id).single()` → 404 if not found, 403 if `person_id !== user.id`
  3. Validate content: `const body = await request.json().catch(() => ({}))` → `body.content` must be string, 1-500 chars
  4. Save user message: `serviceClient.from('advisor_messages').insert({ conversation_id: id, role: 'user', content: body.content }).select('id').single()`
  5. Fetch conversation history: `supabase.from('advisor_messages').select('role, content').eq('conversation_id', id).order('created_at', { ascending: true }).limit(10)` — exclude the message we just inserted (or fetch before insert)
  6. RAG search: `const chunks = await searchMcaDocs(body.content, serviceClient)`
  7. LLM call: `const response = await askDocky(body.content, chunks, history)`
  8. Save assistant message: `serviceClient.from('advisor_messages').insert({ conversation_id: id, role: 'assistant', content: response.answer, sources: response.sources, model_used: response.model, input_tokens: response.inputTokens, output_tokens: response.outputTokens }).select('id, content, sources, created_at').single()`
  9. Update conversation title + updated_at: `serviceClient.from('advisor_conversations').update({ title: firstMessageTitle, updated_at: new Date().toISOString() }).eq('id', id)` — title from first user message, truncated to 60 chars
  10. Return `{ id, role: 'assistant', content: response.answer, sources: response.sources, created_at }`
- **Graceful LLM failure:** If Anthropic errors at step 7, user message is already saved (step 4). Return 503 `{ error: 'Docky is temporarily unavailable. Please try again.' }`
- **Fetch history before saving user message** to avoid including it in context. Then save user message. Then call LLM.

- GET: guard → hat check → ownership → `supabase.from('advisor_messages').select('id, role, content, sources, created_at').eq('conversation_id', id).order('created_at', { ascending: true })` → return `{ messages: [...] }`

#### 6. UI — Bottom Nav Update

- [ ] Edit `apps/web/src/components/bottom-nav.tsx`:
  - Add `LifeBuoy` to lucide-react imports
  - Insert Docky tab into `crewNav` array between Messages and Profile:
    ```typescript
    { icon: LifeBuoy, label: 'Docky', href: '/docky' },
    ```
  - Final crew nav order: Discover | Messages | Docky | Profile
  - `employerNav` unchanged

#### 7. UI — Conversation List Page

- [ ] Create `apps/web/src/app/(app)/docky/page.tsx`
- `'use client'` directive
- State: `conversations` array, `loading` boolean, `error` string | null
- Fetch on mount: `GET /api/advisor/conversations`
- Layout:
  - Sticky header: "Docky" title + Plus icon button (top right) → creates conversation → navigates to `/docky/{id}`
  - Conversation list: each item is a tappable row → `/docky/{id}`
    - Title (or "New conversation"), relative time via simple formatter, first message preview truncated to ~80 chars
  - Delete: swipe-left or long-press → confirmation dialog (use existing `Dialog` component from `@/components/ui/dialog`) → `DELETE /api/advisor/conversations/{id}` → remove from list
- Empty state (no conversations):
  - LifeBuoy icon (large, `text-muted-foreground`)
  - "Ask Docky" heading
  - "Your maritime career advisor. Ask about certifications, career paths, and training requirements." subtext
  - 4 suggestion chips in 2x2 grid (tappable rounded buttons):
    - "What certs do I need to become a Bosun?"
    - "How do I get my STCW?"
    - "What is the ENG1 medical?"
    - "Deck officer career path"
  - Tapping chip: `POST /api/advisor/conversations` → get `id` → `POST /api/advisor/conversations/{id}/messages` with chip text → navigate to `/docky/{id}`
- Loading: `Loader2` spinner (from lucide-react, `className="animate-spin"`)
- Error: `useToast().showError(message)` (import from `@/hooks/use-toast`)

#### 8. UI — Conversation Detail Page

- [ ] Create `apps/web/src/app/(app)/docky/[conversationId]/page.tsx`
- `'use client'` directive
- State: `messages` array, `loading` (initial load), `sending` (waiting for AI), `error`, `input` string
- Fetch on mount: `GET /api/advisor/conversations/{id}/messages`
- Layout:
  - Sticky header: back arrow (ChevronLeft icon → `router.push('/docky')`) + conversation title (truncated)
  - Scrollable message list (`ref` for auto-scroll with `useRef` + `useEffect`):
    - User messages: right-aligned, `bg-primary text-primary-foreground` rounded bubble, `max-w-[80%]`
    - Docky messages: left-aligned, `bg-muted` rounded bubble, small LifeBuoy icon (16px) as avatar to the left
    - **Markdown rendering for Docky messages:** Use a lightweight regex-based renderer (function `renderMarkdown(text: string): string`) that handles:
      - `**bold**` → `<strong>`
      - `- item` / `* item` → `<li>` inside `<ul>`
      - `1. item` → `<li>` inside `<ol>`
      - `### heading` → `<h3>`
      - `\n\n` → `<br/><br/>`
      - Render via `<div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />`
      - Sanitise: strip `<script>`, `<iframe>`, `on*` attributes before rendering
    - Below each Docky message with sources: collapsible "Sources ({n})" toggle → list of `{source_document} — {section_title}`, each wrapped in `<a href={source_url} target="_blank">` if URL exists
  - Loading bubble: when `sending` is true, show left-aligned muted bubble with animated dots ("Docky is thinking...")
  - If conversation is new (0 messages), show suggestion chips (same 4 as list page empty state) above the input
  - Input area (bottom, above nav):
    - `<input>` placeholder "Ask Docky..." + send button (SendHorizontal icon from lucide-react)
    - Disabled when empty or `sending`
    - 500 char max (use `maxLength` attribute)
    - Send on Enter (desktop), tap send button (mobile)
    - After send: add user message to local `messages` array immediately (optimistic), set `sending: true`, call `POST /api/advisor/conversations/{id}/messages`, on success add assistant message to array, on 503 add error system message
  - Error state: if 503, insert a system-style message (centered, muted text): "Docky is temporarily unavailable. Your question has been saved — try sending again."
- **Capacitor compat:** No `window.open()` for source links — use `<a target="_blank">` which Capacitor handles via in-app browser

#### 9. OGL Attribution

- [ ] Edit `apps/web/src/app/(app)/settings/page.tsx` — in the About section, add a line: "Maritime guidance contains public sector information licensed under the Open Government Licence v3.0"

#### 10. Tests

**Test import pattern for advisor routes:**

```typescript
import { POST, GET } from '@/app/api/advisor/conversations/route';
import { DELETE } from '@/app/api/advisor/conversations/[id]/route';
import {
  POST as PostMessage,
  GET as GetMessages,
} from '@/app/api/advisor/conversations/[id]/messages/route';
```

For `[id]` routes, pass params as second arg: `DELETE(request, { params: Promise.resolve({ id: 'conv-1' }) })`

**10a. `__tests__/api/advisor-conversations.test.ts`**

- [ ] 6 tests using same mock pattern as other API tests:
  1. POST returns 201 with conversation id
  2. GET returns 200 with conversations ordered by updated_at DESC
  3. DELETE returns 204
  4. All three return 401 when unauthenticated
  5. POST returns 403 when employer hat (`person.current_hat: 'employer'`)
  6. DELETE returns 404 when conversation doesn't belong to user

Mock setup: mock `requireDomainUser`, mock `supabase.from()` chains. Conversations route doesn't touch Anthropic/OpenAI — no AI mocks needed.

**10b. `__tests__/api/advisor-messages.test.ts`**

- [ ] 8 tests:
  1. POST 200 — happy path: mock ownership check, mock `searchMcaDocs` (or mock at embedding level), mock Anthropic `messages.create`, assert user message saved, assistant message saved with sources + tokens
  2. POST 400 — empty content
  3. POST 400 — content over 500 chars
  4. POST 404 — wrong conversation owner
  5. POST 403 — employer hat
  6. POST 401 — unauthenticated
  7. POST 503 — Anthropic SDK throws, assert user message still saved
  8. GET 200 — returns messages ordered by created_at ASC

Mock strategy:

```typescript
vi.mock('@/lib/advisor/rag', () => ({
  searchMcaDocs: vi.fn().mockResolvedValue([
    {
      content: 'mock content',
      source_document: 'MIN 599',
      source_url: 'https://example.com',
      section_title: 'Section 1',
      similarity: 0.85,
    },
  ]),
}));

vi.mock('@/lib/advisor/llm', () => ({
  askDocky: vi.fn().mockResolvedValue({
    answer: 'Mock answer',
    sources: [
      { document: 'MIN 599', section: 'Section 1', url: 'https://example.com', relevance: 0.85 },
    ],
    inputTokens: 100,
    outputTokens: 50,
    model: 'claude-haiku-4-5-20251001',
  }),
}));
```

Mock at the `rag.ts` and `llm.ts` level, not at the SDK level — this tests the route logic while keeping the RAG/LLM pipeline mockable.

#### 11. Documentation

- [ ] Update `apps/web/README.md` — new env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DOCKY_MODEL`), new routes (`/api/advisor/*`), Docky feature description, MCA ingestion instructions (`npx tsx scripts/ingest-mca-docs.ts`)
- [ ] Update `packages/types/README.md` if any shared types were added
- [ ] Update `supabase/README.md` — new migrations 00043, 00044
- [ ] Update `BUILD_STATE.md`:
  - Completed Stages: add `[Stage 92] Docky Phase 1 — pgvector + MCA chunks, advisor conversations/messages tables, RAG pipeline, Anthropic LLM, Docky tab + chat UI, MCA ingestion script`
  - Schema version: bump to `v44 — advisor conversations (44 migrations applied)` (or v43 if Stage 91 was skipped)
  - Migration table: add both 00043 and 00044 rows
- [ ] **Pre-commit will fail** if BUILD_STATE.md schema version doesn't match migration file count (currently 41 → will be 44 after this stage). Update version BEFORE committing.
  - Deferred decisions: add "MCA document corpus ingestion — pgvector table deployed empty, need PDF download + chunking + embedding script", "Docky streaming responses (Anthropic SDK supports streaming; deferred to polish stage)", "Docky conversation export/share", "Docky Phase 3 — aggregate intelligence (requires 500+ crew with experience data)"

---

### Stage 93: Docky Phase 2 — Personalised Advice

**Goal:** Docky reads the crew member's profile, certs, experience history, and vessel exposure for personalised career advice.

**Done condition:** A deckhand with STCW Basic + ENG1 + 8 months on 30-40m motor yachts asks "What should I do next?" and gets advice referencing THEIR specific certs, experience level, vessel size exposure, and location.

**Will NOT touch:** Stripe, employer hat, discovery, existing messages.

**Depends on:** Stage 92 complete.

#### 1. Crew Context Builder — `apps/web/src/lib/advisor/crew-context.ts`

- [ ] Create file. Exports `buildCrewContext(personId: string, supabase: SupabaseClient): Promise<string>`
- Two queries:
  1. Profile with joins:
     ```typescript
     const { data: profile } = await supabase
       .from('profiles')
       .select(
         `
         display_name, bio, shore_experience, motivation, languages, available_to_start,
         primary_role_id, roles!profiles_primary_role_id_fkey(name),
         certification_ids, experience_bracket_id, experience_brackets!profiles_experience_bracket_id_fkey(label),
         vessel_size_exposure_ids,
         location_port_id, ports!profiles_location_port_id_fkey(name, city_id, cities(name, region_id, regions(name)))
       `,
       )
       .eq('person_id', personId)
       .single();
     ```
     Note: FK hint syntax matches existing patterns (e.g. applicants route uses `profiles!applications_crew_person_id_fkey`). Check actual FK names in migration files if needed.
  2. Experiences with vessel + role joins:
     ```typescript
     const { data: experiences } = await supabase
       .from('crew_experiences')
       .select(
         `
         start_date, end_date, is_current, vessel_operation, flag_state,
         contract_type, description,
         vessels(name, vessel_type, loa_meters, size_band_id, vessel_size_bands(label)),
         roles(name)
       `,
       )
       .eq('person_id', personId)
       .order('start_date', { ascending: false });
     ```
- Cert names: profile has `certification_ids` (uuid array). Need a separate query or use `.in('id', certIds)` on the `certifications` table to resolve names.
- Vessel size exposure labels: same pattern — `.in('id', sizeIds)` on `vessel_size_bands`.
- Build markdown string (~500-1500 tokens). See format in Stage 93 plan above.
- **NEVER include salary data** — `salary_amount`, `salary_currency`, `salary_period` are NOT selected
- **NEVER include engagement ratings or performance data**

#### 2. Cert Gap Analysis — `apps/web/src/lib/advisor/cert-analysis.ts`

- [ ] Create file. Exports `buildCertGapContext(currentCertNames: string[], currentRole: string, mcaChunks: MCAChunk[]): string`
- Pure function — no DB calls. Reads MCA chunks for cert references, compares against crew's current certs.
- Returns text block like: "Based on MCA guidance, a Deckhand seeking to progress typically needs: STCW Proficiency in Survival Craft (you have: no), Yacht Rating (you have: no). You currently hold: STCW Basic Safety, ENG1."
- This is injected into the LLM prompt as context — the LLM interprets it, it's not deterministic.

#### 3. Wire into LLM + Message Route

- [ ] Update `apps/web/src/lib/advisor/llm.ts` → `askDocky()`:
  - Already has `crewContext?: string` param from Stage 92 (built in advance)
  - When `crewContext` is provided, add to system prompt: "You have access to this crew member's DockWalker profile and work history below. Use it to:\n- Reference their specific certifications when identifying gaps\n- Account for their experience level and vessel size exposure\n- Consider their location when suggesting training centres\n- Tailor career path advice to their current role and progression\n\nBe encouraging but honest. Never reveal salary data. Never compare to specific other crew members. Never make promises about job outcomes."
  - Inject `crewContext` as a user message prefixed with `[CREW PROFILE]` before MCA context

- [ ] Update `POST /api/advisor/conversations/[id]/messages` route:
  - After auth/ownership checks, before RAG search:
    ```typescript
    const crewContext = await buildCrewContext(user.id, supabase);
    ```
  - Pass to `askDocky()`:
    ```typescript
    const response = await askDocky(body.content, chunks, history, crewContext);
    ```
  - Also build cert gap context:
    ```typescript
    const certGap = buildCertGapContext(certNames, roleName, chunks);
    ```
    Append `certGap` to the MCA context block or pass as separate param to `askDocky()`

#### 4. UI Enhancements

- [ ] Update Docky conversation detail page:
  - When `sending` is true, first show "Docky is reading your profile..." for 1 second, then switch to "Docky is thinking..."
  - Use `setTimeout` with cleanup in effect

- [ ] Update suggestion chips (both list page empty state and conversation detail empty state):
  - Fetch user's role name and city name on page load: `GET /api/profile` or a lightweight endpoint
  - Dynamic chips: "What should I work on next?", "What certs am I missing?", "How do I progress from {roleName}?", "Training centres near {cityName}?"
  - Fallback to static chips if profile data not available

#### 5. Tests

- [ ] `__tests__/lib/crew-context.test.ts` — 4 tests:
  1. Builds correct markdown from mock profile + 2 experiences
  2. Handles zero experiences (green crew — shore_experience shown instead)
  3. Handles missing optional fields (no bio, no languages)
  4. Never includes salary data (assert salary words absent from output)

- [ ] `__tests__/api/advisor-personalised.test.ts` — 3 tests:
  1. Send message: assert `askDocky` was called with `crewContext` param containing profile data (mock `buildCrewContext` to return known string, verify it appears in `askDocky` call)
  2. Employer hat returns 403
  3. No salary data appears in any prompt content (mock `buildCrewContext`, assert output doesn't contain "salary")

#### 6. Documentation

- [ ] Update `apps/web/README.md` — note Docky personalisation behaviour
- [ ] Update `BUILD_STATE.md` — stage entry: `[Stage 93] Docky Phase 2 — crew context builder, cert gap analysis, personalised LLM prompts, dynamic suggestion chips`

---

### Stage 94: Docky Monetisation Gating

**Goal:** Free tier gets 3 questions/month, Crew Pro gets unlimited. Paywall with upgrade prompt.

**Done condition:** A free-tier crew member asks their 4th question in a calendar month and sees an upgrade prompt instead of an answer. A subscribed crew member has no limits.

**Depends on:** Stage 91 (Stripe) + Stage 92 (Docky Phase 1) complete. Can run after or alongside Stage 93.

**Will NOT touch:** MCA ingestion, RAG pipeline, personalisation logic, existing features.

#### 1. Migration — `supabase/migrations/00045_advisor_usage.sql`

(Number depends on final ordering — adjust to next available.)

- [ ] Create migration:

  ```sql
  -- =============================================================================
  -- Migration 00045: Advisor Usage Tracking
  -- =============================================================================

  create table public.advisor_usage (
    id uuid primary key default gen_random_uuid(),
    person_id uuid not null references public.persons(id),
    month text not null,
    question_count int not null default 0,
    created_at timestamptz not null default now(),
    unique (person_id, month)
  );

  alter table public.advisor_usage enable row level security;

  create policy "Owner can read own usage"
    on public.advisor_usage for select
    to authenticated
    using (person_id = auth.uid());
  ```

- [ ] Create rollback `supabase/rollbacks/00045_advisor_usage.down.sql`:
  ```sql
  drop policy if exists "Owner can read own usage" on public.advisor_usage;
  drop table if exists public.advisor_usage;
  ```

#### 2. Usage Check in Message Route

- [ ] Update `POST /api/advisor/conversations/[id]/messages`:
  - **BEFORE saving user message** (step 4 in Stage 92 flow), add usage gate:

    ```typescript
    // Check subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('person_id', user.id)
      .single();

    const isPro =
      sub &&
      (sub.plan === 'crew_pro' || sub.plan === 'crew_unlimited') &&
      (sub.status === 'active' || sub.status === 'trialing');

    if (!isPro) {
      const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      // Upsert usage row (create if first question this month)
      const { data: usage } = await serviceClient
        .from('advisor_usage')
        .upsert(
          { person_id: user.id, month: currentMonth, question_count: 0 },
          { onConflict: 'person_id,month', ignoreDuplicates: true },
        )
        .select('question_count')
        .eq('person_id', user.id)
        .eq('month', currentMonth)
        .single();
      // Actually need: select first, then upsert if not exists. Or use the returned data.

      if ((usage?.question_count ?? 0) >= 3) {
        return NextResponse.json(
          {
            error: 'limit_reached',
            used: 3,
            limit: 3,
            upgrade_url: '/billing',
          },
          { status: 402 },
        );
      }
    }
    ```

  - After successful LLM response (step 8), increment usage count (only for free tier):
    ```typescript
    if (!isPro) {
      await serviceClient.from('advisor_usage').upsert(
        {
          person_id: user.id,
          month: currentMonth,
          question_count: (usage?.question_count ?? 0) + 1,
        },
        { onConflict: 'person_id,month' },
      );
    }
    ```
  - **Do NOT save user message before usage check** — don't consume the question slot if they hit the wall

#### 3. UI — Paywall Card in Chat

- [ ] Update Docky conversation detail page:
  - When `POST /api/advisor/conversations/{id}/messages` returns 402 with `error: 'limit_reached'`:
    - Do NOT add the user message to the local array (it wasn't saved server-side)
    - Instead, show a paywall card in the chat area:
      - LifeBuoy icon with Lock overlay icon
      - "You've used your 3 free questions this month"
      - "Upgrade to Crew Pro for unlimited access to Docky"
      - Primary button: "Upgrade" → `router.push('/billing')`
      - Muted text link: "View plans" → same destination
    - Input stays visible but disabled (`sending` stays true or use separate `limitReached` state)

- [ ] Update Docky conversation list page header:
  - Fetch subscription status on mount: `GET /api/billing/status`
  - Fetch usage on mount: `GET /api/advisor/usage` (new simple route, see below) or inline from a field in the conversations response
  - Show pill in header: "2 of 3" (free tier, with current usage) or "Pro" badge (subscribed)

#### 4. Usage Status Route

- [ ] Create `apps/web/src/app/api/advisor/usage/route.ts` — `GET`:
  - Guard + crew hat check
  - Query: `supabase.from('advisor_usage').select('question_count').eq('person_id', user.id).eq('month', currentMonth).single()`
  - Return `{ used: row?.question_count ?? 0, limit: 3 }` for free tier
  - If subscribed (check `subscriptions` table), return `{ used: null, limit: null, plan: sub.plan }` — unlimited

#### 5. UI — Billing Page

- [ ] Create `apps/web/src/app/(app)/billing/page.tsx`
- `'use client'` directive
- State: `subscription` (plan + status from `/api/billing/status`), `loading`, `redirecting`
- Fetch on mount: `GET /api/billing/status`
- Check URL params: if `?success=true`, show success toast via `useToast().showError` (but make it a success variant — or just use `alert` inline since there's no `showSuccess`)
- Layout:
  - Sticky header: back arrow + "Plans" title
  - Two plan cards (stacked on mobile, `flex flex-col gap-4`):
    - **Free** card: "Current plan" badge if on free, features list: "3 questions/month", "General MCA guidance", "Source citations"
    - **Crew Pro** card: "Current plan" badge if subscribed, features list: "Unlimited questions", "Personalised career advice", "Priority responses", price from Stripe (hardcode display price or fetch from Stripe), "Subscribe" button → calls `POST /api/billing/create-checkout` with `{ plan: 'crew_pro' }` → redirects to `data.url` via `window.location.href`
  - If already subscribed: replace "Subscribe" with "Manage subscription" → calls `POST /api/billing/create-portal` → redirects to portal URL
- Capacitor compat: `window.location.href` for Stripe redirect works in Capacitor's WebView. No `window.open()`.

- [ ] Add "Subscription" row to Settings page Account section (`apps/web/src/app/(app)/settings/page.tsx`):
  - New row: "Subscription" → tappable → `router.push('/billing')`

#### 6. Tests

- [ ] `__tests__/api/advisor-usage.test.ts` — 5 tests:
  1. Free tier, questions 1-3 succeed (200) — mock subscription query returns null, mock usage returns count < 3
  2. Free tier, question 4 returns 402 `limit_reached` — mock usage count = 3
  3. Pro tier, unlimited — mock subscription with `plan: 'crew_pro', status: 'active'`, assert no usage check
  4. Usage increments only on successful AI response — mock LLM success, assert `advisor_usage` upsert called with count + 1
  5. Month rollover resets count — mock usage for previous month returns 3, current month returns 0, assert 200

  Mock setup: same as advisor-messages tests, plus mock subscription/usage queries

- [ ] `__tests__/components/billing-page.test.ts` — 3 component tests:
  1. Renders plan cards
  2. Shows "Current plan" badge on free when no subscription
  3. Shows "Manage subscription" button when subscribed

#### 7. Documentation

- [ ] Update `apps/web/README.md` — billing page, usage limits, Stripe product/price setup
- [ ] Update `supabase/README.md` — new migration
- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 94] Docky monetisation gating — advisor_usage table, free tier 3/month limit, paywall card, billing page, subscription settings row`
  - Schema version bump
  - Migration table entry

---

## Done

(See git history for completed stages 51-89)
