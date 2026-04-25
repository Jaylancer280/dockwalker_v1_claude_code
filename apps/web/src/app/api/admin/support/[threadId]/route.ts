import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { threadId } = await params;

  const { data: thread } = await serviceClient
    .from('support_threads')
    .select('id, person_id, subject, status, is_admin_initiated, created_at')
    .eq('id', threadId)
    .single();

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

  const [{ data: messages }, { data: profile }] = await Promise.all([
    serviceClient
      .from('support_messages')
      .select('id, sender_person_id, is_platform, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
    serviceClient
      .from('profiles')
      .select('display_name')
      .eq('person_id', thread.person_id)
      .single(),
  ]);

  return NextResponse.json({
    thread: { ...thread, user_name: profile?.display_name ?? 'Unknown' },
    messages: messages ?? [],
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { threadId } = await params;

  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const { data: thread } = await serviceClient
      .from('support_threads')
      .select('id, status')
      .eq('id', threadId)
      .single();

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    if (thread.status === 'closed') {
      return NextResponse.json({ error: 'Thread is closed' }, { status: 400 });
    }

    const { data: msg } = await serviceClient
      .from('support_messages')
      .insert({
        thread_id: threadId,
        sender_person_id: adminPerson.id,
        is_platform: true,
        content: content.trim(),
      })
      .select('id')
      .single();

    await serviceClient
      .from('support_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    const eventPayload = {
      message_id: msg?.id ?? '',
      thread_id: threadId,
      sender_person_id: adminPerson.id,
      content_preview: content.trim().slice(0, 200),
      is_platform: true,
    };

    await appendEvent(serviceClient, {
      eventType: 'SUPPORT.MESSAGE_SENT',
      aggregateId: threadId,
      aggregateType: 'support',
      roleContext: 'employer',
      payload: eventPayload,
      personId: adminPerson.id,
    });

    notifyOnEvent(serviceClient, 'SUPPORT.MESSAGE_SENT', eventPayload, adminPerson.id);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
