-- Rollback 00089: Restore original subscription plan CHECK constraint
-- Convert any employer_pro rows back to free (no equivalent in old schema)
UPDATE public.subscriptions SET plan = 'free' WHERE plan = 'employer_pro';

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'crew_pro', 'crew_unlimited'));
