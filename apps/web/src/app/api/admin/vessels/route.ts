import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  try {
    let query = serviceClient
      .from('vessels')
      .select(
        'id, imo_number, name, vessel_type, loa_meters, nda_flag, owner_person_id, created_at',
        {
          count: 'exact',
        },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,imo_number.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const vessels = data ?? [];
    const ownerIds = [...new Set(vessels.map((v) => v.owner_person_id))];
    const nameMap = new Map<string, string>();

    if (ownerIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', ownerIds);
      for (const p of profiles ?? []) {
        nameMap.set(p.person_id, p.display_name);
      }
    }

    const rows = vessels.map((v) => ({
      ...v,
      owner_name: nameMap.get(v.owner_person_id) ?? 'Unknown',
    }));

    return NextResponse.json({ vessels: rows, total: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch vessels';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
