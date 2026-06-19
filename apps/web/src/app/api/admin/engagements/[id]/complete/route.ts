import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/admin/engagements/:id/complete
 * Admin force-complete a stuck engagement.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;
  const { id: engagementId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    // Verify engagement exists and is active
    const { data: engagement } = await serviceClient
      .from('active_engagements')
      .select('id, daywork_id, status')
      .eq('id', engagementId)
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    if (engagement.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot complete engagement in ${engagement.status} status` },
        { status: 400 },
      );
    }

    await appendEvent(serviceClient, {
      eventType: 'ADMIN.ENGAGEMENT_COMPLETED',
      aggregateId: engagementId,
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: {
        engagement_id: engagementId,
        daywork_id: engagement.daywork_id,
        reason: reason.trim(),
        admin_person_id: user.id,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete engagement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
