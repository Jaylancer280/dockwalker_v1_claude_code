import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/daywork/templates
 * Lists the authenticated user's daywork templates.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const { data: templates, error } = await supabase
    .from('daywork_templates')
    .select(
      `
      id, name, role_id, location_port_id,
      working_days, required_certification_ids, experience_bracket_id,
      day_rate, currency, meals, notes, positions_available, permanent_opportunity, created_at,
      yacht_roles(name),
      ports(name, cities(name, regions(name)))
    `,
    )
    .eq('person_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates ?? [] });
}

/**
 * POST /api/daywork/templates
 * Creates a new daywork template.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const body = await request.json();

  const { data, error } = await supabase
    .from('daywork_templates')
    .insert({
      person_id: user.id,
      name: body.name,
      role_id: body.roleId || null,
      location_port_id: body.locationPortId || null,
      working_days: body.workingDays || null,
      required_certification_ids: body.requiredCertificationIds || [],
      experience_bracket_id: body.experienceBracketId || null,
      day_rate: body.dayRate || null,
      currency: body.currency || 'EUR',
      meals: body.meals || [],
      notes: body.notes || null,
      positions_available: body.positionsAvailable || 1,
      permanent_opportunity: body.permanentOpportunity === true,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
