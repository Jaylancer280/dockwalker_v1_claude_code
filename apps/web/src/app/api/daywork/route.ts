import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent, appendEvents } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { getQrHireLimit } from '@/lib/rate-limit';
import { CV_BUILDER_ENABLED, CV_BUILDER_LOCKED_PAYLOAD } from '@/lib/cv/feature-flag';
import { randomUUID } from 'crypto';

/**
 * POST /api/daywork
 * Create a new daywork posting. Requires employer or agent hat.
 *
 * Body: {
 *   vesselId, roleId, locationPortId, startDate, endDate, workingDays,
 *   dayRate, currency,
 *   requiredCertificationIds?, experienceBracketId?, meals?, notes?
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json(
      { error: 'Only employers and agents can post daywork' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    vesselId,
    roleId,
    locationPortId,
    startDate,
    endDate,
    workingDays,
    workingDayDates,
    requiredCertificationIds,
    requiredLanguages,
    experienceBracketId,
    dayRate,
    currency,
    meals,
    notes,
    positionsAvailable,
    permanentOpportunity,
    /** QR-hire (spec §6): when present, the route fires DAYWORK.POSTED +
     * DAYWORK.INVITED atomically. The crew gets pre-shortlisted via the
     * existing DAYWORK.APPLIED projection branch. */
    inviteCrewPersonId,
  } = body;

  // Validate required fields
  if (
    !vesselId ||
    !roleId ||
    !locationPortId ||
    !startDate ||
    !endDate ||
    !workingDays ||
    dayRate === undefined ||
    dayRate === null ||
    dayRate === ''
  ) {
    return NextResponse.json(
      {
        error:
          'vesselId, roleId, locationPortId, startDate, endDate, workingDays, and dayRate are required',
      },
      { status: 400 },
    );
  }

  // Validate day rate
  const parsedDayRate = parseFloat(dayRate);
  if (isNaN(parsedDayRate) || parsedDayRate <= 0) {
    return NextResponse.json({ error: 'Day rate must be a positive number' }, { status: 400 });
  }

  // Validate currency
  const validCurrencies = ['EUR', 'USD', 'GBP', 'AED'];
  const resolvedCurrency = currency || 'EUR';
  if (!validCurrencies.includes(resolvedCurrency)) {
    return NextResponse.json(
      { error: 'Currency must be one of: EUR, USD, GBP, AED' },
      { status: 400 },
    );
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
  }

  // Validate start date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 });
  }

  // Validate working days
  const days = parseInt(workingDays, 10);
  if (isNaN(days) || days < 1 || days > 14) {
    return NextResponse.json({ error: 'Working days must be between 1 and 14' }, { status: 400 });
  }

  // Working days cannot exceed the calendar span
  const calendarDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (days > calendarDays) {
    return NextResponse.json(
      {
        error: `Working days (${days}) cannot exceed the number of days in the date range (${calendarDays})`,
      },
      { status: 400 },
    );
  }

  // Validate workingDayDates if provided
  let resolvedWorkingDays = days;
  if (workingDayDates && Array.isArray(workingDayDates) && workingDayDates.length > 0) {
    // All dates must be valid YYYY-MM-DD strings
    const invalidDate = workingDayDates.some(
      (d: string) => typeof d !== 'string' || isNaN(new Date(d).getTime()),
    );
    if (invalidDate) {
      return NextResponse.json(
        { error: 'All workingDayDates must be valid YYYY-MM-DD strings' },
        { status: 400 },
      );
    }

    // All dates must be within [startDate, endDate] range
    const outOfRange = workingDayDates.some((d: string) => d < startDate || d > endDate);
    if (outOfRange) {
      return NextResponse.json(
        { error: 'All workingDayDates must be within the start-end date range' },
        { status: 400 },
      );
    }

    // No duplicates
    const uniqueDates = new Set(workingDayDates);
    if (uniqueDates.size !== workingDayDates.length) {
      return NextResponse.json(
        { error: 'workingDayDates must not contain duplicates' },
        { status: 400 },
      );
    }

    // Derive working_days from dates
    resolvedWorkingDays = workingDayDates.length;
  }

  // Validate positions available
  const resolvedPositions = positionsAvailable ? parseInt(positionsAvailable, 10) : 1;
  if (isNaN(resolvedPositions) || resolvedPositions < 1 || resolvedPositions > 20) {
    return NextResponse.json(
      { error: 'positionsAvailable must be between 1 and 20' },
      { status: 400 },
    );
  }

  // Validate meals if provided
  const validMeals = ['breakfast', 'lunch', 'dinner'];
  if (meals && !Array.isArray(meals)) {
    return NextResponse.json({ error: 'Meals must be an array' }, { status: 400 });
  }
  if (meals && meals.some((m: string) => !validMeals.includes(m))) {
    return NextResponse.json({ error: 'Invalid meal option' }, { status: 400 });
  }

  try {
    // Validate FK references exist
    const [vesselResult, roleResult, portResult] = await Promise.all([
      supabase
        .from('vessels')
        .select('id')
        .eq('id', vesselId)
        .eq('owner_person_id', user.id)
        .single(),
      supabase.from('yacht_roles').select('id').eq('id', roleId).single(),
      supabase.from('ports').select('id').eq('id', locationPortId).single(),
    ]);

    if (!vesselResult.data) {
      return NextResponse.json({ error: 'Vessel not found or not owned by you' }, { status: 404 });
    }

    if (!roleResult.data) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    if (!portResult.data) {
      return NextResponse.json({ error: 'Invalid port/marina ID' }, { status: 400 });
    }

    if (experienceBracketId) {
      const { data: expBracket } = await supabase
        .from('experience_brackets')
        .select('id')
        .eq('id', experienceBracketId)
        .single();
      if (!expBracket) {
        return NextResponse.json({ error: 'Invalid experience bracket ID' }, { status: 400 });
      }
    }

    const dayworkId = randomUUID();

    // QR-hire branch (spec §6): atomic DAYWORK.POSTED + DAYWORK.INVITED.
    if (inviteCrewPersonId) {
      if (!CV_BUILDER_ENABLED) {
        // Feature is locked at the user level. Reject the QR-flagged
        // post entirely — refuse to create the daywork at all so a
        // captain who somehow finds the URL doesn't end up with a
        // public posting + a phantom uninvited crew member.
        return NextResponse.json(CV_BUILDER_LOCKED_PAYLOAD, { status: 503 });
      }
      if (typeof inviteCrewPersonId !== 'string') {
        return NextResponse.json({ error: 'inviteCrewPersonId must be a string' }, { status: 400 });
      }
      // Rate limit: 5/hour per employer for QR-flagged posts. Captain
      // hat-switches between accounts share the limit by person id —
      // that's intended; a real captain doesn't legitimately fire 5+
      // QR invites per hour.
      const limiter = getQrHireLimit();
      if (limiter) {
        const { success, remaining, reset } = await limiter.limit(`employer:${user.id}`);
        if (!success) {
          return NextResponse.json(
            { error: 'Hire limit reached. Try again in an hour.' },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
                'X-RateLimit-Remaining': String(remaining),
              },
            },
          );
        }
      }

      // Sanity check: target crew exists + is in crew identity_type.
      const { data: targetPerson } = await serviceClient
        .from('persons')
        .select('id, identity_type, deactivated_at, blocked_at')
        .eq('id', inviteCrewPersonId)
        .single();
      if (
        !targetPerson ||
        targetPerson.identity_type !== 'crew' ||
        targetPerson.deactivated_at ||
        targetPerson.blocked_at
      ) {
        return NextResponse.json(
          { error: 'Target crew not found or unavailable' },
          { status: 404 },
        );
      }

      try {
        await appendEvents(serviceClient, [
          {
            eventType: 'DAYWORK.POSTED',
            aggregateId: dayworkId,
            aggregateType: 'daywork',
            roleContext: person.current_hat,
            payload: {
              id: dayworkId,
              vessel_id: vesselId,
              role_id: roleId,
              location_port_id: locationPortId,
              start_date: startDate,
              end_date: endDate,
              working_days: resolvedWorkingDays,
              ...(workingDayDates?.length ? { working_day_dates: workingDayDates } : {}),
              required_certification_ids: requiredCertificationIds ?? [],
              required_languages: requiredLanguages ?? [],
              experience_bracket_id: experienceBracketId ?? null,
              day_rate: parsedDayRate,
              currency: resolvedCurrency,
              meals: meals ?? [],
              notes: notes ?? null,
              positions_available: resolvedPositions,
              permanent_opportunity: permanentOpportunity === true,
            },
            personId: user.id,
          },
          {
            eventType: 'DAYWORK.INVITED',
            aggregateId: dayworkId,
            aggregateType: 'invitation',
            roleContext: person.current_hat,
            payload: {
              daywork_id: dayworkId,
              crew_person_id: inviteCrewPersonId,
            },
            personId: user.id,
          },
        ]);
      } catch (e) {
        // Map daywork_invitations UNIQUE(daywork_id, crew_person_id)
        // violation to a 409 with the spec'd copy. v2.1 idempotency.
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('23505') || msg.toLowerCase().includes('unique')) {
          return NextResponse.json(
            { error: "You've already invited this crew to this posting." },
            { status: 409 },
          );
        }
        throw e;
      }

      notifyOnEvent(
        serviceClient,
        'DAYWORK.POSTED',
        { id: dayworkId, location_port_id: locationPortId, role_id: roleId },
        user.id,
      );
      notifyOnEvent(
        serviceClient,
        'DAYWORK.INVITED',
        { daywork_id: dayworkId, crew_person_id: inviteCrewPersonId },
        user.id,
      );

      return NextResponse.json({ id: dayworkId, invited: true }, { status: 201 });
    }

    // Standard daywork post (no invitation).
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.POSTED',
      aggregateId: dayworkId,
      aggregateType: 'daywork',
      roleContext: person.current_hat,
      payload: {
        id: dayworkId,
        vessel_id: vesselId,
        role_id: roleId,
        location_port_id: locationPortId,
        start_date: startDate,
        end_date: endDate,
        working_days: resolvedWorkingDays,
        ...(workingDayDates?.length ? { working_day_dates: workingDayDates } : {}),
        required_certification_ids: requiredCertificationIds ?? [],
        required_languages: requiredLanguages ?? [],
        experience_bracket_id: experienceBracketId ?? null,
        day_rate: parsedDayRate,
        currency: resolvedCurrency,
        meals: meals ?? [],
        notes: notes ?? null,
        positions_available: resolvedPositions,
        permanent_opportunity: permanentOpportunity === true,
      },
      personId: user.id,
    });

    notifyOnEvent(
      serviceClient,
      'DAYWORK.POSTED',
      { id: dayworkId, location_port_id: locationPortId, role_id: roleId },
      user.id,
    );

    return NextResponse.json({ id: dayworkId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post daywork';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
