import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

const THREAD_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * GET /api/advisor/thread
 * Returns the user's current thread (most recent, ≤72h old) or empty state.
 * Client never needs conversation IDs — the API always operates on "the user's current thread".
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase, serviceClient } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    // Find most recent thread
    const { data: thread, error: threadErr } = await supabase
      .from('advisor_conversations')
      .select('id, created_at')
      .eq('person_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (threadErr || !thread) {
      return NextResponse.json({ thread: null, messages: [] });
    }

    // Check if expired (>72h from created_at)
    const age = Date.now() - new Date(thread.created_at).getTime();
    if (age > THREAD_TTL_MS) {
      // Delete expired thread (messages cascade)
      await serviceClient
        .from('advisor_conversations')
        .delete()
        .eq('id', thread.id)
        .eq('person_id', user.id);

      return NextResponse.json({ thread: null, messages: [] });
    }

    // Fetch messages for active thread
    const { data: messages, error: msgsErr } = await supabase
      .from('advisor_messages')
      .select('id, role, content, sources, created_at')
      .eq('conversation_id', thread.id)
      .order('created_at', { ascending: true });

    if (msgsErr) {
      return NextResponse.json({ error: msgsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      thread: { id: thread.id, created_at: thread.created_at },
      messages: messages ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
