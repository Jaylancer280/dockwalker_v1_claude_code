import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/agent/activity
 * Logs an agent activity for internal telemetry. Fire-and-forget from client.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, supabase } = guard.value;

    if (person.identity_type !== 'agent') {
      return NextResponse.json({ error: 'Agent only' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, metadata } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    await supabase.from('agent_activity_log').insert({
      person_id: user.id,
      action,
      metadata: metadata ?? {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
