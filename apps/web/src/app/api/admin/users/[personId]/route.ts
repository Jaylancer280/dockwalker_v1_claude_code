import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/users/:personId
 * Admin-only user detail view.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { personId } = await params;

  try {
    const [{ data: person }, { data: profile }, { data: subscription }, { count: eventCount }] =
      await Promise.all([
        serviceClient.from('persons').select('*').eq('id', personId).single(),
        serviceClient.from('profiles').select('*').eq('person_id', personId).single(),
        serviceClient.from('subscriptions').select('*').eq('person_id', personId).maybeSingle(),
        serviceClient
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', personId),
      ]);

    if (!person) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      person,
      profile,
      subscription: subscription ?? null,
      eventCount: eventCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
