import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

const VALID_CHARTER_PRIVATE = ['charter', 'private'] as const;
const VALID_SALARY_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
const VALID_SALARY_PERIODS = ['daily', 'monthly', 'annually'] as const;
const VALID_ROTATION_TYPES = [
  '2:2',
  '3:1',
  '3:3',
  '5:1',
  'permanent',
  'seasonal',
  'mlc_standard',
  'other',
] as const;

/**
 * GET /api/experiences
 * Returns the authenticated user's crew experiences with vessel + role data.
 * Salary fields are NEVER returned.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const { data: experiences, error } = await supabase
    .from('crew_experiences')
    .select(
      `
      id, vessel_id, role_id, start_date, end_date, is_current,
      charter_or_private, flag_state, rotation_type, rotation_details,
      description, created_at, updated_at,
      vessels(id, imo_number, name, vessel_type, size_band_id, loa_meters, vessel_size_bands(label)),
      yacht_roles(id, label)
    `,
    )
    .eq('person_id', user.id)
    .order('start_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiences: experiences ?? [] });
}

/**
 * POST /api/experiences
 * Adds a crew experience entry.
 *
 * Body: {
 *   vesselId: string (required — must reference an existing vessel),
 *   roleId: string (required),
 *   startDate: string (required, YYYY-MM-DD),
 *   endDate: string | null (optional),
 *   isCurrent: boolean (optional, default false),
 *   charterOrPrivate: 'charter' | 'private' (required),
 *   flagState: string | null (optional),
 *   salaryAmount: number | null (optional),
 *   salaryCurrency: 'EUR' | 'USD' | 'GBP' | 'AED' | null (optional),
 *   salaryPeriod: 'daily' | 'monthly' | 'annually' | null (optional),
 *   rotationType: string | null (optional),
 *   rotationDetails: string | null (optional),
 *   description: string | null (optional, max 250 chars)
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, serviceClient } = guard.value;

  const body = await request.json();
  const {
    vesselId,
    roleId,
    startDate,
    endDate,
    isCurrent,
    charterOrPrivate,
    flagState,
    salaryAmount,
    salaryCurrency,
    salaryPeriod,
    rotationType,
    rotationDetails,
    description,
  } = body;

  // Validate required fields
  if (!vesselId || !roleId || !startDate || !charterOrPrivate) {
    return NextResponse.json(
      { error: 'vesselId, roleId, startDate, and charterOrPrivate are required' },
      { status: 400 },
    );
  }

  if (!VALID_CHARTER_PRIVATE.includes(charterOrPrivate)) {
    return NextResponse.json(
      { error: 'charterOrPrivate must be charter or private' },
      { status: 400 },
    );
  }

  if (salaryCurrency && !VALID_SALARY_CURRENCIES.includes(salaryCurrency)) {
    return NextResponse.json({ error: 'Invalid salary currency' }, { status: 400 });
  }

  if (salaryPeriod && !VALID_SALARY_PERIODS.includes(salaryPeriod)) {
    return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
  }

  if (rotationType && !VALID_ROTATION_TYPES.includes(rotationType)) {
    return NextResponse.json({ error: 'Invalid rotation type' }, { status: 400 });
  }

  if (description && description.length > 250) {
    return NextResponse.json(
      { error: 'Description must be 250 characters or less' },
      { status: 400 },
    );
  }

  if (rotationDetails && rotationDetails.length > 100) {
    return NextResponse.json(
      { error: 'Rotation details must be 100 characters or less' },
      { status: 400 },
    );
  }

  const experienceId = randomUUID();

  try {
    await appendEvent(serviceClient, {
      eventType: 'EXPERIENCE.ADDED',
      aggregateId: experienceId,
      aggregateType: 'experience',
      roleContext: person.current_hat,
      payload: {
        id: experienceId,
        vessel_id: vesselId,
        role_id: roleId,
        start_date: startDate,
        end_date: endDate ?? null,
        is_current: isCurrent ?? false,
        charter_or_private: charterOrPrivate,
        flag_state: flagState ?? null,
        salary_amount: salaryAmount ?? null,
        salary_currency: salaryCurrency ?? null,
        salary_period: salaryPeriod ?? null,
        rotation_type: rotationType ?? null,
        rotation_details: rotationDetails ?? null,
        description: description ?? null,
      },
      personId: user.id,
    });

    return NextResponse.json({ id: experienceId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add experience';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
