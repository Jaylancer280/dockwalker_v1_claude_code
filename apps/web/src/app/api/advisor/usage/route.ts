import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { requireSubscription } from '@/lib/require-subscription';

/**
 * GET /api/advisor/usage
 * Returns the crew member's Docky usage for the current month.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    const subResult = await requireSubscription(supabase, user.id, 'crew_pro');

    if (subResult.ok) {
      return NextResponse.json({ used: null, limit: null, plan: subResult.plan });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from('advisor_usage')
      .select('question_count')
      .eq('person_id', user.id)
      .eq('month', currentMonth)
      .single();

    return NextResponse.json({ used: usage?.question_count ?? 0, limit: 3 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
