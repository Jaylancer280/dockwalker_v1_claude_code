import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/onboarding
 *
 * Creates PERSON.CREATED + PROFILE.CREATED atomically in a single request.
 * Called at the end of the onboarding flow.
 *
 * Body: {
 *   identityType: 'crew' | 'agent',
 *   currentHat: 'crew' | 'employer' | 'agent',
 *   profile: { ... type-specific fields }
 * }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { identityType, currentHat, profile } = body;

  // Validate identity type
  if (!['crew', 'agent'].includes(identityType)) {
    return NextResponse.json({ error: 'Invalid identity type' }, { status: 400 });
  }

  // Validate hat
  const validHats = identityType === 'crew' ? ['crew', 'employer'] : ['agent'];
  if (!validHats.includes(currentHat)) {
    return NextResponse.json({ error: 'Invalid hat selection' }, { status: 400 });
  }

  // Check not already onboarded
  const { data: existingPerson } = await supabase
    .from('persons')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingPerson) {
    return NextResponse.json({ error: 'Already onboarded' }, { status: 409 });
  }

  try {
    const profilePayload = {
      display_name: profile.displayName,
      // Crew fields
      primary_role_id: profile.primaryRoleId || null,
      certification_ids: profile.certificationIds || [],
      experience_bracket_id: profile.experienceBracketId || null,
      vessel_size_exposure_ids: profile.vesselSizeExposureIds || [],
      bio: profile.bio || null,
      // Agent fields
      agency_name: profile.agencyName || null,
      role_specialization_ids: profile.roleSpecializationIds || [],
      // Shared
      location_port_id: profile.locationPortId || null,
    };

    const { error } = await serviceClient.rpc('onboard_person', {
      p_identity_type: identityType,
      p_current_hat: currentHat,
      p_profile: profilePayload,
      p_person_id: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onboarding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
