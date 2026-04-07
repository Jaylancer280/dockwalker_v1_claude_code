import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/messages/[engagementId]/call-ended
 * Inserts a system message recording the voice call duration.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase, serviceClient } = guard.value;
    const { engagementId } = await params;

    // Verify engagement membership + active status
    const { data: eng } = await supabase
      .from('active_engagements')
      .select('id, status, crew_person_id, employer_person_id')
      .eq('id', engagementId)
      .single();

    if (!eng) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    if (eng.crew_person_id !== user.id && eng.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Not a member of this engagement' }, { status: 403 });
    }

    if (eng.status !== 'active') {
      return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const duration = typeof body.duration === 'number' ? Math.max(0, Math.round(body.duration)) : 0;

    // Format duration
    let durationText: string;
    if (duration < 60) {
      durationText = `${duration}s`;
    } else {
      const m = Math.floor(duration / 60);
      const s = duration % 60;
      durationText = s > 0 ? `${m}m ${s}s` : `${m}m`;
    }

    await appendEvent(serviceClient, {
      eventType: 'MESSAGE.SENT',
      aggregateId: engagementId,
      aggregateType: 'message',
      roleContext: 'crew',
      payload: {
        id: crypto.randomUUID(),
        content: `Voice call — ${durationText}`,
        is_system: true,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
