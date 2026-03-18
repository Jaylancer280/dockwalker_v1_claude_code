# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 94: Docky Monetisation Gating

**Goal:** Free tier gets 3 questions/month, Crew Pro gets unlimited. Paywall with upgrade prompt.

**Done condition:** A free-tier crew member asks their 4th question in a calendar month and sees an upgrade prompt instead of an answer. A subscribed crew member has no limits.

**Depends on:** Stage 91 (Stripe) + Stage 92 (Docky Phase 1) complete. Can run after or alongside Stage 93.

**Will NOT touch:** MCA ingestion, RAG pipeline, personalisation logic, existing features.

#### 1. Migration — `supabase/migrations/00046_advisor_usage.sql`

**Note:** 00045 is taken by `notification_role_context`. Next available is 00046.

- [ ] Create migration:

  ```sql
  -- =============================================================================
  -- Migration 00046: Advisor Usage Tracking
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

- [ ] Create rollback `supabase/rollbacks/00046_advisor_usage.down.sql`:
  ```sql
  drop policy if exists "Owner can read own usage" on public.advisor_usage;
  drop table if exists public.advisor_usage;
  ```

#### 2. Usage Check in Message Route

- [ ] Update `POST /api/advisor/conversations/[id]/messages`:
  - Use existing `requireSubscription()` helper from `@/lib/require-subscription` — do NOT reimplement subscription check inline. The helper already handles plan ranking and status validation:

    ```typescript
    import { requireSubscription } from '@/lib/require-subscription';

    const subResult = await requireSubscription(supabase, user.id, 'crew_pro');
    const isPro = subResult.ok;
    ```

  - **Reorder message flow** — currently user message is saved at step 6 (BEFORE LLM call). New order:
    1. Auth + validation (unchanged)
    2. Fetch conversation history (unchanged)
    3. **NEW: Subscription + usage check** (before saving user message)
    4. Save user message (moved after usage check)
    5. RAG search + crew context (unchanged)
    6. Call askDocky (unchanged)
    7. Save assistant message (unchanged)
    8. **NEW: Increment usage count** (after successful LLM response, free tier only)
    9. Update conversation title + timestamp (unchanged)
  - Usage check (free tier only):

    ```typescript
    if (!isPro) {
      const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const { data: usage } = await serviceClient
        .from('advisor_usage')
        .select('question_count')
        .eq('person_id', user.id)
        .eq('month', currentMonth)
        .single();

      if ((usage?.question_count ?? 0) >= 3) {
        return NextResponse.json(
          { error: 'limit_reached', used: 3, limit: 3, upgrade_url: '/billing' },
          { status: 402 },
        );
      }
    }
    ```

  - Usage increment (after successful LLM response):
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
  - **Scope `currentMonth` and `usage`:** declare outside the `if (!isPro)` blocks so both the check and the increment can access them. Or use a closure/wrapper.
  - **Do NOT save user message before usage check passes** — don't consume the slot or create an orphaned message if they hit the wall

#### 3. UI — Paywall Card in Chat

- [ ] Update Docky conversation detail page (`apps/web/src/app/(app)/docky/[conversationId]/page.tsx`):
  - Add `limitReached` state (boolean, default false) — separate from `sending`
  - When `POST /api/advisor/conversations/{id}/messages` returns 402 with `error: 'limit_reached'`:
    - Do NOT add the user message to the local `messages` array (it wasn't saved server-side)
    - Set `limitReached = true`
    - Show a paywall card in the chat area:
      - LifeBuoy icon with Lock icon overlay (both from `lucide-react`)
      - "You've used your 3 free questions this month"
      - "Upgrade to Crew Pro for unlimited access to Docky"
      - Primary button: "Upgrade" → `router.push('/billing')`
      - Muted text link: "View plans" → same destination
    - Input bar disabled when `limitReached` is true
  - Parse response safely: use `const text = await res.text(); const data = text ? JSON.parse(text) : {};` pattern (lesson: guard `res.json()` against empty bodies)

- [ ] Update Docky conversation list page header (`apps/web/src/app/(app)/docky/page.tsx`):
  - Fetch on mount: `GET /api/billing/status` and `GET /api/advisor/usage` in parallel
  - Show usage pill next to "Docky" title:
    - Free tier: "2 of 3" (muted badge)
    - Pro tier: "Pro" badge (primary colour)
  - Graceful fallback if either fetch fails (don't show pill)

#### 4. Usage Status Route

- [ ] Create `apps/web/src/app/api/advisor/usage/route.ts` — `GET`:
  - Import and use `requireDomainUser()` guard
  - Destructure `{ supabase }` from `guard.value` (lesson: always destructure from guard.value)
  - Crew hat check: `if (person.current_hat !== 'crew') return 403`
  - Check subscription using `requireSubscription()`:
    - If pro: return `{ used: null, limit: null, plan: sub.plan }`
    - If free: query `advisor_usage` for current month:
      ```typescript
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase
        .from('advisor_usage')
        .select('question_count')
        .eq('person_id', user.id)
        .eq('month', currentMonth)
        .single();
      return NextResponse.json({ used: usage?.question_count ?? 0, limit: 3 });
      ```
  - Top-level try/catch (lesson: every route needs error handling from day one)

#### 5. UI — Billing Page

- [ ] Create `apps/web/src/app/(app)/billing/page.tsx`:
  - `'use client'` directive
  - State: `subscription` (plan + status from `/api/billing/status`), `loading`, `redirecting`
  - Fetch on mount: `GET /api/billing/status`
  - Check URL params: if `?success=true`, show success banner/message inline (don't rely on toast `showSuccess` — check if toast system supports success variant, otherwise use inline UI)
  - Layout:
    - Sticky header: back arrow (`ChevronLeft` from lucide) + "Plans" title
    - Two plan cards (stacked, `flex flex-col gap-4`):
      - **Free** card: "Current plan" badge if on free, features: "3 questions/month", "General MCA guidance", "Source citations"
      - **Crew Pro** card: "Current plan" badge if subscribed, features: "Unlimited questions", "Personalised career advice", "Priority responses". Hardcode display price. "Subscribe" button → calls `POST /api/billing/create-checkout` with `{ plan: 'crew_pro' }` → redirects to `data.url` via `window.location.href`
    - If already subscribed: replace "Subscribe" with "Manage subscription" → calls `POST /api/billing/create-portal` → redirects to portal URL via `window.location.href`
  - Capacitor compat: `window.location.href` for Stripe redirect (no `window.open()`)
  - Parse all API responses safely (lesson: guard `res.json()`)

- [ ] Add "Subscription" row to Settings page Account section (`apps/web/src/app/(app)/settings/page.tsx`):
  - New row in Account section: "Subscription" → tappable → `router.push('/billing')`
  - Match existing row styling (icon + label + chevron pattern)

#### 6. Tests

- [ ] `__tests__/api/advisor-usage.test.ts` — 5 tests for message route usage gating:
  1. Free tier, questions 1-3 succeed (200) — mock `requireSubscription` returns `{ ok: false, response }`, mock usage count < 3
  2. Free tier, question 4 returns 402 `limit_reached` — mock usage count = 3
  3. Pro tier, unlimited — mock `requireSubscription` returns `{ ok: true, plan: 'crew_pro' }`, assert no usage query made
  4. Usage increments only on successful AI response — mock LLM success, assert `advisor_usage` upsert called with count + 1
  5. Month rollover resets count — mock usage for current month returns 0 (even though previous month was 3), assert 200
  - Mock setup: extend advisor-messages test mocks with `vi.mock('@/lib/require-subscription')` and `advisor_usage` table in `multiTableFrom`

- [ ] `__tests__/api/advisor-usage-route.test.ts` — 3 tests for GET /api/advisor/usage:
  1. Free tier returns `{ used: N, limit: 3 }`
  2. Pro tier returns `{ used: null, limit: null, plan: 'crew_pro' }`
  3. Employer hat returns 403

- [ ] `__tests__/components/billing-page.test.ts` — 3 component tests:
  1. Renders plan cards with feature lists
  2. Shows "Current plan" badge on Free card when no subscription
  3. Shows "Manage subscription" button when subscribed (mock status response with active plan)

#### 7. Documentation

- [ ] Update `apps/web/README.md` — billing page route, usage limits (3/month free), Stripe product/price env vars
- [ ] Update `supabase/README.md` — migration 00046 entry
- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 94] Docky monetisation gating — advisor_usage table, free tier 3/month limit, paywall card, billing page, subscription settings row`
  - Schema version bump
  - Migration table entry for 00046

---

## Done

(See git history for completed stages 51-93b)
