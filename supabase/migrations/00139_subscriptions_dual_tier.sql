-- =============================================================================
-- Migration 00139: Dual-tier subscriptions (B-014 phase 1)
--
-- Allow a single person to hold both Crew Pro and Employer Pro subscriptions
-- simultaneously, billed and cancellable independently. Today the schema
-- enforces one-row-per-person via inline UNIQUE constraints on
-- subscriptions.person_id and subscriptions.stripe_customer_id (00042). With
-- the dual-hat product model, that's an architectural artifact — Stripe
-- already supports multiple active subscriptions per customer.
--
-- Constraint changes:
--   - DROP UNIQUE on (person_id) — was preventing the second pro tier
--   - DROP UNIQUE on (stripe_customer_id) — same Stripe customer can now
--     anchor up to 3 rows (free + crew_pro + employer_pro)
--   - ADD UNIQUE on (person_id, plan) — each plan tier appears at most
--     once per person (so a person has at most: 1 'free' + 1 'crew_pro'
--     + 1 'employer_pro' = 3 rows)
--   - ADD partial UNIQUE on stripe_subscription_id WHERE NOT NULL — the
--     'free' row has no sub_id; pro rows do, and Stripe-side identity
--     stays enforceable for every pro row
--   - ADD INDEX on person_id — replaces the fast lookup the dropped
--     UNIQUE was providing (used by the webhook + every billing route)
--
-- No data rewrite. Existing rows are at most 1 per person and already
-- satisfy the new (person_id, plan) UNIQUE.
--
-- No projection / RLS changes — `subscriptions` is a CRUD utility table
-- (documented exception per CLAUDE.md), not part of the event ledger.
-- =============================================================================

-- DROP existing inline UNIQUE constraints. The conventional Postgres
-- auto-name for an inline column `unique` is `<table>_<column>_key`. The
-- IF EXISTS clauses keep this idempotent if the names ever drift.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_person_id_key;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_stripe_customer_id_key;

-- ADD the new composite (person_id, plan) UNIQUE.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_person_plan_key UNIQUE (person_id, plan);

-- ADD partial UNIQUE on stripe_subscription_id (only meaningful for pro
-- rows; 'free' rows have NULL here and would otherwise fail a strict
-- UNIQUE).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Replace the fast lookup the dropped (person_id) UNIQUE provided.
-- Used by /api/billing/status, create-checkout, create-portal, the
-- Stripe webhook, and every Pro-gate downstream query.
CREATE INDEX IF NOT EXISTS idx_subscriptions_person
  ON public.subscriptions (person_id);
