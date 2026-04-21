import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * PATCH /api/admin/users/:personId/notes/:noteId
 * Edit an admin note. Only the authoring admin can edit.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personId: string; noteId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId, noteId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content =
    body && typeof body === 'object' && 'content' in body
      ? (body as { content: unknown }).content
      : null;

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }
  if (content.length === 0 || content.length > 4000) {
    return NextResponse.json(
      { error: 'content must be between 1 and 4000 characters' },
      { status: 400 },
    );
  }

  const { data: existing } = await serviceClient
    .from('user_notes')
    .select('id, admin_person_id, person_id')
    .eq('id', noteId)
    .single();

  if (!existing || existing.person_id !== personId) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (existing.admin_person_id !== adminPerson.id) {
    return NextResponse.json(
      { error: 'Only the authoring admin can edit this note' },
      { status: 403 },
    );
  }

  const { data, error } = await serviceClient
    .from('user_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .select('id, admin_person_id, content, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data });
}
