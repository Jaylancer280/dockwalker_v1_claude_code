import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    let query = serviceClient
      .from('support_threads')
      .select('id, person_id, subject, status, is_admin_initiated, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const threads = data ?? [];
    const personIds = [...new Set(threads.map((t) => t.person_id))];
    const nameMap = new Map<string, string>();

    if (personIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', personIds);
      for (const p of profiles ?? []) {
        nameMap.set(p.person_id, p.display_name);
      }
    }

    const rows = threads.map((t) => ({
      ...t,
      user_name: nameMap.get(t.person_id) ?? 'Unknown',
    }));

    return NextResponse.json({ threads: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch threads';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
