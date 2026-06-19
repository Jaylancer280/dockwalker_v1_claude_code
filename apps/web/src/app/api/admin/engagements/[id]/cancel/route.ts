import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';
import { logAdminAction } from '@/lib/admin/log-action';

const REASON_CATEGORIES = [
  'safety_concern',
  'fraud',
  'harassment',
  'inappropriate_content',
  'duplicate_account',
  'other',
] as const;

/**
 * POST /api/admin/engagements/:id/cancel
 * Force-cancel an active engagement. Emits ADMIN.ENGAGEMENT_CANCELLED which
 * cancels the engagement, writes a system message, and (for daywork) cancels
 * the posting + pending applications. For permanent engagements, closes the
 * engagement and cancels the posting.
 * Body: { reason_category, reason_text }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { serviceClient, person: adminPerson } = guard.value;
    const { id: engagementId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const reasonCategory =
      body && typeof body === 'object' && 'reason_category' in body
        ? (body as { reason_category: unknown }).reason_category
        : null;
    const reasonText =
      body && typeof body === 'object' && 'reason_text' in body
        ? (body as { reason_text: unknown }).reason_text
        : null;

    if (
      typeof reasonCategory !== 'string' ||
      !(REASON_CATEGORIES as readonly string[]).includes(reasonCategory)
    ) {
      return NextResponse.json({ error: 'Invalid reason_category' }, { status: 400 });
    }
    if (typeof reasonText !== 'string' || reasonText.trim().length === 0) {
      return NextResponse.json({ error: 'reason_text is required' }, { status: 400 });
    }

    const { data: engagement } = await serviceClient
      .from('active_engagements')
      .select('id, daywork_id, permanent_posting_id, status')
      .eq('id', engagementId)
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    if (engagement.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot cancel engagement in ${engagement.status} status` },
        { status: 400 },
      );
    }

    const postingType: 'daywork' | 'permanent' = engagement.daywork_id ? 'daywork' : 'permanent';

    await appendEvent(serviceClient, {
      eventType: 'ADMIN.ENGAGEMENT_CANCELLED',
      aggregateId: engagementId,
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: {
        engagement_id: engagementId,
        posting_type: postingType,
        daywork_id: engagement.daywork_id ?? undefined,
        permanent_posting_id: engagement.permanent_posting_id ?? undefined,
        reason_category: reasonCategory,
        reason_text: reasonText.trim(),
        admin_person_id: adminPerson.id,
      },
      personId: adminPerson.id,
    });

    await logAdminAction(serviceClient, {
      adminPersonId: adminPerson.id,
      action: 'cancel_engagement',
      targetId: engagementId,
      reason: reasonText.trim(),
      metadata: {
        reason_category: reasonCategory,
        posting_type: postingType,
        daywork_id: engagement.daywork_id ?? null,
        permanent_posting_id: engagement.permanent_posting_id ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel engagement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
