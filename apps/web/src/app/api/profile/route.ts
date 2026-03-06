import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/profile
 * Returns the authenticated user's profile with joined lookups.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: person } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) {
    return NextResponse.json({ error: 'No profile found' }, { status: 404 });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      `
      person_id, display_name, identity_type, bio,
      primary_role_id, certification_ids, experience_bracket_id,
      vessel_size_exposure_ids, location_port_id,
      agency_name, role_specialization_ids,
      yacht_roles(id, name),
      experience_brackets(id, label),
      ports(id, name, cities(name, regions(name)))
    `,
    )
    .eq('person_id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ person, profile });
}

/**
 * PATCH /api/profile
 * Updates the user's profile via PROFILE.UPDATED event.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: person } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) {
    return NextResponse.json({ error: 'No profile found' }, { status: 404 });
  }

  const body = await request.json();

  const payload: Record<string, unknown> = {};
  if (body.displayName !== undefined) payload.display_name = body.displayName;
  if (body.primaryRoleId !== undefined) payload.primary_role_id = body.primaryRoleId;
  if (body.certificationIds !== undefined) payload.certification_ids = body.certificationIds;
  if (body.experienceBracketId !== undefined)
    payload.experience_bracket_id = body.experienceBracketId;
  if (body.vesselSizeExposureIds !== undefined)
    payload.vessel_size_exposure_ids = body.vesselSizeExposureIds;
  if (body.bio !== undefined) payload.bio = body.bio;
  if (body.agencyName !== undefined) payload.agency_name = body.agencyName;
  if (body.roleSpecializationIds !== undefined)
    payload.role_specialization_ids = body.roleSpecializationIds;
  if (body.locationPortId !== undefined) payload.location_port_id = body.locationPortId;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await serviceClient.rpc('append_event', {
    p_event_type: 'PROFILE.UPDATED',
    p_aggregate_id: user.id,
    p_aggregate_type: 'person',
    p_role_context: person.current_hat,
    p_payload: payload,
    p_person_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
