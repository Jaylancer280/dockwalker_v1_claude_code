import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface SubscriptionEntry {
  status: string;
  current_period_end: string | null;
}

/**
 * GET /api/billing/status
 *
 * Returns the current user's subscription state per Pro tier. A person
 * can hold both Crew Pro and Employer Pro simultaneously after B-014
 * (migration 00139), so the response is a per-plan map rather than a
 * single `{ plan, status }` shape.
 *
 * Response:
 *   {
 *     subscriptions: {
 *       crew_pro: { status, current_period_end } | null,
 *       employer_pro: { status, current_period_end } | null,
 *     },
 *     current_hat: 'crew' | 'employer' | 'agent' | null,
 *   }
 *
 * `null` per-plan means the user has never subscribed to that tier (or
 * the row exists but with status outside of active/trialing/cancelled
 * grace, e.g., the `'free'` anchor row). Cancelled-but-still-in-period
 * rows return their entry so the UI can render the "Cancels DATE"
 * state.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('person_id', user.id)
      .in('plan', ['crew_pro', 'employer_pro']);

    const subscriptions: {
      crew_pro: SubscriptionEntry | null;
      employer_pro: SubscriptionEntry | null;
    } = { crew_pro: null, employer_pro: null };

    for (const row of (data ?? []) as Array<{
      plan: string;
      status: string;
      current_period_end: string | null;
    }>) {
      if (row.plan === 'crew_pro' || row.plan === 'employer_pro') {
        subscriptions[row.plan] = {
          status: row.status,
          current_period_end: row.current_period_end,
        };
      }
    }

    return NextResponse.json({
      subscriptions,
      current_hat: person.current_hat,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
