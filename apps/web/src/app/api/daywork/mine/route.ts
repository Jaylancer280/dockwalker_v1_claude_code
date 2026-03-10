import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/mine
 * Returns the authenticated user's daywork postings with related data.
 * Optional query params: ?status=active&roleId=&portId=
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  let query = supabase
    .from('dayworks')
    .select(
      `
      id, job_number, role_context, start_date, end_date, working_days,
      day_rate, currency, meals, notes, status, created_at,
      yacht_roles(name),
      ports(name, cities(name, regions(name))),
      vessels(name, nda_flag, vessel_size_bands(label)),
      experience_brackets(label)
    `,
    )
    .eq('poster_person_id', user.id)
    .order('created_at', { ascending: false });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s) => s.trim());
    query = query.in('status', statuses);
  }

  const filterRoleId = searchParams.get('roleId');
  if (filterRoleId) {
    query = query.eq('role_id', filterRoleId);
  }

  const filterPortId = searchParams.get('portId');
  if (filterPortId) {
    query = query.eq('location_port_id', filterPortId);
  }

  const { data: dayworks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dayworks: dayworks ?? [] });
}
