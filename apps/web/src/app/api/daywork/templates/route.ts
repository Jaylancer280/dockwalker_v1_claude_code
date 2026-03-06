import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/daywork/templates
 * Lists the authenticated user's daywork templates.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: templates, error } = await supabase
    .from('daywork_templates')
    .select(
      `
      id, name, vessel_id, role_id, location_port_id,
      working_days, required_certification_ids, experience_bracket_id,
      day_rate, meals, notes, created_at,
      yacht_roles(name),
      ports(name, cities(name, regions(name))),
      vessels(name)
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('daywork_templates')
    .insert({
      person_id: user.id,
      name: body.name,
      vessel_id: body.vesselId || null,
      role_id: body.roleId || null,
      location_port_id: body.locationPortId || null,
      working_days: body.workingDays || null,
      required_certification_ids: body.requiredCertificationIds || [],
      experience_bracket_id: body.experienceBracketId || null,
      day_rate: body.dayRate || null,
      meals: body.meals || [],
      notes: body.notes || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
