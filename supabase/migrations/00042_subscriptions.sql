-- =============================================================================
-- Migration 00042: Subscriptions
--
-- 1. Create subscriptions table
-- 2. RLS policies (owner read-only, service role writes)
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
