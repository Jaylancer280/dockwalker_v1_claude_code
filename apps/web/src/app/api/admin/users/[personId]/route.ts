import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvents, type AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';
import { cascadeBlock } from '@/lib/admin/cascade-block';

/**
 * DELETE /api/admin/users/:personId
 * Scrub user: emits PERSON.DATA_SCRUBBED + PERSON.DEACTIVATED, then bans auth row.
 * Event rows preserved for audit. PII removed from projections.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  if (personId === adminPerson.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    const { data: target } = await serviceClient
      .from('persons')
      .select('id, is_admin, blocked_at')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (target.is_admin) {
      return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 400 });
    }

    if (!target.blocked_at) {
      await cascadeBlock(serviceClient, personId, adminPerson.id, {
        reasonText: 'Account deleted by DockWalker',
      });
    }

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'PERSON.DATA_SCRUBBED',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'employer',
        payload: {},
        personId,
      },
      {
        eventType: 'PERSON.DEACTIVATED',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'employer',
        payload: {},
        personId,
      },
    ];

    await appendEvents(serviceClient, events);

    const { error: banError } = await serviceClient.auth.admin.updateUserById(personId, {
      ban_duration: '876000h',
    });

    if (banError) {
      return NextResponse.json(
        { error: `User scrubbed but auth ban failed: ${banError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/:personId
 * Admin-only user detail view.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { personId } = await params;

  try {
    const [{ data: person }, { data: profile }, { data: subscription }, { count: eventCount }] =
      await Promise.all([
        serviceClient.from('persons').select('*').eq('id', personId).single(),
        serviceClient.from('profiles').select('*').eq('person_id', personId).single(),
        serviceClient.from('subscriptions').select('*').eq('person_id', personId).maybeSingle(),
        serviceClient
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', personId),
      ]);

    if (!person) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      person,
      profile,
      subscription: subscription ?? null,
      eventCount: eventCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
