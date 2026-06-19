import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { requireSubscription } from '@/lib/require-subscription';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/permanent
 * Create a new permanent job posting. Requires employer or agent hat.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json(
      { error: 'Only employers and agents can post permanent positions' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      vesselId,
      roleId,
      locationPortId,
      startDate,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      liveAboard,
      requiredCertificationIds,
      requiredLanguages,
      experienceBracketId,
      shortlistCap,
      notes,
      contractType,
      contractDetails,
      description,
      meals,
      positionsAvailable,
    } = body;

    // Validate required fields
    if (
      !vesselId ||
      !roleId ||
      !locationPortId ||
      !startDate ||
      salaryMin === undefined ||
      salaryMin === null ||
      salaryMax === undefined ||
      salaryMax === null ||
      !salaryCurrency ||
      !salaryPeriod ||
      liveAboard === undefined ||
      liveAboard === null
    ) {
      return NextResponse.json(
        {
          error:
            'vesselId, roleId, locationPortId, startDate, salaryMin, salaryMax, salaryCurrency, salaryPeriod, and liveAboard are required',
        },
        { status: 400 },
      );
    }

    // Validate salary
    const parsedMin = parseFloat(salaryMin);
    const parsedMax = parseFloat(salaryMax);
    if (isNaN(parsedMin) || parsedMin <= 0) {
      return NextResponse.json({ error: 'salaryMin must be a positive number' }, { status: 400 });
    }
    if (isNaN(parsedMax) || parsedMax <= 0) {
      return NextResponse.json({ error: 'salaryMax must be a positive number' }, { status: 400 });
    }
    if (parsedMax < parsedMin) {
      return NextResponse.json(
        { error: 'salaryMax must be greater than or equal to salaryMin' },
        { status: 400 },
      );
    }

    // Validate currency
    const validCurrencies = ['EUR', 'USD', 'GBP', 'AED'];
    if (!validCurrencies.includes(salaryCurrency)) {
      return NextResponse.json(
        { error: 'salaryCurrency must be one of: EUR, USD, GBP, AED' },
        { status: 400 },
      );
    }

    // Validate salary period
    const validPeriods = ['monthly', 'annual'];
    if (!validPeriods.includes(salaryPeriod)) {
      return NextResponse.json(
        { error: 'salaryPeriod must be one of: monthly, annual' },
        { status: 400 },
      );
    }

    // Validate start date format
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Validate liveAboard is boolean
    if (typeof liveAboard !== 'boolean') {
      return NextResponse.json({ error: 'liveAboard must be a boolean' }, { status: 400 });
    }

    // Validate shortlist cap — clamped by subscription tier
    const subResult = await requireSubscription(supabase, user.id, 'employer_pro');
    const tierMax = subResult.ok ? 8 : 3;
    const resolvedShortlistCap = Math.min(
      shortlistCap !== undefined ? parseInt(shortlistCap, 10) || 5 : 5,
      tierMax,
    );
    if (isNaN(resolvedShortlistCap) || resolvedShortlistCap < 1) {
      return NextResponse.json({ error: 'shortlistCap must be at least 1' }, { status: 400 });
    }

    // Validate notes length
    if (notes && typeof notes === 'string' && notes.length > 500) {
      return NextResponse.json({ error: 'Notes must be 500 characters or less' }, { status: 400 });
    }

    // Validate contract_type if provided
    const validContractTypes = [
      'permanent',
      'rotational',
      'seasonal',
      'crossing',
      'delivery',
      'temporary',
    ];
    if (contractType && !validContractTypes.includes(contractType)) {
      return NextResponse.json({ error: 'Invalid contract type' }, { status: 400 });
    }

    // Validate positions_available
    const resolvedPositions =
      positionsAvailable !== undefined ? parseInt(positionsAvailable, 10) : 1;
    if (isNaN(resolvedPositions) || resolvedPositions < 1 || resolvedPositions > 20) {
      return NextResponse.json(
        { error: 'positionsAvailable must be between 1 and 20' },
        { status: 400 },
      );
    }

    // Validate FK references exist
    const fkChecks = [
      supabase
        .from('vessels')
        .select('id')
        .eq('id', vesselId)
        .eq('owner_person_id', user.id)
        .single(),
      supabase.from('yacht_roles').select('id').eq('id', roleId).single(),
      supabase.from('ports').select('id').eq('id', locationPortId).single(),
    ];

    if (experienceBracketId) {
      fkChecks.push(
        supabase.from('experience_brackets').select('id').eq('id', experienceBracketId).single(),
      );
    }

    const [vesselResult, roleResult, portResult, expResult] = await Promise.all(fkChecks);

    if (!vesselResult.data) {
      return NextResponse.json({ error: 'Vessel not found or not owned by you' }, { status: 400 });
    }
    if (!roleResult.data) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }
    if (!portResult.data) {
      return NextResponse.json({ error: 'Invalid port/marina ID' }, { status: 400 });
    }
    if (experienceBracketId && !expResult?.data) {
      return NextResponse.json({ error: 'Invalid experience bracket ID' }, { status: 400 });
    }

    // Validate certification IDs if provided
    if (
      requiredCertificationIds &&
      Array.isArray(requiredCertificationIds) &&
      requiredCertificationIds.length > 0
    ) {
      const { data: certs } = await supabase
        .from('certifications')
        .select('id')
        .in('id', requiredCertificationIds);
      if (!certs || certs.length !== requiredCertificationIds.length) {
        return NextResponse.json(
          { error: 'One or more certification IDs are invalid' },
          { status: 400 },
        );
      }
    }

    const postingId = randomUUID();

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.POSTED',
      aggregateId: postingId,
      aggregateType: 'permanent',
      roleContext: person.current_hat,
      payload: {
        id: postingId,
        vessel_id: vesselId,
        role_id: roleId,
        port_id: locationPortId,
        start_date: startDate,
        salary_min: parsedMin,
        salary_max: parsedMax,
        salary_currency: salaryCurrency,
        salary_period: salaryPeriod,
        live_aboard: liveAboard,
        required_certification_ids: requiredCertificationIds ?? [],
        required_languages: requiredLanguages ?? [],
        experience_bracket_id: experienceBracketId ?? null,
        shortlist_cap: resolvedShortlistCap,
        notes: notes ?? null,
        contract_type: contractType ?? null,
        contract_details: contractDetails ?? null,
        description: description ?? null,
        meals: meals ?? [],
        positions_available: resolvedPositions,
      },
      personId: user.id,
    });

    return NextResponse.json({ id: postingId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post permanent position';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
