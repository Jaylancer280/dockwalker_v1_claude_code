import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/onboarding
 *
 * Creates PERSON.CREATED + PROFILE.CREATED atomically in a single request.
 * For experienced crew (onboardingVersion 2), also creates vessels and
 * experience entries after onboarding completes.
 *
 * Body: {
 *   identityType: 'crew' | 'agent',
 *   currentHat: 'crew' | 'employer' | 'agent',
 *   profile: { ... type-specific fields },
 *   experiences?: Array<{ vessel, experience }> (experienced crew only)
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

  const body_experiences: unknown[] = body.experiences || [];

  try {
    const profilePayload: Record<string, unknown> = {
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
      // Green crew fields
      shore_experience: profile.shoreExperience || null,
      motivation: profile.motivation || null,
      languages: profile.languages || [],
      available_to_start: profile.availableToStart || null,
      onboarding_version: profile.onboardingVersion ?? 1,
    };

    // Step 1: Create person + profile atomically
    const { error } = await serviceClient.rpc('onboard_person', {
      p_identity_type: identityType,
      p_current_hat: currentHat,
      p_profile: profilePayload,
      p_person_id: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Step 2: For experienced crew, create vessels + experiences
    if (identityType === 'crew' && Array.isArray(body_experiences) && body_experiences.length > 0) {
      for (const entry of body_experiences) {
        const { vessel, experience } = entry as {
          vessel: { imoNumber: string; name: string; vesselType: string; loaMeters: number };
          experience: {
            roleId: string;
            startDate: string;
            endDate?: string;
            isCurrent?: boolean;
            charterOrPrivate: string;
            flagState?: string;
            salaryAmount?: number;
            salaryCurrency?: string;
            salaryPeriod?: string;
            rotationType?: string;
            rotationDetails?: string;
            description?: string;
          };
        };

        // Look up existing vessel by IMO for this user
        const imoClean = vessel.imoNumber.toString().replace(/\D/g, '');
        const { data: existingVessel } = await serviceClient
          .from('vessels')
          .select('id')
          .eq('imo_number', imoClean)
          .eq('owner_person_id', user.id)
          .maybeSingle();

        let vesselId: string;

        if (existingVessel) {
          vesselId = existingVessel.id;
        } else {
          // Auto-derive size band from LOA
          const loa = Number(vessel.loaMeters);
          const { data: sizeBands } = await serviceClient
            .from('vessel_size_bands')
            .select('id, min_meters, max_meters')
            .order('min_meters');

          const sizeBand = sizeBands?.find(
            (b: { min_meters: number; max_meters: number | null }) =>
              loa >= b.min_meters && (b.max_meters === null || loa < b.max_meters),
          );

          if (!sizeBand) continue;

          vesselId = randomUUID();
          await appendEvent(serviceClient, {
            eventType: 'VESSEL.CREATED',
            aggregateId: vesselId,
            aggregateType: 'vessel',
            roleContext: currentHat,
            payload: {
              id: vesselId,
              imo_number: imoClean,
              name: vessel.name,
              vessel_type: vessel.vesselType,
              size_band_id: sizeBand.id,
              loa_meters: loa,
              nda_flag: false,
            },
            personId: user.id,
          });
        }

        // Create experience entry
        const experienceId = randomUUID();
        await appendEvent(serviceClient, {
          eventType: 'EXPERIENCE.ADDED',
          aggregateId: experienceId,
          aggregateType: 'experience',
          roleContext: currentHat,
          payload: {
            id: experienceId,
            vessel_id: vesselId,
            role_id: experience.roleId,
            start_date: experience.startDate,
            end_date: experience.endDate ?? null,
            is_current: experience.isCurrent ?? false,
            charter_or_private: experience.charterOrPrivate as 'charter' | 'private',
            flag_state: experience.flagState ?? null,
            salary_amount: experience.salaryAmount ?? null,
            salary_currency: (experience.salaryCurrency as 'EUR' | 'USD' | 'GBP' | 'AED') ?? null,
            salary_period: (experience.salaryPeriod as 'daily' | 'monthly' | 'annually') ?? null,
            rotation_type:
              (experience.rotationType as
                | '2:2'
                | '3:1'
                | '3:3'
                | '5:1'
                | 'permanent'
                | 'seasonal'
                | 'mlc_standard'
                | 'other') ?? null,
            rotation_details: experience.rotationDetails ?? null,
            description: experience.description ?? null,
          },
          personId: user.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onboarding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
