import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvents, type AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';

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
      .select('id, blocked_at, deactivated_at')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!target.blocked_at && !target.deactivated_at) {
      return NextResponse.json({ error: 'User is not blocked or deactivated' }, { status: 400 });
    }

    const events: AppendEventParams<keyof EventPayloadMap>[] = [];

    if (target.blocked_at) {
      events.push({
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
    }

    if (target.deactivated_at) {
      events.push({
        eventType: 'PERSON.REACTIVATED',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'employer',
        payload: {},
        personId,
      });
    }

    if (events.length > 0) {
      await appendEvents(serviceClient, events);
    }

    // Lift auth ban
    const { error: unbanError } = await serviceClient.auth.admin.updateUserById(personId, {
      ban_duration: 'none',
    });

    if (unbanError) {
      return NextResponse.json(
        { error: `User restored but auth unban failed: ${unbanError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      unblocked: !!target.blocked_at,
      reactivated: !!target.deactivated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to restore user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
