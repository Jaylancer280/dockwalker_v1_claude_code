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
    interface PostingResult {
      type: string;
      id: string;
      status: string;
      role_id: string;
      port_id: string;
      start_date: string;
      created_at: string;
      poster_person_id: string;
      poster_name: string;
    }

    const results: PostingResult[] = [];

    if (!type || type === 'daywork') {
      let dwQuery = serviceClient
        .from('dayworks')
        .select(
          'id, status, role_id, location_port_id, start_date, end_date, created_at, poster_person_id, positions_available, positions_filled',
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
          start_date: d.start_date,
          created_at: d.created_at,
          poster_person_id: d.poster_person_id,
          poster_name: '',
        });
      }
    }

    if (!type || type === 'permanent') {
      let pmQuery = serviceClient
        .from('permanent_postings')
        .select(
          'id, status, role_id, port_id, start_date, created_at, employer_person_id, positions_available',
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
          start_date: p.start_date,
          created_at: p.created_at,
          poster_person_id: p.employer_person_id,
          poster_name: '',
        });
      }
    }

    const posterIds = [...new Set(results.map((r) => r.poster_person_id))];
    if (posterIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', posterIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.person_id, p.display_name]));
      for (const r of results) {
        r.poster_name = nameMap.get(r.poster_person_id) ?? 'Unknown';
      }
    }

    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ postings: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch postings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
