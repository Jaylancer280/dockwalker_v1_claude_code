import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;

  try {
    const body = await request.json();
    const { person_id, subject, content } = body;

    if (!person_id) return NextResponse.json({ error: 'person_id is required' }, { status: 400 });
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const { data: target } = await serviceClient
      .from('persons')
      .select('id')
      .eq('id', person_id)
      .single();

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: thread, error: threadError } = await serviceClient
      .from('support_threads')
      .insert({
        person_id,
        subject: subject?.trim() || 'Message from DockWalker',
        status: 'open',
        is_admin_initiated: true,
      })
      .select('id')
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    await serviceClient.from('support_messages').insert({
      thread_id: thread.id,
      sender_person_id: adminPerson.id,
      is_platform: true,
      content: content.trim(),
    });

    const eventPayload = {
      thread_id: thread.id,
      person_id,
      subject: subject?.trim() || 'Message from DockWalker',
      content_preview: content.trim().slice(0, 200),
      is_admin_initiated: true,
    };

    await appendEvent(serviceClient, {
      eventType: 'SUPPORT.THREAD_OPENED',
      aggregateId: thread.id,
      aggregateType: 'support',
      roleContext: 'employer',
      payload: eventPayload,
      personId: adminPerson.id,
    });

    notifyOnEvent(serviceClient, 'SUPPORT.THREAD_OPENED', eventPayload, adminPerson.id);

    return NextResponse.json({ thread_id: thread.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initiate thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
