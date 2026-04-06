# Stripe Setup Guide — DockWalker

> Stripe Dashboard + Vercel configuration needed to activate paywalls.
> Two Stripe products required: Crew Pro and Employer/Agent Pro.

## Step 1 — Create Products in Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → **Add product**
2. Create **"Crew Pro"**:
   - Name: `Crew Pro`
   - Description: `Personalised Docky AI, unlimited messages, invitation visibility, expanded templates`
   - Pricing: Recurring, monthly, **€4.99/month**
3. Create **"Employer/Agent Pro"**:
   - Name: `Employer/Agent Pro`
   - Description: `Unlimited job templates, expanded permanent shortlist cap, candidate match breakdown`
   - Pricing: Recurring, monthly, **€14.99/month**
4. After creating each, copy the **Price ID** (starts with `price_`) — you'll need both for Vercel

## Step 2 — Set Up Webhook

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://www.dockwalker.io/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_`)

## Step 3 — Set Vercel Environment Variables

Go to Vercel Dashboard → Project → Settings → Environment Variables. Add:

| Variable                    | Value         | Where to find it                            |
| --------------------------- | ------------- | ------------------------------------------- |
| `STRIPE_SECRET_KEY`         | `sk_live_...` | Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET`     | `whsec_...`   | From Step 2 (webhook signing secret)        |
| `STRIPE_PRICE_CREW_PRO`     | `price_...`   | From Step 1 (Crew Pro price ID)             |
| `STRIPE_PRICE_EMPLOYER_PRO` | `price_...`   | From Step 1 (Employer/Agent Pro price ID)   |

> Use `sk_live_` keys for production. Use `sk_test_` keys if testing first (create a separate test webhook endpoint for test mode).

## Step 4 — Redeploy

Trigger a redeploy on Vercel (push a commit or manually redeploy from the dashboard). The new env vars take effect on the next deployment.

## Step 5 — Test the Flow

1. Go to `https://www.dockwalker.io/billing`
2. Click **Subscribe** on the Crew Pro card
3. Complete the Stripe Checkout (use a test card if in test mode: `4242 4242 4242 4242`)
4. After successful payment, you should be redirected to `/billing?success=true`
5. Verify:
   - `/billing` shows "Current plan" on Crew Pro (or Employer/Agent Pro)
   - "Manage subscription" button appears (links to Stripe Customer Portal)
   - Docky message limit changes from 10/month to 500/month (Crew Pro at €4.99)
   - Template cap lifts (Employer/Agent Pro at €14.99)
   - Supabase `subscriptions` table has a row with correct `plan` and `status: 'active'`

## What the Code Does (already built)

| Route                               | Purpose                                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| `POST /api/billing/create-checkout` | Creates Stripe Checkout session, redirects to Stripe             |
| `GET /api/billing/status`           | Returns current plan + status for the billing page               |
| `POST /api/billing/create-portal`   | Creates Stripe Customer Portal session for managing subscription |
| `POST /api/webhooks/stripe`         | Handles Stripe webhook events, updates `subscriptions` table     |

| Helper                                          | Purpose                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `requireSubscription(supabase, personId, plan)` | Checks if user meets plan requirement, returns 402 if not          |
| `subscriptions` table (migration 00042)         | Stores person_id, stripe_customer_id, plan, status, billing period |

## Feature Build Status

> As of last commit (Stage 196 / 2026-04-05). Tracks what exists, what needs changing, and what's new.

### Already built and working

