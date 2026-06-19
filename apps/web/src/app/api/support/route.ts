import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyAdminsOfSupport } from '@/lib/push-triggers/support-admin-notify';

export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { supabase, person } = guard.value;

  const { data, error } = await supabase
    .from('support_threads')
    .select('id, subject, status, is_admin_initiated, created_at, updated_at')
    .eq('person_id', person.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ threads: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { serviceClient, person } = guard.value;

  try {
    const body = await request.json();
    const { subject, content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 4000) {
      return NextResponse.json({ error: 'content too long (max 4000)' }, { status: 400 });
    }

    const { count } = await serviceClient
      .from('support_threads')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', person.id)
      .eq('status', 'open');

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Maximum 3 open support threads. Close an existing thread first.' },
        { status: 400 },
      );
    }

    const { data: thread, error: threadError } = await serviceClient
      .from('support_threads')
      .insert({
        person_id: person.id,
        subject: subject?.trim() || null,
        status: 'open',
      })
      .select('id')
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    await serviceClient.from('support_messages').insert({
      thread_id: thread.id,
      sender_person_id: person.id,
      is_platform: false,
      content: content.trim(),
    });

    await appendEvent(serviceClient, {
      eventType: 'SUPPORT.THREAD_OPENED',
      aggregateId: thread.id,
      aggregateType: 'support',
      roleContext: person.current_hat,
      payload: {
        thread_id: thread.id,
        person_id: person.id,
        subject: subject?.trim(),
        content_preview: content.trim().slice(0, 200),
        is_admin_initiated: false,
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
      threadId: thread.id,
      isNewThread: true,
      senderName: senderProfile?.display_name ?? 'A user',
      contentPreview: content.trim(),
      subject: subject?.trim() ?? null,
    });

    return NextResponse.json({ thread_id: thread.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create thread';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
