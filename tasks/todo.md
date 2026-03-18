# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

---

### Stage 93: Docky Phase 2 — Personalised Advice

**Goal:** Docky reads the crew member's profile, certs, experience history, and vessel exposure for personalised career advice.

**Done condition:** A deckhand with STCW Basic + ENG1 + 8 months on 30-40m motor yachts asks "What should I do next?" and gets advice referencing THEIR specific certs, experience level, vessel size exposure, and location.

**Will NOT touch:** Stripe, employer hat, discovery, existing messages.

**Depends on:** Stage 92 complete.

#### 1. Crew Context Builder — `apps/web/src/lib/advisor/crew-context.ts`

- [ ] Create file. Exports `buildCrewContext(personId: string, supabase: SupabaseClient): Promise<string>`
- Four queries (use `Promise.all` where independent):
  1. Profile with joins — use **table names** (not FK hint syntax), matching established pattern in `api/profile/[personId]/route.ts`:
     ```typescript
     const { data: profile, error: profileError } = await supabase
       .from('profiles')
       .select(
         `
         display_name, bio, shore_experience, motivation, languages, available_to_start,
         primary_role_id, yacht_roles(name),
         certification_ids, experience_bracket_id, experience_brackets(label),
         vessel_size_exposure_ids,
         location_port_id, ports(name, city_id, cities(name, region_id, regions(name)))
       `,
       )
       .eq('person_id', personId)
       .single();
     ```
     **Important:** Table name is `yacht_roles`, NOT `roles`. No FK hint syntax needed — each FK points to a unique table.
  2. Experiences with vessel + role joins — matching pattern from `api/profile/[personId]/route.ts` lines 137-143:
     ```typescript
     const { data: experiences, error: expError } = await supabase
       .from('crew_experiences')
       .select(
         `
         start_date, end_date, is_current, vessel_operation, flag_state,
         contract_type, description,
         vessels(name, vessel_type, loa_meters, vessel_size_bands(label)),
         yacht_roles(name)
       `,
       )
       .eq('person_id', personId)
       .order('start_date', { ascending: false });
     ```
     **Important:** `yacht_roles(name)` NOT `roles(name)`. Vessels join uses `vessel_size_bands(label)` nested inside `vessels(...)` — do NOT select `size_band_id` separately.
  3. Cert name resolution — profile has `certification_ids` (uuid[]). Resolve to names:
     ```typescript
     const { data: certs } = await supabase
       .from('certifications')
       .select('id, name, category')
       .in('id', profile.certification_ids ?? []);
     ```
  4. Vessel size exposure labels — profile has `vessel_size_exposure_ids` (uuid[]). Resolve to labels:
     ```typescript
     const { data: sizeBands } = await supabase
       .from('vessel_size_bands')
       .select('id, label')
       .in('id', profile.vessel_size_exposure_ids ?? []);
     ```
- Build markdown string (~500-1500 tokens). Format:

  ```
  ## Crew Profile
  **Role:** Deckhand | **Experience:** 6-12 months
  **Location:** Antibes, French Riviera, Western Mediterranean
  **Available:** Immediate
  **Certifications:** STCW Basic Safety, ENG1
  **Vessel Size Exposure:** 30-40m, 40-50m
  **Bio:** [if present]
  **Shore Experience:** [if present]
  **Motivation:** [if present]
  **Languages:** [if present]

  ## Work History
  1. Deckhand on MY Example (45m motor, charter) — Jan 2025 to Mar 2025
     Flag: Cayman Islands | Contract: Seasonal
  2. ...

  [No work history recorded — shore_experience shown above instead]
  ```

- Return empty string if profile query fails (graceful degradation — LLM works without context)
- **NEVER include salary data** — `salary_amount`, `salary_currency`, `salary_period` are NOT selected from crew_experiences
- **NEVER include engagement ratings or performance data**
- Always destructure `{ data, error }` and handle errors (lesson: never discard Supabase errors)

#### 2. Cert Gap Analysis — `apps/web/src/lib/advisor/cert-analysis.ts`

