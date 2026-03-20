import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/notifications/count
 * Returns hat-scoped unread counts for badges:
 *   notification_count — unread notifications for current hat
 *   message_count     — unread messages for current hat
 *   alt_notification_count — unread notifications for the other hat
 *   alt_message_count     — unread messages for the other hat
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;
    const currentHat = person.current_hat;
    const altHat = currentHat === 'crew' ? 'employer' : 'crew';

    // Notification counts by hat
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

    // Message unread counts split by hat
    // crew hat messages = engagements where user is crew_person_id
    // employer hat messages = engagements where user is employer_person_id
    const { data: engagements } = await supabase
      .from('active_engagements')
      .select('id, crew_person_id, employer_person_id')
      .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`);

    let msgCurrent = 0;
    let msgAlt = 0;
    const engList = engagements ?? [];

    if (engList.length > 0) {
      const engIds = engList.map((e) => e.id);

      const { data: cursors } = await supabase
        .from('message_read_cursors')
        .select('engagement_id, last_read_at')
        .eq('person_id', user.id)
        .in('engagement_id', engIds);

      const cursorMap = new Map<string, string>();
      for (const c of cursors ?? []) {
        cursorMap.set(c.engagement_id, c.last_read_at);
      }

      for (const eng of engList) {
        const lastRead = cursorMap.get(eng.id) ?? '1970-01-01T00:00:00Z';
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('engagement_id', eng.id)
          .neq('sender_person_id', user.id)
          .gt('created_at', lastRead);

        const unread = count ?? 0;
        if (unread === 0) continue;

        // Determine which hat this engagement belongs to
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
