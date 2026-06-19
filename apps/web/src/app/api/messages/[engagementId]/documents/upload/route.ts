import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB (under Vercel 4.5MB body limit)

function validateMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  switch (mimeType) {
    case 'application/pdf':
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    case 'image/webp':
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

/**
 * POST /api/messages/:engagementId/documents/upload
 * Single-file upload. Returns document metadata.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase, serviceClient } = guard.value;

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
    if (engagement.status !== 'active') {
      return NextResponse.json({ error: 'Engagement is not active' }, { status: 400 });
    }

    // Rate limit: max 20 non-deleted documents per engagement in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from('engagement_documents')
      .select('id', { count: 'exact', head: true })
      .eq('engagement_id', engagementId)
      .is('deleted_at', null)
      .gte('created_at', oneDayAgo);

    if ((count ?? 0) >= 20) {
      return NextResponse.json(
        { error: 'Document upload limit reached (20 per engagement per day)' },
        { status: 429 },
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PDF, JPEG, PNG, or WebP' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be 4MB or smaller' }, { status: 400 });
    }

    // Validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(new Uint8Array(buffer), file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 },
      );
    }

    // Upload to storage
    const ext = getExtension(file.type);
    const fileId = randomUUID();
    const storagePath = `${engagementId}/${fileId}.${ext}`;
    const sanitisedName = file.name.replace(/[^\w.\-() ]/g, '_').slice(0, 200);

    const { error: uploadError } = await serviceClient.storage
      .from('engagement-documents')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Insert metadata
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: doc, error: insertError } = await serviceClient
      .from('engagement_documents')
      .insert({
        engagement_id: engagementId,
        uploader_person_id: user.id,
        file_name: sanitisedName,
        file_size_bytes: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        documentId: doc.id,
        fileName: sanitisedName,
        fileSize: file.size,
        expiresAt,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
