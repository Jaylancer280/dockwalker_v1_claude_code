# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

(none)

---

## Queue

### Subscription & billing — full implementation

> Revenue foundation. Two Stripe products (Crew Pro €4.99, Employer/Agent Pro €14.99). Remove `crew_unlimited`, add `employer_pro`. Template caps, shortlist caps, Docky limit change. Hat-aware billing page.
> **Spec:** `tasks/stripe-setup.md`, `tasks/business-model.md`

**Session 1 — Plan cleanup + employer_pro + Docky limit:**

- [x] Migration: update `subscriptions` table CHECK constraint — remove `crew_unlimited`, add `employer_pro`. New CHECK: `plan in ('free', 'crew_pro', 'employer_pro')`. If any rows exist with `plan = 'crew_unlimited'`, UPDATE them to `crew_pro` first (data migration before constraint change).
- [x] Rollback: restore previous CHECK (add `crew_unlimited` back, remove `employer_pro`). Self-contained.
- [x] In `packages/types/src/enums.ts` line 44: change `SubscriptionPlan` type from `'free' | 'crew_pro' | 'crew_unlimited'` to `'free' | 'crew_pro' | 'employer_pro'`.
- [x] **Rewrite `apps/web/src/lib/require-subscription.ts`:** The current rank-based comparison (`PLAN_RANK[plan] < PLAN_RANK[minimumPlan]`) cannot distinguish parallel tiers — a `crew_pro` user at rank 1 would pass an `employer_pro` gate also at rank 1. Replace with **exact plan match**: the function checks `plan === minimumPlan` (or `plan` is in an allowed set). New signature: `requireSubscription(supabase, personId, requiredPlan: 'crew_pro' | 'employer_pro')`. Logic: query subscription, check status is active/trialing, check `plan === requiredPlan`. Return 402 if not. Remove `PLAN_RANK` entirely — it served a hierarchical model that no longer applies.
- [x] **Add a helper `hasAnyPro(supabase, personId): Promise<boolean>`** for cases that just need "is this user paying for anything" (e.g., Docky — crew_pro unlocks it, but a dual-hat user with employer_pro shouldn't get Docky for free). Docky gate: keep using `requireSubscription(supabase, personId, 'crew_pro')` — only crew_pro unlocks Docky, not employer_pro.
- [x] In `apps/web/src/app/api/billing/create-checkout/route.ts`: update `getPriceId()` — remove `crew_unlimited` mapping, add `employer_pro` → `process.env.STRIPE_PRICE_EMPLOYER_PRO`. Update plan validation (line 30) to `['crew_pro', 'employer_pro']`.
- [x] In `apps/web/src/app/api/webhooks/stripe/route.ts`: update `mapPriceToPlan()` — remove `STRIPE_PRICE_CREW_UNLIMITED` check, add `if (priceId === process.env.STRIPE_PRICE_EMPLOYER_PRO) return 'employer_pro'`.
- [x] In `apps/web/src/app/api/advisor/thread/messages/route.ts` line 104: change `usageLimit = isPro ? 500 : 15` to `usageLimit = isPro ? 500 : 10`.
- [x] In `apps/web/src/app/api/advisor/usage/route.ts` line 36: change the else branch limit from `15` to `10`.
- [x] **Remove ALL `crew_unlimited` references** — 7 locations found:
  1. `packages/types/src/enums.ts` line 44 (type)
  2. `apps/web/src/lib/require-subscription.ts` lines 8, 18 (PLAN_RANK + param type)
  3. `supabase/migrations/00042_subscriptions.sql` line 16 (CHECK — handled by new migration)
  4. `apps/web/src/app/api/billing/create-checkout/route.ts` lines 7, 30 (price mapping + validation)
  5. `apps/web/src/app/api/webhooks/stripe/route.ts` line 132 (price-to-plan mapping)
     Grep for `crew_unlimited` across the entire codebase to catch any others (test files, markdown, etc.).
- [x] Tests: update all tests referencing `crew_unlimited`. Update billing checkout tests to accept `employer_pro`. Update advisor usage tests for new 10-message free limit. Update require-subscription tests (if they exist) for exact-match logic.

**Session 2 — Hat-aware billing page:**

- [x] Rewrite `apps/web/src/app/(app)/billing/page.tsx`. The page must detect the user's current hat and show the appropriate tier:
  - **Crew hat:** Show Free vs Crew Pro (€4.99/month). Features: "10 questions/month" (free) vs "500 questions/month" (pro), "General MCA guidance" vs "Allows Docky to read your profile to give personalised advice. Complete all fields in your profile for the best results", "Appear in employer searches for daywork invitations" (pro only), "5 daywork + 2 permanent templates" (pro) vs "3 daywork + 1 permanent templates" (free).
  - **Employer/Agent hat:** Show Free vs Employer/Agent Pro (€14.99/month). Features: "3 daywork + 1 permanent templates" (free) vs "Unlimited templates" (pro), "Shortlist up to 3 candidates" (free) vs "Shortlist up to 8 candidates" (pro).
- [x] The subscribe button must pass the correct plan to the checkout route: `crew_pro` for crew hat, `employer_pro` for employer/agent hat.
- [x] **Hat detection:** The billing page is a client component that currently has no access to the user's hat. Two options: (A) add `current_hat` to the `/api/billing/status` response (simplest — the status route already uses the auth guard which returns the person record), or (B) fetch `/api/profile` which returns the hat. **Recommended: option A** — add `current_hat` to the billing status response. Read `apps/web/src/app/api/billing/status/route.ts` and add the person lookup.
- [x] **Dual-hat edge case:** The `subscriptions` table has `person_id UNIQUE` — one plan per person. A crew member with `employer_pro` sees the Crew Pro card as "not subscribed" when in crew hat. A dual-hat user who wants both must switch plans via the Stripe portal. For v1, show the billing page for the current hat only. Do NOT try to show both tiers or allow dual subscriptions.
- [x] **"Current plan" badge logic:** Show badge on the Pro card only if `subscription.plan` exactly matches the displayed tier (`crew_pro` for crew hat, `employer_pro` for employer hat). Show badge on Free card if no subscription or plan doesn't match the current hat's tier.
- [x] The "Manage subscription" button (Stripe portal) works for any plan — no changes needed.
- [x] Tests: billing page renders crew tier for crew hat, employer tier for employer hat, correct plan passed to checkout

**Session 3 — Template caps:**

- [x] In `apps/web/src/app/api/daywork/templates/route.ts` POST handler: before creating the template, count existing daywork templates for this user (`SELECT count(*) FROM daywork_templates WHERE person_id = ?`). The hat is already available — the route checks `person.current_hat` (employers/agents only can create templates). Check subscription with exact match:
  - If `current_hat === 'crew'`: this shouldn't happen (templates are employer/agent only — the route already blocks crew). But as a safety net: crew_pro cap = 5 DW.
  - If `current_hat` is `'employer'` or `'agent'`: call `requireSubscription(supabase, personId, 'employer_pro')`. If ok: unlimited (skip cap check). If not ok (free): cap = 3 DW.
  - If count >= cap: return 402 `{ error: 'template_limit_reached', limit: cap, upgrade_url: '/billing' }`.
- [x] In `apps/web/src/app/api/permanent/templates/route.ts` POST handler: same pattern. Count existing permanent templates. Free employer/agent: cap = 1 PM. Employer/Agent Pro: unlimited.
- [x] **Crew template caps (for dual-hat users):** A crew member who switches to employer hat to post jobs is still gated by their subscription. If they have `crew_pro` (not `employer_pro`), they get the free employer cap (3 DW + 1 PM), not unlimited. The exact-match logic in `requireSubscription` handles this correctly — `crew_pro !== 'employer_pro'` so the check fails, free cap applies.
- [x] Client-side: when the API returns 402 with `template_limit_reached`, show a toast: "Template limit reached — upgrade to Pro for more templates" linking to `/billing`. Check where template POST responses are handled in the daywork post page and permanent post page.
- [x] Tests: free employer hits 3 DW limit, free employer hits 1 PM limit, employer_pro creates unlimited, crew_pro user in employer hat gets free cap (exact match fails), 402 response shape

**Session 4 — Shortlist cap enforcement by subscription:**

- [ ] In `apps/web/src/app/api/permanent/[id]/applicants/[crewId]/shortlist/route.ts`: the current cap comes from the posting's `shortlist_cap` field (user-settable 1-20, default 5). New logic: determine tier max from subscription. Call `requireSubscription(supabase, posterPersonId, 'employer_pro')`. If ok: tierMax = 8. If not: tierMax = 3. Effective cap = `Math.min(posting.shortlist_cap, tierMax)`. This means a free employer who set `shortlist_cap: 5` before the paywall existed gets capped at 3 at shortlist time. No data migration needed.
- [ ] In `apps/web/src/app/api/permanent/route.ts` POST handler (line ~116): clamp the submitted `shortlist_cap` to the tier max. Currently validates 1-20. Change to: check subscription, if free employer clamp to `Math.min(submittedCap, 3)`, if pro clamp to `Math.min(submittedCap, 8)`. The form input max should also reflect this.
- [ ] Client-side: in `apps/web/src/app/(app)/daywork/post/_components/permanent-form-sections.tsx` (lines 203-216), the shortlist cap input currently has `min={1} max={20}`. Change the max to the user's tier limit. This requires knowing the subscription status on the client — either pass it from the parent page (which can fetch billing status) or add it to a context/provider. The simplest approach: fetch `/api/billing/status` in the post page and pass `shortlistMax` as a prop to the form section.
- [ ] Tests: free employer shortlist blocked at 3 (even if posting says 5), pro employer allowed up to 8, posting creation clamps shortlist_cap, form input max reflects tier

---

**BLOCKED — requires user action before subscriptions work end-to-end:**

> Code can be built and tested with Stripe test mode. But real payments require:
>
> - [ ] **USER:** Create "Crew Pro" product in Stripe Dashboard (€4.99/month recurring). Copy Price ID.
> - [ ] **USER:** Create "Employer/Agent Pro" product in Stripe Dashboard (€14.99/month recurring). Copy Price ID.
> - [ ] **USER:** Set up Stripe webhook endpoint: `https://www.dockwalker.io/api/webhooks/stripe`. Copy signing secret.
> - [ ] **USER:** Set Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREW_PRO`, `STRIPE_PRICE_EMPLOYER_PRO`
> - [ ] **USER:** Test in Stripe test mode first (use `sk_test_` keys + test card `4242 4242 4242 4242`), then switch to live keys.

---

### Meals label — conditional "(optional)" on live aboard

> Daywork post form always shows "Meals provided (optional)" regardless of live aboard. Should only say "(optional)" when live aboard is checked. Permanent form has the conditional logic already.

- [ ] In `apps/web/src/app/(app)/daywork/post/page.tsx` ~line 606: make "(optional)" conditional on live aboard being checked.

---

### Verify: Agent My Jobs — may already work

> Investigation shows daywork mine uses `.eq('poster_person_id', user.id)` and permanent mine uses `.eq('employer_person_id', user.id)` — both filter by person, not role_context. Agent-posted jobs SHOULD appear.

- [ ] USER: Test again — post a job as agent, check My Jobs page. If it shows, this is resolved. If not, check the page-level hat check.

---

### Admin identity type change (deferred — medium-high effort)

> Scope captured. Build when needed.

---

## Backlog

> Active backlog. Pick items into Queue when ready.
> **Implementation agent: do NOT move items here to defer them. If a todo item
> is too hard, stop and ask — do not unilaterally deprioritise.**

### Business logic / server-side

- **Permanent crew withdrawal auto-revert** — when crew withdraws from a selected permanent posting, employer should decide next step, not auto-revert.
- **Onboarding true atomicity** — `onboard_person` RPC should be fully atomic.
- **Negotiation timeout** — auto-close permanent engagements after X days inactivity.
- **Weekly check-in cron** — periodic nudge for permanent postings with no employer activity.
- **Deactivated user server-side sign-out** — force session invalidation on PERSON.DEACTIVATED.

### Web-only UI

- **Agent market as discover mode** — let agents browse full market feed.
- **Form validation — styled inline errors** — replace browser-native validation (SUG-012).
- **Invalid URL error pages** — custom error pages for garbage URLs (SUG-013).
- **Edit experience "Unknown vessel" prefix** — seed data issue (SUG-017).
- **Applicant count badge on My Jobs**.
- **Discover filter chips**.
- **Notifications grouping**.
- **Email: List-Unsubscribe header**.
- **Share button on discover cards (crew view)** — secondary placement.

### Testing

- **Resilience tests** — network failure, timeout, retry scenarios.
- **Component tests for Permanent UI**.
- **Component tests for Form Pickers**.

### Deferred — Mobile (blocked, needs Mac + Xcode)

- **Mobile Phase 7: TestFlight validation** — app crashes on startup (SIGABRT TurboModule init). Needs Xcode debugger. See `memory/project_mobile_blocked.md`.
- **Mobile Phase 8: Android polish pass**.
- **Capacitor removal** — waiting on Phase 7 validation.
- **Mobile OTA update test**.
- **Mobile Docky hooks/screens** — update to match new single-thread API when mobile unblocks.

---

## WhatsApp — BLOCKED on user action

> Code is built and unit-tested. Real WhatsApp delivery requires:
>
> - [ ] **USER:** In Twilio Console, set up WhatsApp sender (Messaging → WhatsApp senders → Request access). Copy the approved sender number.
> - [ ] **USER:** Submit all 26 templates from `tasks/whatsapp-templates.md` to Meta via Twilio Console. Wait 24-48h for approval.
> - [ ] **USER:** Set Vercel env vars: `TWILIO_WHATSAPP_FROM` (approved sender number, format `whatsapp:+1234567890`), `NOTIFICATION_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
> - [ ] **USER:** Sign Twilio Data Processing Agreement (Twilio Console → Settings → Privacy)
> - [ ] **USER:** Configure Twilio message body retention to minimum (Settings → Privacy → Message retention)
>
> Start the Twilio WhatsApp approval process NOW — it takes 2-4 weeks. The code work can proceed in parallel.

---

## Done

(See git history for completed stages 51-200+. Recent: WhatsApp notifications Sessions 1-4, ExpandableText, text overflow audit, vessel fuzzy search, share to social, invitation direct hire, Docky production launch.)