- [ ] Create file. Exports `buildCertGapContext(currentCertNames: string[], currentRole: string, mcaChunks: MCAChunk[]): string`
- Import `MCAChunk` type from `./rag` (already defined there)
- Pure function — no DB calls. Scans MCA chunk content for cert name references, compares against crew's current certs.
- Returns text block like: "Based on MCA guidance, a Deckhand seeking to progress typically needs: STCW Proficiency in Survival Craft (you have: no), Yacht Rating (you have: no). You currently hold: STCW Basic Safety, ENG1."
- If no MCA chunks provided or no cert references found, return empty string (don't fabricate gaps)
- This is injected into the LLM prompt as context — the LLM interprets it, it's not deterministic.

#### 3. Wire into LLM + Message Route

- [ ] Update `apps/web/src/lib/advisor/llm.ts` → `askDocky()`:
  - The `crewContext?: string` param already exists and is already injected as a `[CREW PROFILE]` user message when provided. **Do not duplicate this logic.**
  - ADD to the system prompt (append to existing `SYSTEM_PROMPT` constant) when `crewContext` is provided:

    ```
    You have access to this crew member's profile and work history. Use it to:
    - Reference their specific certifications when identifying gaps
    - Account for their experience level and vessel size exposure
    - Consider their location when suggesting training centres
    - Tailor career path advice to their current role and progression

    Be encouraging but honest. Never reveal salary data. Never compare to specific other crew members. Never make promises about job outcomes.
    ```

  - Implementation: make the system prompt dynamic — base prompt + personalisation block when `crewContext` is truthy. Keep the base prompt as-is.

- [ ] Update `POST /api/advisor/conversations/[id]/messages` route (`apps/web/src/app/api/advisor/conversations/[id]/messages/route.ts`):
  - Import `buildCrewContext` from `@/lib/advisor/crew-context`
  - Import `buildCertGapContext` from `@/lib/advisor/cert-analysis`
  - After auth/ownership checks (current step 4), before fetching history (current step 5):
    ```typescript
    const crewContext = await buildCrewContext(user.id, supabase);
    ```
  - After RAG search returns `chunks` (current step 7), build cert gap context:
    ```typescript
    // Extract cert names and role name from crewContext (or re-query — but crewContext already has them)
    const certGap = buildCertGapContext(certNames, roleName, chunks);
    ```
  - Combine crew context + cert gap into single string for `askDocky`:
    ```typescript
    const fullCrewContext = [crewContext, certGap].filter(Boolean).join('\n\n');
    ```
  - Pass to `askDocky()`:
    ```typescript
    const response = await askDocky(body.content, chunks, history, fullCrewContext || undefined);
    ```
  - **Design decision:** `buildCrewContext` should also return cert names and role name as structured data so `buildCertGapContext` doesn't need separate queries. Consider returning `{ markdown: string, certNames: string[], roleName: string }` instead of just a string. Update the function signature accordingly:
    ```typescript
    interface CrewContextResult {
      markdown: string;
      certNames: string[];
      roleName: string;
    }
    export async function buildCrewContext(
      personId: string,
      supabase: SupabaseClient,
    ): Promise<CrewContextResult>;
    ```

#### 4. UI Enhancements

- [ ] Update Docky conversation detail page (`apps/web/src/app/(app)/docky/[conversationId]/page.tsx`):
  - When `sending` is true, show staged thinking indicator:
    - First 1 second: "Docky is reading your profile..."
    - After 1 second: "Docky is thinking..." (existing animated dots)
  - Use `setTimeout` with cleanup in `useEffect` or `useCallback` — clear timeout on unmount or when `sending` becomes false
  - Keep existing LifeBuoy icon + bouncing dots animation

- [ ] Update suggestion chips in **both** pages:
  - `apps/web/src/app/(app)/docky/page.tsx` (list page empty state)
  - `apps/web/src/app/(app)/docky/[conversationId]/page.tsx` (conversation empty state)
  - On page mount, fetch profile data: `GET /api/profile` — extract `yacht_roles.name` and `ports.name` (or `cities.name`) from response
  - Dynamic chips when profile data available:
    - "What should I work on next?"
    - "What certs am I missing?"
    - "How do I progress from {roleName}?"
    - "Training centres near {cityName}?"
  - Fallback to current static chips if fetch fails or data missing
  - Extract chip logic into a shared hook or utility to avoid duplicating between both pages

#### 5. Tests

- [ ] `__tests__/lib/crew-context.test.ts` — 4 tests:
  1. Builds correct markdown from mock profile + 2 experiences (assert role name, cert names, vessel details, location present)
  2. Handles zero experiences (green crew — `shore_experience` shown, no work history section)
  3. Handles missing optional fields (no bio, no languages, no motivation — assert no crashes, graceful omission)
  4. Never includes salary data (assert "salary" substring absent from output) — mock crew_experiences with salary fields, verify they don't leak
  - Mock pattern: mock `supabase.from()` to return different builders per table (profiles, crew_experiences, certifications, vessel_size_bands). Use `multiTableFrom()` pattern from existing advisor tests.

- [ ] `__tests__/api/advisor-personalised.test.ts` — 3 tests:
  1. Send message: mock `buildCrewContext` to return known `CrewContextResult`, mock `askDocky`, verify `askDocky` was called with `crewContext` param containing the markdown
  2. Employer hat returns 403 (existing pattern — but verify personalisation code doesn't run)
  3. No salary data in any prompt content: mock `buildCrewContext` to return result, assert `askDocky` call args don't contain "salary"
  - Mock pattern: `vi.mock('@/lib/advisor/crew-context')` and `vi.mock('@/lib/advisor/cert-analysis')` in addition to existing mocks

#### 6. Documentation

- [ ] Update `apps/web/README.md` — note Docky personalisation: crew context builder, cert gap analysis, dynamic suggestion chips
- [ ] Update `BUILD_STATE.md` — stage entry: `[Stage 93] Docky Phase 2 — crew context builder, cert gap analysis, personalised LLM prompts, dynamic suggestion chips`

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
      await serviceClient
        .from('advisor_usage')
        .upsert(
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

(See git history for completed stages 51-92)
