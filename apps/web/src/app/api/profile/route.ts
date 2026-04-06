import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import type { EventPayloadMap } from '@dockwalker/types';
import { appendEvent } from '@dockwalker/db';
import { LANGUAGE_CODES } from '@dockwalker/shared';

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
      person_id, display_name, identity_type, bio, avatar_url, deck_name,
      primary_role_id, desired_role_id, certification_ids, experience_bracket_id,
      vessel_size_exposure_ids, location_port_id, location_city_id, nationality_id, visa_ids,
      languages,
      permanent_availability, notice_period_days, currently_employed,
      smoker, visible_tattoos,
      agency_name, role_specialization_ids,
      yacht_roles!profiles_primary_role_id_fkey(id, name, department),
      desired_roles:yacht_roles!profiles_desired_role_id_fkey(id, name),
      experience_brackets(id, label),
      ports(id, name, cities(name, regions(name))),
      location_cities:cities!profiles_location_city_id_fkey(id, name, regions(name)),
      nationalities(id, name, country_code, flag_emoji)
    `,
    )
    .eq('person_id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For agents, also fetch placement city IDs
  let placement_city_ids: string[] = [];
  if (person.identity_type === 'agent') {
    const { data: placements } = await supabase
      .from('agent_placement_cities')
      .select('city_id')
      .eq('person_id', user.id);
    placement_city_ids = (placements ?? []).map((p: { city_id: string }) => p.city_id);
  }

  return NextResponse.json({ person, profile, placement_city_ids });
}

/**
 * PATCH /api/profile
 * Updates the user's profile via PROFILE.UPDATED event.
 */
export async function PATCH(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  const body = await request.json().catch(() => ({}));

  const payload: EventPayloadMap['PROFILE.UPDATED'] = {};
  if (body.displayName !== undefined) payload.display_name = body.displayName;
  if (body.primaryRoleId !== undefined) payload.primary_role_id = body.primaryRoleId;
  if (body.certificationIds !== undefined) payload.certification_ids = body.certificationIds;
  if (body.experienceBracketId !== undefined)
    payload.experience_bracket_id = body.experienceBracketId;
  if (body.vesselSizeExposureIds !== undefined)
    payload.vessel_size_exposure_ids = body.vesselSizeExposureIds;
  if (body.bio !== undefined) {
    if (body.bio !== null && typeof body.bio === 'string' && body.bio.length > 1000) {
      return NextResponse.json({ error: 'Bio must be 1000 characters or fewer' }, { status: 400 });
    }
    payload.bio = body.bio;
  }
  if (body.deckName !== undefined)
    payload.deck_name = body.deckName ? String(body.deckName).slice(0, 50) : null;
  if (body.agencyName !== undefined) {
    if (person.identity_type === 'agent' && (!body.agencyName || !String(body.agencyName).trim())) {
      return NextResponse.json({ error: 'Agency name is required for agents' }, { status: 400 });
    }
    payload.agency_name = body.agencyName;
  }
  if (body.roleSpecializationIds !== undefined)
    payload.role_specialization_ids = body.roleSpecializationIds;
  if (body.locationPortId !== undefined) payload.location_port_id = body.locationPortId;
  if (body.locationCityId !== undefined) payload.location_city_id = body.locationCityId;
  if (body.nationalityId !== undefined) payload.nationality_id = body.nationalityId;
  if (body.visaIds !== undefined) payload.visa_ids = body.visaIds;
  if (body.languages !== undefined) {
    if (
      Array.isArray(body.languages) &&
      body.languages.every((c: unknown) => typeof c === 'string' && LANGUAGE_CODES.has(c))
    ) {
      payload.languages = body.languages;
    } else {
      return NextResponse.json({ error: 'Invalid language codes' }, { status: 400 });
    }
  }
  if (body.desiredRoleId !== undefined) payload.desired_role_id = body.desiredRoleId;
  if (body.permanentAvailability !== undefined) {
    if (
      body.permanentAvailability !== null &&
      !['immediate', 'after_notice', 'not_looking'].includes(body.permanentAvailability)
    ) {
      return NextResponse.json({ error: 'Invalid permanent availability' }, { status: 400 });
    }
    payload.permanent_availability = body.permanentAvailability;
  }
  if (body.noticePeriodDays !== undefined) {
    if (
      body.noticePeriodDays !== null &&
      (!Number.isInteger(body.noticePeriodDays) || body.noticePeriodDays < 1)
    ) {
      return NextResponse.json({ error: 'Invalid notice period' }, { status: 400 });
    }
    payload.notice_period_days = body.noticePeriodDays;
  }
  if (body.currentlyEmployed !== undefined) {
    payload.currently_employed = body.currentlyEmployed === true;
  }
  if (body.smoker !== undefined) {
    payload.smoker = body.smoker === true ? true : body.smoker === false ? false : null;
  }
  if (body.visibleTattoos !== undefined) {
    payload.visible_tattoos =
      body.visibleTattoos === true ? true : body.visibleTattoos === false ? false : null;
  }

  // Placement cities handled separately (not part of event payload)
  const placementCityIds: string[] | undefined = body.placementCityIds;

  if (Object.keys(payload).length === 0 && placementCityIds === undefined) {
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

  try {
    if (Object.keys(payload).length > 0) {
      await appendEvent(serviceClient, {
        eventType: 'PROFILE.UPDATED',
        aggregateId: user.id,
        aggregateType: 'person',
        roleContext: person.current_hat,
        payload: payload,
        personId: user.id,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Update placement cities if provided (agent-only, separate table)
  if (placementCityIds !== undefined && person.identity_type === 'agent') {
    if (!Array.isArray(placementCityIds)) {
      return NextResponse.json({ error: 'placementCityIds must be an array' }, { status: 400 });
    }
    // Delete existing and re-insert
    await serviceClient.from('agent_placement_cities').delete().eq('person_id', user.id);
    if (placementCityIds.length > 0) {
      const rows = placementCityIds.map((cityId: string) => ({
        person_id: user.id,
        city_id: cityId,
      }));
      const { error: insertErr } = await serviceClient.from('agent_placement_cities').insert(rows);
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}
