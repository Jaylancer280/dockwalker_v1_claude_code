import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/messages/:engagementId/documents/finalize
 * Links uploaded documents to a new chat message.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    // Verify engagement membership
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

    const body = await request.json().catch(() => ({}));
    const documentIds = body.documentIds;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'documentIds required' }, { status: 400 });
    }

    // Validate all documents belong to this engagement, uploaded by this user, not yet finalized
    const { data: docs, error: docsError } = await serviceClient
      .from('engagement_documents')
      .select('id, engagement_id, uploader_person_id, message_id')
      .in('id', documentIds);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    const validDocs = docs ?? [];
    for (const doc of validDocs) {
      if (doc.engagement_id !== engagementId) {
        return NextResponse.json(
          { error: 'Document does not belong to this engagement' },
          { status: 400 },
        );
      }
      if (doc.uploader_person_id !== user.id) {
        return NextResponse.json({ error: 'Document was not uploaded by you' }, { status: 403 });
      }
      if (doc.message_id) {
        return NextResponse.json({ error: 'Document already finalized' }, { status: 400 });
      }
    }

    if (validDocs.length !== documentIds.length) {
      return NextResponse.json({ error: 'One or more document IDs not found' }, { status: 400 });
    }

    // Create message
    const messageId = randomUUID();
    const content = `Shared ${validDocs.length} document(s)`;

    await appendEvent(serviceClient, {
      eventType: 'MESSAGE.SENT',
      aggregateId: engagementId,
      aggregateType: 'engagement',
      roleContext: person.current_hat,
      payload: {
        id: messageId,
        content,
        message_type: 'documents',
        document_count: validDocs.length,
        sender_person_id: user.id,
      },
      personId: user.id,
    });

    // Link documents to message
    await serviceClient
      .from('engagement_documents')
      .update({ message_id: messageId })
      .in('id', documentIds);

    // Notify
    notifyOnEvent(
      serviceClient,
      'MESSAGE.SENT',
      {
        engagement_id: engagementId,
        sender_person_id: user.id,
        content,
        message_type: 'documents',
        document_count: validDocs.length,
      },
      user.id,
    );

    return NextResponse.json({ messageId, documentCount: validDocs.length }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
