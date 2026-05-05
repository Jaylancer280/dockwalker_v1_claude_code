import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionPlan } from '@dockwalker/types';

type SubscriptionResult =
  | { ok: true; plan: SubscriptionPlan }
  | { ok: false; response: NextResponse };

/**
 * Check that the user has an active subscription matching the required plan exactly.
 * Crew Pro and Employer Pro are parallel tiers — one does not satisfy the other.
 *
 * B-014: queries are now keyed on `(person_id, plan)` since a single
 * person can hold both Crew Pro and Employer Pro rows simultaneously.
 * Each helper returns the row for the *requested* plan only; absence
 * means the user has not subscribed to that tier (a separate active
 * crew_pro subscription does not satisfy a required employer_pro check
 * and vice versa).
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
    .eq('plan', requiredPlan)
    .maybeSingle();

  const isActive = data?.status === 'active' || data?.status === 'trialing';

  if (!isActive || data?.plan !== requiredPlan) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Subscription required', required_plan: requiredPlan },
        { status: 402 },
      ),
    };
  }
  return { ok: true, plan: data.plan as SubscriptionPlan };
}

/**
 * Check if the user has any active Pro subscription (crew_pro or employer_pro).
 *
 * B-014: a person can now have rows for both pro tiers simultaneously,
 * plus a `'free'` anchor row. The query filters to the two pro plans
 * with active/trialing status; if either matches, the user has at
 * least one active Pro subscription.
 */
export async function hasAnyPro(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('person_id', personId)
    .in('plan', ['crew_pro', 'employer_pro'])
    .in('status', ['active', 'trialing'])
    .limit(1);

  return (data?.length ?? 0) > 0;
}
