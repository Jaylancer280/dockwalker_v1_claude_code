import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvents, type AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';

const REASON_CATEGORIES = [
  'harassment',
  'fraud',
  'safety_concern',
  'spam',
  'impersonation',
  'other',
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

  if (personId === adminPerson.id) {
    return NextResponse.json({ error: 'Cannot block your own account' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { reason_category, reason_text } = body;

    if (!reason_category || !REASON_CATEGORIES.includes(reason_category)) {
      return NextResponse.json({ error: 'Invalid reason_category' }, { status: 400 });
    }
    if (!reason_text || typeof reason_text !== 'string') {
      return NextResponse.json({ error: 'reason_text is required' }, { status: 400 });
    }

    const { data: target } = await serviceClient
      .from('persons')
      .select('id, is_admin, blocked_at')
      .eq('id', personId)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (target.is_admin) {
      return NextResponse.json(
        { error: 'Cannot block an admin — demote first via direct DB access' },
        { status: 400 },
      );
    }
    if (target.blocked_at) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    // Query cascade targets
    const [
      { data: activeEngagements },
      { data: activePostingsDW },
      { data: activePostingsPM },
      { data: futureAvailability },
    ] = await Promise.all([
      serviceClient
        .from('active_engagements')
        .select('id, daywork_id, permanent_posting_id')
        .or(`crew_person_id.eq.${personId},employer_person_id.eq.${personId}`)
        .eq('status', 'active'),
      serviceClient
        .from('dayworks')
        .select('id')
        .eq('poster_person_id', personId)
        .in('status', ['active', 'in_progress']),
      serviceClient
        .from('permanent_postings')
        .select('id')
        .eq('employer_person_id', personId)
        .in('status', ['active', 'in_negotiation']),
      serviceClient
        .from('availability_windows')
        .select('id')
        .eq('person_id', personId)
        .gt('expires_at', new Date().toISOString())
        .limit(1),
    ]);

    const events: AppendEventParams<keyof EventPayloadMap>[] = [
      {
        eventType: 'ADMIN.USER_BLOCKED',
        aggregateId: personId,
        aggregateType: 'admin',
        roleContext: 'employer',
        payload: {
          person_id: personId,
          reason_category,
          reason_text,
          admin_person_id: adminPerson.id,
        },
        personId: adminPerson.id,
      },
    ];

    for (const eng of activeEngagements ?? []) {
      events.push({
        eventType: 'ADMIN.ENGAGEMENT_CANCELLED',
        aggregateId: eng.id,
        aggregateType: 'admin',
        roleContext: 'employer',
        payload: {
          engagement_id: eng.id,
          posting_type: eng.daywork_id ? 'daywork' : 'permanent',
          daywork_id: eng.daywork_id ?? undefined,
          permanent_posting_id: eng.permanent_posting_id ?? undefined,
          reason_category: 'other',
          reason_text: 'Account suspended by DockWalker',
          admin_person_id: adminPerson.id,
        },
        personId: adminPerson.id,
      });
    }

    // Collect posting IDs already cancelled via engagement cascade
    const cascadedDayworkIds = new Set(
      (activeEngagements ?? []).filter((e) => e.daywork_id).map((e) => e.daywork_id),
    );
    const cascadedPermanentIds = new Set(
      (activeEngagements ?? [])
        .filter((e) => e.permanent_posting_id)
        .map((e) => e.permanent_posting_id),
    );

    for (const posting of activePostingsDW ?? []) {
      if (!cascadedDayworkIds.has(posting.id)) {
        events.push({
          eventType: 'ADMIN.POSTING_HIDDEN',
          aggregateId: posting.id,
          aggregateType: 'admin',
          roleContext: 'employer',
          payload: {
            posting_id: posting.id,
            posting_type: 'daywork',
            reason: 'Account suspended by DockWalker',
            admin_person_id: adminPerson.id,
          },
          personId: adminPerson.id,
        });
      }
    }

    for (const posting of activePostingsPM ?? []) {
      if (!cascadedPermanentIds.has(posting.id)) {
        events.push({
          eventType: 'ADMIN.POSTING_HIDDEN',
          aggregateId: posting.id,
          aggregateType: 'admin',
          roleContext: 'employer',
          payload: {
            posting_id: posting.id,
            posting_type: 'permanent',
            reason: 'Account suspended by DockWalker',
            admin_person_id: adminPerson.id,
          },
          personId: adminPerson.id,
        });
      }
    }

    if ((futureAvailability ?? []).length > 0) {
      const today = new Date().toISOString().split('T')[0];
      events.push({
        eventType: 'AVAILABILITY.SET',
        aggregateId: personId,
        aggregateType: 'person',
        roleContext: 'crew',
        payload: {
          not_available: true,
          start_date: today,
          end_date: today,
          expires_at: new Date().toISOString(),
        },
        personId,
      });
    }

    await appendEvents(serviceClient, events);

    // Withdraw pending applications (direct update, no individual events)
    await serviceClient
      .from('applications')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('crew_person_id', personId)
      .in('status', ['applied', 'viewed', 'shortlisted']);

    // Clear unread notifications
    await serviceClient.from('notifications').delete().eq('person_id', personId).eq('read', false);

    return NextResponse.json({
      success: true,
      cascade: {
        engagements_cancelled: (activeEngagements ?? []).length,
        postings_hidden:
          (activePostingsDW ?? []).length +
          (activePostingsPM ?? []).length -
          cascadedDayworkIds.size -
          cascadedPermanentIds.size,
        availability_cleared: (futureAvailability ?? []).length > 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to block user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
