import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/notifications/count
 * Returns hat-scoped unread counts for badges:
 *   notification_count — unread notifications for current hat
 *   message_count     — threads with unread messages for current hat
 *   alt_notification_count — unread notifications for the other hat
 *   alt_message_count     — threads with unread messages for the other hat
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;
    const currentHat = person.current_hat;
    const altHat = currentHat === 'crew' ? 'employer' : 'crew';

    // 1. Notification counts by hat (2 queries via Promise.all)
    const [{ count: notifCurrent }, { count: notifAlt }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('person_id', user.id)
        .eq('read', false)
        .eq('role_context', currentHat),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('person_id', user.id)
        .eq('read', false)
        .eq('role_context', altHat),
    ]);

    // 2. Engagement list (1 query)
    const { data: engagements } = await supabase
      .from('active_engagements')
      .select('id, crew_person_id, employer_person_id')
      .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`);

    let msgCurrent = 0;
    let msgAlt = 0;
    const engList = engagements ?? [];

    if (engList.length > 0) {
      // 3. Single RPC replaces N per-engagement COUNT queries
      const { data: unreadRows } = await supabase.rpc('get_unread_counts', {
        p_person_id: user.id,
      });
      const unreadMap = new Map(
        (unreadRows ?? []).map(
          (r: { engagement_id: string; unread_count: number }) =>
            [r.engagement_id, r.unread_count] as const,
        ),
      );

      for (const eng of engList) {
        if (!unreadMap.has(eng.id)) continue;

        const engHat = eng.crew_person_id === user.id ? 'crew' : 'employer';
        if (engHat === currentHat) {
          msgCurrent += 1;
        } else {
          msgAlt += 1;
        }
      }
    }

    return NextResponse.json({
      notification_count: notifCurrent ?? 0,
      message_count: msgCurrent,
      alt_notification_count: notifAlt ?? 0,
      alt_message_count: msgAlt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