| Feature                                  | Status                                  | Notes                                                                                                                                    |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Docky AI message limit                   | **WORKING** — needs value change        | Currently enforces 15/month free, 500/month pro. Change free limit to **10/month**.                                                      |
| `requireSubscription()` helper           | **WORKING** — needs plan update         | Currently accepts `crew_pro` and `crew_unlimited`. Must add `employer_pro`, remove `crew_unlimited`.                                     |
| `subscriptions` table + CHECK constraint | **WORKING** — needs migration           | CHECK allows `free`, `crew_pro`, `crew_unlimited`. Must add `employer_pro`, remove `crew_unlimited`.                                     |
| Checkout route                           | **WORKING** — needs plan update         | Currently accepts `crew_pro` and `crew_unlimited`. Must accept `employer_pro`, remove `crew_unlimited`.                                  |
| Webhook route                            | **WORKING** — needs price mapping       | `getPlanFromPrice()` maps Stripe price IDs to plans. Must add `STRIPE_PRICE_EMPLOYER_PRO` mapping.                                       |
| Billing page                             | **WORKING** — needs redesign            | Currently shows two cards (Free, Crew Pro) for all users. Must be hat-aware: crew sees Crew Pro, employer/agent sees Employer/Agent Pro. |
| Billing status API                       | **WORKING** — no change needed          | Returns plan + status, works for any plan value.                                                                                         |
| Billing portal API                       | **WORKING** — no change needed          | Creates Stripe portal session, plan-agnostic.                                                                                            |
| Available Crew tab                       | **WORKING** — needs subscription filter | `/api/daywork/[id]/available-crew` returns all available crew. Must filter to only Pro crew.                                             |
| Invitation flow                          | **WORKING** — needs rework              | Currently creates application (status: shortlisted). Must create engagement directly. See todo.                                          |
| Shortlist cap                            | **WORKING** — needs tier logic          | Currently employer sets cap per posting (default 5). Must enforce max based on subscription tier.                                        |
| `buildCrewContext()`                     | **WORKING** — needs gating              | Called for all users. Must skip for free users (MCA corpus only).                                                                        |

### Not yet built

| Feature                         | Description                                                                                                                                       | Release                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Docky profile reading gate      | Skip `buildCrewContext()` for free users, adjust system prompt                                                                                    | Release 1                               |
| Docky free vs pro UI messaging  | Upsell copy in empty state, "General mode" vs "Personalised mode" indicator                                                                       | Release 1                               |
| Template cap enforcement        | Count templates at API layer, reject creates above cap                                                                                            | Release 2 (crew) / Release 3 (employer) |
| Structured candidate match view | Per-candidate checklist showing match against job spec (certs, experience, languages, vessel size) — factual breakdown, NOT a score or percentage | Release 5                               |
| Hat-aware billing page          | Crew hat sees Crew Pro features, employer/agent hat sees Employer/Agent Pro features                                                              | Release 3                               |
| Crew-side visibility upsell     | "Upgrade to Crew Pro to appear in employer searches" on availability overlay                                                                      | Release 2                               |

---

## Pricing & Subscription Decisions

> Decisions confirmed 2026-04-05. Prices TBD — fill in before Stripe product creation.

### Tier Structure

Three plans: `free`, `crew_pro`, `employer_pro`. Two Stripe products (Crew Pro, Employer/Agent Pro).

`crew_unlimited` is **removed** — it has no distinct behaviour and adds confusion.

|                             | Free | Crew Pro                | Employer/Agent Pro       |
| --------------------------- | ---- | ----------------------- | ------------------------ |
| **Monthly price**           | €0   | **€4.99/month**         | **€14.99/month**         |
| **Annual price** (deferred) | —    | €39.99/year (Release 4) | €119.99/year (Release 4) |
| **Trial period** (deferred) | —    | Deferred to Release 4   | Deferred to Release 4    |

**Pricing rationale:** Crew Pro at €4.99 is less than half a day's daywork pay (€100-150/day in Antibes). Cheaper than CrewHQ (£10/month) while offering more (AI advisor + invitation visibility). Employer/Agent Pro at €14.99 is a fraction of one agency placement fee (€250+ for a single temp hire). Both prices are deliberately low for launch — build adoption first, raise employer tier later once the crew database has proven value. Competitor Yotspot charges £2,495/year for employer access; there's significant headroom.

### Crew Features by Tier (CONFIRMED)

