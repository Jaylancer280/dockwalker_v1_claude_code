import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/messages/:engagementId/documents/:documentId/download
 * Generate a signed URL for downloading a document.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string; documentId: string }> },
) {
  const { engagementId, documentId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase, serviceClient } = guard.value;

    // Verify engagement membership
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

    // Fetch document
    const { data: doc } = await serviceClient
      .from('engagement_documents')
      .select('storage_path, file_name, mime_type, expires_at, deleted_at')
      .eq('id', documentId)
      .eq('engagement_id', engagementId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.deleted_at) {
      return NextResponse.json({ error: 'deleted_by_uploader' }, { status: 410 });
    }
    if (new Date(doc.expires_at) < new Date()) {
      return NextResponse.json({ error: 'document_expired' }, { status: 410 });
    }

    // Generate signed URL (15 min expiry)
    const { data: signedUrl, error: signError } = await serviceClient.storage
      .from('engagement-documents')
      .createSignedUrl(doc.storage_path, 900);

    if (signError || !signedUrl?.signedUrl) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.json(
      { url: signedUrl.signedUrl, fileName: doc.file_name, contentType: doc.mime_type },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
