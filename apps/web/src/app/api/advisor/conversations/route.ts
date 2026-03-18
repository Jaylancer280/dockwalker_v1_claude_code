import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/advisor/conversations
 * Creates a new advisor conversation.
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    const { data, error } = await serviceClient
      .from('advisor_conversations')
      .insert({ person_id: user.id })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/advisor/conversations
 * Lists all advisor conversations for the current user.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    if (person.current_hat !== 'crew') {
      return NextResponse.json({ error: 'Crew hat required' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('advisor_conversations')
      .select('id, title, updated_at, advisor_messages(content)')
      .eq('person_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const conversations = (data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      updated_at: c.updated_at,
      preview:
        Array.isArray(c.advisor_messages) && c.advisor_messages.length > 0
          ? (c.advisor_messages[0] as { content: string }).content.slice(0, 80)
          : null,
    }));

    return NextResponse.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