| Feature                                                                  | Free                    | Crew Pro                                               |
| ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------ |
| Browse & apply to daywork                                                | Yes                     | Yes                                                    |
| Browse & apply to permanent roles                                        | Yes                     | Yes                                                    |
| Messaging (after acceptance/selection)                                   | Yes                     | Yes                                                    |
| Profile creation & editing                                               | Yes                     | Yes                                                    |
| Docky AI — MCA documentation Q&A                                         | **10 questions/month**  | 500/month                                              |
| Docky AI — personalised advice (reads your profile, certs, work history) | No (MCA corpus only)    | Yes                                                    |
| Daywork invitation visibility (appear in Available Crew tab)             | **No**                  | **Yes**                                                |
| Invitation = direct hire (accept invitation creates engagement)          | N/A (not visible)       | **Yes**                                                |
| Daywork templates                                                        | 3 daywork + 1 permanent | **5 daywork + 2 permanent** (bonus, not selling point) |
| Permanent templates                                                      | (included in cap above) | (included in cap above)                                |

**Key decisions:**

- Free Docky: **10/month** (down from 15). Enough for 2-3 real questions with follow-ups. Not enough for daily use.
- Invitation visibility is the key crew lever — Pro crew appear in Available Crew tab, free crew don't.
- When Pro crew accept an invitation, it creates an engagement directly (not an application). See invitation flow change below.
- Crew Pro gets a modest template cap bump as a bonus feature for dual-hat users.
- Billing page copy for Docky personalised: "Allows Docky to read your profile to give personalised advice. Complete all fields in your profile for the best results." Do NOT list cert gap analysis as a separate bullet — it's part of personalised advice.

### Employer/Agent Features by Tier (CONFIRMED)

| Feature                         | Free              | Employer/Agent Pro                                         |
| ------------------------------- | ----------------- | ---------------------------------------------------------- |
| Post daywork jobs               | Yes               | Yes                                                        |
| Post permanent jobs             | Yes               | Yes                                                        |
| Review applicants               | Yes               | Yes                                                        |
| Accept/reject/shortlist         | Yes               | Yes                                                        |
| Messaging                       | Yes               | Yes                                                        |
| Invite available crew (daywork) | Yes               | Yes                                                        |
| Daywork templates               | **3 max**         | **Unlimited**                                              |
| Permanent templates             | **1 max**         | **Unlimited**                                              |
| Permanent shortlist cap         | **3 per posting** | **8 per posting**                                          |
| Structured candidate match view | No                | **Yes** — per-candidate factual breakdown against job spec |

**Key decisions:**

- Two levers: templates (volume) and shortlist cap (depth). Agents who post many jobs need unlimited templates. Employers hiring for competitive roles need a deeper shortlist pipeline.
- Permanent shortlist cap: Free 3, Pro 8. Tight enough that free feels limiting on competitive roles, generous enough that Pro is a real upgrade. Crew still see "1 of X" — they see the cap (a property of the job), never the fill count.
- Structured candidate match view (Pro only, Release 5): per-candidate checklist showing factual match against the job spec — certs (4/4 required), experience bracket (matches/doesn't match), languages (has/missing), vessel size exposure (matches/doesn't match). **NOT a percentage or composite score** — that would be a ranking system. Factual breakdown only, employer does the synthesis. This leaves room for a future "Employer Unlimited" tier with richer analytics.
- Agents don't need Docky (crew-only feature) — templates + shortlist cap are the right levers for agents.
- Employers and agents share the same tier, same price, same features. Prevents agents signing up as crew to dodge the paywall.
- All other employer actions (posting, reviewing, accepting, messaging) remain free — maximises job supply at launch.

### Invitation Flow Change (CONFIRMED)

Current: Employer invites crew -> Crew accepts -> Application created (status: shortlisted) -> Employer must still accept from review page.

**New flow:** Employer invites crew -> Crew accepts -> **Engagement created directly** (same as employer accepting an applicant). Message thread opens immediately. Position slot filled.

Rationale: If crew pays for visibility and gets invited, being dumped back into the applicant pool is paying for nothing. The employer already chose them — the invitation IS the selection. This mirrors reality: a captain taps someone on the dock and says "I need you Monday." If they say yes, they're hired.

Race condition handling: If the position fills while the invitation is pending (another crew member applied and was accepted), the invitation acceptance checks positions_available vs positions_filled and returns "position filled" instead of silently failing. No timer needed — existing safeguards handle this.

