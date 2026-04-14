import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  try {
    const body = await request.json();
    const { reason_text } = body;

    if (!reason_text || typeof reason_text !== 'string') {
      return NextResponse.json({ error: 'reason_text is required' }, { status: 400 });
    }

    const { data: target } = await serviceClient
      .from('persons')
      .select('id, blocked_at')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!target.blocked_at) {
      return NextResponse.json({ error: 'User is not blocked' }, { status: 400 });
    }

    await appendEvent(serviceClient, {
      eventType: 'ADMIN.USER_UNBLOCKED',
      aggregateId: personId,
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: {
        person_id: personId,
        reason_text,
        admin_person_id: adminPerson.id,
      },
      personId: adminPerson.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unblock user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
