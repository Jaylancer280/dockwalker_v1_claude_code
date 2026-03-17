import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/billing/status
 * Returns the current user's subscription plan + status.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('person_id', user.id)
      .single();

    if (!data) {
      return NextResponse.json({ plan: 'free', status: null });
    }

    return NextResponse.json({
      plan: data.plan,
      status: data.status,
      current_period_end: data.current_period_end,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
