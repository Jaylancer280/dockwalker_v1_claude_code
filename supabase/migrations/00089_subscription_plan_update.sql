-- Migration 00089: Update subscription plans — remove crew_unlimited, add employer_pro
-- Data migration: convert any existing crew_unlimited rows to crew_pro
UPDATE public.subscriptions SET plan = 'crew_pro' WHERE plan = 'crew_unlimited';

-- Drop old CHECK and add new one
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'crew_pro', 'employer_pro'));
