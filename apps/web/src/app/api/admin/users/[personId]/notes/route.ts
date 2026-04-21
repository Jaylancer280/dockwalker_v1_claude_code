import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/users/:personId/notes
 * List admin notes for a user in chronological order with author display names.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { personId } = await params;

  const { data, error } = await serviceClient
    .from('user_notes')
    .select(
      `id, person_id, admin_person_id, content, created_at, updated_at,
       author:profiles!user_notes_admin_person_id_fkey (person_id, display_name)`,
    )
    .eq('person_id', personId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes = (data ?? []).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return {
      id: row.id,
      admin_person_id: row.admin_person_id,
      admin_display_name: author?.display_name ?? null,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json({ notes });
}

/**
 * POST /api/admin/users/:personId/notes
 * Add a note about the target user. Author = current admin.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient, person: adminPerson } = guard.value;
  const { personId } = await params;

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

  const { data: target } = await serviceClient
    .from('persons')
    .select('id')
    .eq('id', personId)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data, error } = await serviceClient
    .from('user_notes')
    .insert({
      person_id: personId,
      admin_person_id: adminPerson.id,
      content,
    })
    .select('id, admin_person_id, content, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data }, { status: 201 });
}
