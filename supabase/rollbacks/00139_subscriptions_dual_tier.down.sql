-- =============================================================================
-- Rollback for Migration 00139: Dual-tier subscriptions
--
-- WARNING: DESTRUCTIVE.
--
-- The forward migration allows a person to hold up to 3 subscription rows
-- (1 'free' + 1 'crew_pro' + 1 'employer_pro'). To restore the original
-- (person_id) UNIQUE constraint, every person must be reduced to exactly
-- one row first. This rollback DELETES the newer rows per person, keeping
-- only the OLDEST row by id ordering.
--
-- If multi-row state has already been written to the table (i.e., the
-- forward migration has been live and any user has subscribed to a second
-- tier), running this rollback WILL DELETE those subscription rows.
-- The corresponding Stripe subscriptions remain active on Stripe — the
-- next webhook event for those orphans will fail to match a row and
-- trigger Sentry. Operators must manually cancel orphaned Stripe
-- subscriptions before running this rollback if they want clean state.
--
-- The same caveat applies to stripe_customer_id: re-imposing UNIQUE may
-- reject the customer that anchored multiple rows; the destructive DELETE
-- step ahead of it is what makes the constraint re-addable.
-- =============================================================================

DO $$
DECLARE
  multi_row_count int;
BEGIN
  SELECT COUNT(*) INTO multi_row_count
  FROM (
    SELECT person_id
    FROM public.subscriptions
    GROUP BY person_id
    HAVING COUNT(*) > 1
  ) AS multi;

  IF multi_row_count > 0 THEN
    RAISE NOTICE 'Rollback 00139: % person(s) hold multiple subscription rows. Destructive DELETE will run, keeping only oldest row per person. Stripe-side cancellation must be performed manually before this rollback.', multi_row_count;
  END IF;
END $$;

-- Defensive DELETE: keep only the oldest row per person (smallest id by
-- text order — UUIDv4 ids are random but deterministic per row).
DELETE FROM public.subscriptions
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY created_at ASC, id ASC))[1]
  FROM public.subscriptions
  GROUP BY person_id
);

-- Drop new constraints + indexes.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_person_plan_key;
DROP INDEX IF EXISTS public.subscriptions_stripe_subscription_id_key;
DROP INDEX IF EXISTS public.idx_subscriptions_person;

-- Re-add the original UNIQUE constraints.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_person_id_key UNIQUE (person_id);
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_stripe_customer_id_key UNIQUE (stripe_customer_id);
