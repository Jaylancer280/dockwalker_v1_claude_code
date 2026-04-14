import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = 50;
  const offset = (page - 1) * perPage;

  try {
    const results: {
      type: string;
      id: string;
      status: string;
      role_id: string;
      port_id: string;
      created_at: string;
      poster_name: string;
    }[] = [];

    if (!type || type === 'daywork') {
      let dwQuery = serviceClient
        .from('dayworks')
        .select(
          'id, status, role_id, location_port_id, start_date, end_date, created_at, positions_available, positions_filled, poster:profiles!dayworks_poster_person_id_fkey(display_name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      if (status) dwQuery = dwQuery.eq('status', status);
      const { data: dayworks } = await dwQuery;

      for (const d of dayworks ?? []) {
        results.push({
          type: 'daywork',
          id: d.id,
          status: d.status,
          role_id: d.role_id,
          port_id: d.location_port_id,
          created_at: d.created_at,
          poster_name:
            (d.poster as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
        });
      }
    }

    if (!type || type === 'permanent') {
      let pmQuery = serviceClient
        .from('permanent_postings')
        .select(
          'id, status, role_id, port_id, start_date, created_at, positions_available, poster:profiles!permanent_postings_employer_person_id_fkey(display_name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      if (status) pmQuery = pmQuery.eq('status', status);
      const { data: permanents } = await pmQuery;

      for (const p of permanents ?? []) {
        results.push({
          type: 'permanent',
          id: p.id,
          status: p.status,
          role_id: p.role_id,
          port_id: p.port_id,
          created_at: p.created_at,
          poster_name:
            (p.poster as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
        });
      }
    }

    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ postings: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch postings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
