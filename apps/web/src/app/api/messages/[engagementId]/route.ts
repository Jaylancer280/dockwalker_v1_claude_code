import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * GET /api/messages/:engagementId
 * Returns messages for an engagement. User must be crew or employer on the engagement.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  // Verify user is part of this engagement
  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_person_id, content, created_at, is_system')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

/**
 * POST /api/messages/:engagementId
 * Send a message. User must be crew or employer on the engagement.
 * Body: { content: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  // Verify user is part of this engagement and it's active
  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, status')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (engagement.status !== 'active') {
    return NextResponse.json({ error: 'This engagement is no longer active' }, { status: 400 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
  }

  const trimmed = content.trim();

  if (trimmed.length > 2000) {
    return NextResponse.json(
      { error: 'Message content must be 2000 characters or fewer' },
      { status: 400 },
    );
  }
  const messageId = randomUUID();

  try {
    await appendEvent(serviceClient, {
      eventType: 'MESSAGE.SENT',
      aggregateId: engagementId,
      aggregateType: 'message',
      roleContext: engagement.crew_person_id === user.id ? 'crew' : 'employer',
      payload: {
        id: messageId,
        engagement_id: engagementId,
        sender_person_id: user.id,
        content: trimmed,
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'MESSAGE.SENT',
      { engagement_id: engagementId, sender_person_id: user.id, content: trimmed },
      user.id,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
