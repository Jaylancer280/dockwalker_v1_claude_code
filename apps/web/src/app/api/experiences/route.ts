import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

const VALID_VESSEL_OPERATIONS = ['charter', 'private'] as const;
const VALID_SALARY_CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
const VALID_SALARY_PERIODS = ['daily', 'monthly', 'annually'] as const;
const VALID_CONTRACT_TYPES = [
  'permanent',
  'rotational',
  'seasonal',
  'crossing',
  'delivery',
  'temporary',
] as const;

/**
 * GET /api/experiences
 * Returns the authenticated user's crew experiences with vessel + role data.
 * Salary fields are NEVER returned.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: experiences, error } = await supabase
      .from('crew_experiences')
      .select(
        `
        id, vessel_id, role_id, start_date, end_date, is_current,
        vessel_operation, flag_state, contract_type, contract_details,
        description, created_at, updated_at,
        vessels(id, imo_number, name, vessel_type, size_band_id, loa_meters, vessel_size_bands(label)),
        yacht_roles(id, name, department)
      `,
      )
      .eq('person_id', user.id)
      .order('start_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ experiences: experiences ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/experiences
 * Adds a crew experience entry.
 *
 * Body: {
 *   vesselId: string (required — must reference an existing vessel),
 *   roleId: string (required),
 *   startDate: string (required, YYYY-MM-DD),
 *   endDate: string | null (optional, YYYY-MM-DD),
 *   isCurrent: boolean (optional, default false),
 *   vesselOperation: 'charter' | 'private' (required),
 *   flagState: string | null (optional),
 *   salaryAmount: number | null (optional),
 *   salaryCurrency: 'EUR' | 'USD' | 'GBP' | 'AED' | null (optional),
 *   salaryPeriod: 'daily' | 'monthly' | 'annually' | null (optional),
 *   contractType: string | null (optional),
 *   contractDetails: string | null (optional),
 *   description: string | null (optional, max 250 chars)
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;

    const body = await request.json().catch(() => ({}));
    const {
      vesselId,
      roleId,
      startDate,
      endDate,
      isCurrent,
      vesselOperation,
      flagState,
      salaryAmount,
      salaryCurrency,
      salaryPeriod,
      seaTimeDays,
      seaTimeNauticalMiles,
      contractType,
      contractDetails,
      description,
    } = body;

    // Validate required fields
    if (!vesselId || !roleId || !startDate || !vesselOperation) {
      return NextResponse.json(
        { error: 'vesselId, roleId, startDate, and vesselOperation are required' },
        { status: 400 },
      );
    }

    if (!VALID_VESSEL_OPERATIONS.includes(vesselOperation)) {
      return NextResponse.json(
        { error: 'vesselOperation must be charter or private' },
        { status: 400 },
      );
    }

    if (salaryCurrency && !VALID_SALARY_CURRENCIES.includes(salaryCurrency)) {
      return NextResponse.json({ error: 'Invalid salary currency' }, { status: 400 });
    }

    if (salaryPeriod && !VALID_SALARY_PERIODS.includes(salaryPeriod)) {
      return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
    }

    if (contractType && !VALID_CONTRACT_TYPES.includes(contractType)) {
      return NextResponse.json({ error: 'Invalid contract type' }, { status: 400 });
    }

    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 });
    }

    if (description && description.length > 250) {
      return NextResponse.json(
        { error: 'Description must be 250 characters or less' },
        { status: 400 },
      );
    }

    if (contractDetails && contractDetails.length > 100) {
      return NextResponse.json(
        { error: 'Contract details must be 100 characters or less' },
        { status: 400 },
      );
    }

    // Check for is_current duplicate
    if (isCurrent) {
      const { data: currentExps } = await serviceClient
        .from('crew_experiences')
        .select('id')
        .eq('person_id', user.id)
        .eq('is_current', true)
        .limit(1);

      if (currentExps && currentExps.length > 0) {
        return NextResponse.json(
          { error: 'You already have a current experience. End it before adding another.' },
          { status: 409 },
        );
      }
    }

    // Check for date overlap with existing experiences
    const { data: existingExps } = await serviceClient
      .from('crew_experiences')
      .select('id, start_date, end_date')
      .eq('person_id', user.id);

    if (existingExps) {
      const newStart = startDate;
      const newEnd = endDate ?? null;
      const todayStr = new Date().toISOString().split('T')[0];
      const hasOverlap = existingExps.some((exp) => {
        const expStart = exp.start_date;
        const expEnd = exp.end_date;
        // Open-ended existing role (no end date): only overlaps if new experience starts on or before today
        // A future-dated experience (start > today) alongside an open-ended current role is allowed
        if (!expEnd && newStart > todayStr) return false;
        if (!newEnd && expStart > todayStr) return false;
        // Two ranges overlap if each starts before the other ends
        const newEndsAfterExpStarts = !newEnd || newEnd >= expStart;
        const expEndsAfterNewStarts = !expEnd || expEnd >= newStart;
        return newEndsAfterExpStarts && expEndsAfterNewStarts;
      });
      if (hasOverlap) {
        return NextResponse.json(
          { error: 'Experience dates overlap with an existing entry' },
          { status: 409 },
        );
      }
    }

    const experienceId = randomUUID();

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
        vessel_operation: vesselOperation,
        flag_state: flagState ?? null,
        salary_amount: salaryAmount ?? null,
        salary_currency: salaryCurrency ?? null,
        salary_period: salaryPeriod ?? null,
        sea_time_days: seaTimeDays != null ? Math.max(0, Math.round(seaTimeDays)) : null,
        sea_time_nautical_miles:
          seaTimeNauticalMiles != null ? Math.max(0, Math.round(seaTimeNauticalMiles)) : null,
        contract_type: contractType ?? null,
        contract_details: contractDetails ?? null,
        description: description ?? null,
      },
      personId: user.id,
    });

    return NextResponse.json({ id: experienceId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
