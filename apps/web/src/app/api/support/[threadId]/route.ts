import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyAdminsOfSupport } from '@/lib/push-triggers/support-admin-notify';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { supabase, person } = guard.value;
  const { threadId } = await params;

  const { data: thread } = await supabase
    .from('support_threads')
    .select('id, subject, status, created_at')
    .eq('id', threadId)
    .eq('person_id', person.id)
    .single();

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

  const { data: messages } = await supabase
    .from('support_messages')
    .select('id, sender_person_id, is_platform, content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ thread, messages: messages ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { serviceClient, person } = guard.value;
  const { threadId } = await params;

  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 4000) {
      return NextResponse.json({ error: 'content too long' }, { status: 400 });
    }

    const { data: thread } = await serviceClient
      .from('support_threads')
      .select('id, person_id, status')
      .eq('id', threadId)
      .single();

    if (!thread || thread.person_id !== person.id) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.status === 'closed') {
      return NextResponse.json({ error: 'Thread is closed' }, { status: 400 });
    }

    const { data: msg } = await serviceClient
      .from('support_messages')
      .insert({
        thread_id: threadId,
        sender_person_id: person.id,
        is_platform: false,
        content: content.trim(),
      })
      .select('id')
      .single();

    await serviceClient
      .from('support_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    await appendEvent(serviceClient, {
      eventType: 'SUPPORT.MESSAGE_SENT',
      aggregateId: threadId,
      aggregateType: 'support',
      roleContext: person.current_hat,
      payload: {
        message_id: msg?.id ?? '',
        thread_id: threadId,
        sender_person_id: person.id,
        content_preview: content.trim().slice(0, 200),
        is_platform: false,
      },
      personId: person.id,
    });

    // In-app notify all admins (no external channels per launch decision).
    const { data: senderProfile } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('person_id', person.id)
      .single();
    void notifyAdminsOfSupport(serviceClient, {
      threadId,
      isNewThread: false,
      senderName: senderProfile?.display_name ?? 'A user',
      contentPreview: content.trim(),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
