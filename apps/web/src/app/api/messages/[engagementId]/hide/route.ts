import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/messages/:engagementId/hide
 * Hide a specific message (one-sided, UI level only).
 * Body: { messageId: string }
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

  // Verify user is part of this engagement
  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { messageId } = body;

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
  }

  // Read current hidden_by, then append
  const { data: msg } = await serviceClient
    .from('messages')
    .select('id, hidden_by')
    .eq('id', messageId)
    .eq('engagement_id', engagementId)
    .single();

  if (!msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const currentHidden: string[] = msg.hidden_by ?? [];
  if (currentHidden.includes(user.id)) {
    return NextResponse.json({ success: true });
  }

  const { error } = await serviceClient.rpc('append_event', {
    p_event_type: 'MESSAGE.HIDDEN',
    p_aggregate_id: messageId,
    p_aggregate_type: 'message',
    p_role_context: engagement.crew_person_id === user.id ? 'crew' : 'employer',
    p_payload: {
      engagement_id: engagementId,
    },
    p_person_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
