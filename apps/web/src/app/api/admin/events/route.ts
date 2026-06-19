import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('person_id');
  const eventType = searchParams.get('event_type');
  const aggregateType = searchParams.get('aggregate_type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    let query = serviceClient
      .from('events')
      .select('id, event_type, aggregate_type, aggregate_id, person_id, payload, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (personId) query = query.eq('person_id', personId);
    if (eventType) query = query.eq('event_type', eventType);
    if (aggregateType) query = query.eq('aggregate_type', aggregateType);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      events: data ?? [],
      total: count ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch events';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
