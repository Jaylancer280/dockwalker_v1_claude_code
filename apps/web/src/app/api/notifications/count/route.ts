import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/notifications/count
 * Lightweight endpoint for badge polling.
 * Returns combined unread count (notifications + messages).
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    // Notification unread count
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', user.id)
      .eq('read', false);

    // Message unread count: messages newer than cursor, from other person
    // Get all engagement IDs for this user
    const { data: engagements } = await supabase
      .from('active_engagements')
      .select('id')
      .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`);

    let messageUnread = 0;
    const engIds = (engagements ?? []).map((e) => e.id);

    if (engIds.length > 0) {
      // Get cursors
      const { data: cursors } = await supabase
        .from('message_read_cursors')
        .select('engagement_id, last_read_at')
        .eq('person_id', user.id)
        .in('engagement_id', engIds);

      const cursorMap = new Map<string, string>();
      for (const c of cursors ?? []) {
        cursorMap.set(c.engagement_id, c.last_read_at);
      }

      // Count unread messages per engagement
      for (const engId of engIds) {
        const lastRead = cursorMap.get(engId) ?? '1970-01-01T00:00:00Z';
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('engagement_id', engId)
          .neq('sender_person_id', user.id)
          .gt('created_at', lastRead);

        messageUnread += count ?? 0;
      }
    }

    return NextResponse.json({ unread_count: (notifCount ?? 0) + messageUnread });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
