import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/messages/:engagementId/read
 * Upserts the read cursor for the current user on this engagement.
 * Called when user opens/focuses a chat thread.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  // Verify user is part of this engagement
  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id')
    .eq('id', engagementId)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
    return NextResponse.json({ error: 'Not a participant in this engagement' }, { status: 403 });
  }

  const { error } = await supabase.from('message_read_cursors').upsert(
    {
      person_id: user.id,
      engagement_id: engagementId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'person_id,engagement_id' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
