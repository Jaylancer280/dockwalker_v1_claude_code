import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/advisor/thread/clear
 * Deletes the user's most recent thread. Messages cascade via ON DELETE CASCADE.
 * Returns 204 even when no thread exists (idempotent).
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    // Find most recent thread
    const { data: thread } = await serviceClient
      .from('advisor_conversations')
      .select('id')
      .eq('person_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (thread) {
      await serviceClient
        .from('advisor_conversations')
        .delete()
        .eq('id', thread.id)
        .eq('person_id', user.id);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
