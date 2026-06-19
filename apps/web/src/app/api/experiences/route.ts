import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { resolveHistoricalVesselNames } from '@/lib/vessels/historical-names';
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
 * Salary + sea time fields returned to owner only (RLS-scoped, never exposed via view-only profile API).
 *
 * Query params:
 *   `nda_only=true` — restricts the result to experiences whose vessel has
 *     `nda_flag = true`, and skips the historical-name resolution + references
 *     active-count + subscription-plan lookups (audit P1-P5). Used by the
 *     CV settings page which only renders the NDA-flagged experiences and
 *     doesn't need the rest. NDA names get masked anyway, so historical
 *     resolution is wasted work for this caller.
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;
    const ndaOnly = new URL(request.url).searchParams.get('nda_only') === 'true';

    let query = supabase
      .from('crew_experiences')
      .select(
        `
        id, vessel_id, role_id, start_date, end_date, is_current,
        vessel_operation, flag_state, contract_type, contract_details,
        description, sea_time_days, sea_time_nautical_miles,
        salary_amount, salary_currency, salary_period,
        cv_show_full_vessel,
        created_at, updated_at,
        vessels!inner(id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag, source, hidden_at, vessel_size_bands(label)),
        yacht_roles(id, name, department)
      `,
      )
      .eq('person_id', user.id)
      .order('start_date', { ascending: false });

    if (ndaOnly) {
      // Filter at SQL level via the embedded vessels join. `vessels!inner`
      // (above) ensures rows without a vessel are excluded — necessary
      // because the inner-join + .eq('vessels.nda_flag', true) filter pair
      // is the only PostgREST way to filter by an embedded column.
      query = query.eq('vessels.nda_flag', true);
    }

    const { data: experiences, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (experiences ?? []) as unknown as Array<
      {
        vessel_id: string | null;
        start_date: string;
        vessels: { name: string } | null;
      } & Record<string, unknown>
    >;

    // Audit P1-P5: NDA-only callers skip historical-name resolution +
    // references-active-count + subscription-plan lookup. NDA names get
    // masked anyway and the settings page doesn't render the other fields.
    if (ndaOnly) {
      return NextResponse.json({ experiences: rows, subscription_plan: 'free' });
    }

    const historicalMap = await resolveHistoricalVesselNames(
      supabase,
      rows
        .filter((r) => r.vessel_id)
        .map((r) => ({ vessel_id: r.vessel_id as string, start_date: r.start_date })),
    );
    const enriched = rows.map((r) => {
      if (!r.vessel_id) return r;
      const historical = historicalMap.get(`${r.vessel_id}|${r.start_date}`);
      const current = r.vessels?.name ?? null;
      return {
        ...r,
        historical_vessel_name: historical && historical !== current ? historical : null,
      };
    });

    // References — per-experience active counts for the "Add reference" UI.
    const expIds = enriched.map((r) => r.id as string).filter(Boolean);
    let referencesActiveByExp: Record<string, number> = {};
    if (expIds.length > 0) {
      const { data: refRows } = await supabase
        .from('references')
        .select('experience_id')
        .in('experience_id', expIds)
        .in('status', ['pending', 'accepted']);
      referencesActiveByExp = (refRows ?? []).reduce<Record<string, number>>((acc, row) => {
        const id = row.experience_id as string;
        acc[id] = (acc[id] ?? 0) + 1;
        return acc;
      }, {});
    }
    const enrichedWithRefs = enriched.map((r) => ({
      ...r,
      references_active_count: referencesActiveByExp[r.id as string] ?? 0,
    }));

    // Caller's subscription plan — drives the per-experience cap on "Add reference".
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('person_id', user.id)
      .maybeSingle();
    const subscriptionPlan = (sub?.plan as string | undefined) ?? 'free';

    return NextResponse.json({
      experiences: enrichedWithRefs,
      subscription_plan: subscriptionPlan,
    });
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

    // Agent-specific constraints
    if (person.identity_type === 'agent') {
      if (isCurrent) {
        return NextResponse.json(
          { error: 'Agents cannot mark experience as current' },
          { status: 400 },
        );
      }
      if (!endDate) {
        return NextResponse.json(
          { error: 'End date is required for maritime background entries' },
          { status: 400 },
        );
      }
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
