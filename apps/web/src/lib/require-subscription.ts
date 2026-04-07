import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionPlan } from '@dockwalker/types';

type SubscriptionResult =
  | { ok: true; plan: SubscriptionPlan }
  | { ok: false; response: NextResponse };

/**
 * Check that the user has an active subscription matching the required plan exactly.
 * Crew Pro and Employer Pro are parallel tiers — one does not satisfy the other.
 */
export async function requireSubscription(
  supabase: SupabaseClient,
  personId: string,
  requiredPlan: 'crew_pro' | 'employer_pro',
): Promise<SubscriptionResult> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('person_id', personId)
    .single();

  const plan: SubscriptionPlan = data?.plan ?? 'free';
  const isActive = data?.status === 'active' || data?.status === 'trialing';

  if (!isActive || plan !== requiredPlan) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Subscription required', required_plan: requiredPlan },
        { status: 402 },
      ),
    };
  }
  return { ok: true, plan };
}

/**
 * Check if the user has any active Pro subscription (crew_pro or employer_pro).
 */
export async function hasAnyPro(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('person_id', personId)
    .single();

  if (!data) return false;
  const isActive = data.status === 'active' || data.status === 'trialing';
  return isActive && (data.plan === 'crew_pro' || data.plan === 'employer_pro');
}
