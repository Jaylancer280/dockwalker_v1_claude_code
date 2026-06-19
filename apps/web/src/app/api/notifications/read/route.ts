import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/notifications/read
 * Mark notifications as read.
 * Body: { notificationIds: string[] } or { all: true }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const body = await request.json().catch(() => ({}));
    const { notificationIds, all } = body;

    if (all === true) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('person_id', user.id)
        .eq('read', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        notificationIds.length > 100 ||
        !notificationIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))
      ) {
        return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 });
      }
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('person_id', user.id)
        .in('id', notificationIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: 'Provide notificationIds array or { all: true }' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
