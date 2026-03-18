import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * GET /api/admin/users?search=<name>&port_id=<id>&page=<n>
 * Admin-only user listing with search and filters.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const portId = searchParams.get('port_id');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = 20;
  const offset = (page - 1) * perPage;

  try {
    let query = serviceClient
      .from('profiles')
      .select(
        'person_id, display_name, identity_type, location_port_id, created_at, persons!inner(current_hat, is_admin)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }
    if (portId) {
      query = query.eq('location_port_id', portId);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      users: data ?? [],
      total: count ?? 0,
      page,
      perPage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
