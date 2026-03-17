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
