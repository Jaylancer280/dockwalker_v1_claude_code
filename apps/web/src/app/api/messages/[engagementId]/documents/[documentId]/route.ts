import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * DELETE /api/messages/:engagementId/documents/:documentId
 * Uploader can delete their own document. Hard-deletes from storage, soft-deletes metadata.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string; documentId: string }> },
) {
  const { engagementId, documentId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, serviceClient } = guard.value;

    // Fetch document
    const { data: doc } = await serviceClient
      .from('engagement_documents')
      .select('id, uploader_person_id, storage_path, deleted_at, engagement_id')
      .eq('id', documentId)
      .eq('engagement_id', engagementId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.deleted_at) {
      return NextResponse.json({ error: 'Document already deleted' }, { status: 404 });
    }
    if (doc.uploader_person_id !== user.id) {
      return NextResponse.json({ error: 'Only the uploader can delete' }, { status: 403 });
    }

    // Hard-delete from storage
    await serviceClient.storage.from('engagement-documents').remove([doc.storage_path]);

    // Soft-delete metadata
    await serviceClient
      .from('engagement_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