### Pricing Strategy (CONFIRMED)

- **Currency:** EUR. The superyacht industry in launch regions (Antibes, Palma, Caribbean, Dubai) predominantly uses EUR for crew pay. Stripe handles currency conversion for non-EUR cards automatically.
- **Billing cycle:** Monthly only at launch. Annual (33% discount) deferred to Release 4.
- **Cancellation:** End-of-billing-period (Stripe default). No immediate downgrade.
- **Price increase strategy:** Crew Pro stays at €4.99 indefinitely — crew are price-sensitive. Employer/Agent Pro can increase to €29.99-€49.99 once the crew database has proven value. Grandfather existing subscribers at their original price.

### Subscription Release Roadmap

**Release 1 — Crew Pro MVP:**

- [ ] Remove `crew_unlimited` from CHECK constraint, `require-subscription.ts`, billing page, checkout route, webhook
- [ ] Change Docky free limit from 15 to 10 per month
- [ ] Gate Docky profile reading behind Crew Pro (free = MCA only)
- [ ] Tighten Docky system prompt (reduce hallucination)
- [ ] Docky UI free vs pro messaging (upsell copy in empty state)
- [ ] Billing page updated for Crew Pro presentation

**Release 2 — Crew Pro full + invitation rework:**

- [ ] Invitation = direct hire flow (new event handling, engagement on accept)
- [ ] Gate Available Crew tab behind crew_pro (exclude free crew from results)
- [ ] Template caps for crew (3 DW + 1 PM free, 5 DW + 2 PM pro)

**Release 3 — Employer/Agent Pro:**

- [ ] Add `employer_pro` plan to CHECK constraint, `require-subscription.ts`
- [ ] Create second Stripe product (Employer/Agent Pro)
- [ ] Template cap enforcement at API layer (3 DW + 1 PM free, unlimited pro)
- [ ] Shortlist cap enforcement: free 3, pro 8 — enforce at projection layer and API validation on permanent post form
- [ ] Billing page: hat-aware display (crew sees Crew Pro, employer/agent sees Employer/Agent Pro)
- [ ] Checkout route accepts `employer_pro` plan

**Release 4 — Polish & optimisation (deferred):**

- [ ] Annual billing option
- [ ] Free trial period
- [ ] Dunning emails
- [ ] Usage analytics (conversion rate, churn)

**Release 5 — Employer value expansion (deferred):**

- [ ] Structured candidate match view — per-candidate factual checklist against job spec (certs, experience, languages, vessel size). NOT a percentage. NOT a score. Factual breakdown only. Employer Pro only.
- [ ] This leaves room for a future "Employer Unlimited" tier with richer features (bulk actions, aggregate analytics, etc.)

### Non-Negotiables (from mission doc)

- No boosts. No priority listing manipulation. No pay-to-rank.
- Invitation visibility is "be findable", not "be ranked higher" — no sorting advantage for Pro crew.
- Salary is informational, not a bidding mechanic.
- No competition metrics surfaced to crew.
- Free tier must be genuinely useful — not a crippled demo. Free crew can browse, apply, message, rate, and use Docky (10/month).

---

## Test Mode vs Live Mode

To test without real payments:

1. Use Stripe **test mode** API keys (`sk_test_...`)
2. Create a separate test webhook endpoint pointing to your preview/staging URL
3. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
4. Switch to live keys (`sk_live_...`) when ready for real payments

## Troubleshooting

| Issue                                  | Cause                         | Fix                                           |
| -------------------------------------- | ----------------------------- | --------------------------------------------- |
| "Subscribe" button does nothing        | `STRIPE_SECRET_KEY` not set   | Add to Vercel env vars, redeploy              |
| Checkout works but plan doesn't update | Webhook not firing            | Check webhook endpoint URL and signing secret |
| Webhook returns 400                    | Wrong `STRIPE_WEBHOOK_SECRET` | Re-copy from Stripe dashboard                 |
| User still shows "free" after payment  | Webhook event not handled     | Check Vercel logs for webhook errors          |
