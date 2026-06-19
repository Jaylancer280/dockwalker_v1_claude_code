import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export const revalidate = 60;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  try {
    const [
      { count: totalUsers },
      { count: activeUsers7d },
      { count: newSignups7d },
      { count: blockedUsers },
      { count: activeDaywork },
      { count: activePermanent },
      { count: activeEngagements },
      { count: completedWeek },
      { count: cancelledWeek },
    ] = await Promise.all([
      serviceClient
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .is('deactivated_at', null),
      serviceClient
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .is('deactivated_at', null)
        .gte('last_event_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      serviceClient
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      serviceClient
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .not('blocked_at', 'is', null),
      serviceClient
        .from('dayworks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      serviceClient
        .from('permanent_postings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      serviceClient
        .from('active_engagements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      serviceClient
        .from('active_engagements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      serviceClient
        .from('active_engagements')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      activeUsers7d: activeUsers7d ?? 0,
      newSignups7d: newSignups7d ?? 0,
      blockedUsers: blockedUsers ?? 0,
      activeDaywork: activeDaywork ?? 0,
      activePermanent: activePermanent ?? 0,
      activeEngagements: activeEngagements ?? 0,
      completedWeek: completedWeek ?? 0,
      cancelledWeek: cancelledWeek ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch metrics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
