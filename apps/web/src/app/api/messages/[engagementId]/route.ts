import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/messages/:engagementId
 * Returns messages for an engagement. User must be crew or employer on the engagement.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Get messages, excluding hidden ones for this user
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_person_id, content, created_at, hidden_by')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter out hidden messages for this user
  const visible = (messages ?? [])
    .filter((m) => !(m.hidden_by ?? []).includes(user.id))
    .map((m) => ({
      id: m.id,
      sender_person_id: m.sender_person_id,
      content: m.content,
      created_at: m.created_at,
    }));

  return NextResponse.json({ messages: visible });
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
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'MESSAGE.SENT',
      p_aggregate_id: engagementId,
      p_aggregate_type: 'message',
      p_role_context: engagement.crew_person_id === user.id ? 'crew' : 'employer',
      p_payload: {
        engagement_id: engagementId,
        sender_person_id: user.id,
        content: trimmed,
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
