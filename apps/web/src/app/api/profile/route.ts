import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import type { EventPayloadMap } from '@dockwalker/types';
import { appendEvent } from '@dockwalker/db';

/**
 * GET /api/profile
 * Returns the authenticated user's profile with joined lookups.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase } = guard.value;

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
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  const body = await request.json();

  const payload: EventPayloadMap['PROFILE.UPDATED'] = {};
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

  if (
    payload.display_name !== undefined &&
    (typeof payload.display_name !== 'string' ||
      payload.display_name.toString().trim().length === 0 ||
      payload.display_name.toString().trim().length > 100)
  ) {
    return NextResponse.json(
      { error: 'Display name must be between 1 and 100 characters' },
      { status: 400 },
    );
  }

  if (
    payload.bio !== undefined &&
    payload.bio !== null &&
    typeof payload.bio === 'string' &&
    payload.bio.length > 250
  ) {
    return NextResponse.json({ error: 'Bio must be 250 characters or fewer' }, { status: 400 });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'PROFILE.UPDATED',
      aggregateId: user.id,
      aggregateType: 'person',
      roleContext: person.current_hat,
      payload: payload,
      personId: user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
