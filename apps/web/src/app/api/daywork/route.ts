import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
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

  const body = await request.json();
  const {
    vesselId,
    roleId,
    locationPortId,
    startDate,
    endDate,
    workingDays,
    requiredCertificationIds,
    experienceBracketId,
    dayRate,
    currency,
    meals,
    notes,
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

  // Validate meals if provided
  const validMeals = ['breakfast', 'lunch', 'dinner'];
  if (meals && !Array.isArray(meals)) {
    return NextResponse.json({ error: 'Meals must be an array' }, { status: 400 });
  }
  if (meals && meals.some((m: string) => !validMeals.includes(m))) {
    return NextResponse.json({ error: 'Invalid meal option' }, { status: 400 });
  }

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

  try {
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
        working_days: days,
        required_certification_ids: requiredCertificationIds ?? [],
        experience_bracket_id: experienceBracketId ?? null,
        day_rate: parsedDayRate,
        currency: resolvedCurrency,
        meals: meals ?? [],
        notes: notes ?? null,
      },
      personId: user.id,
    });

    return NextResponse.json({ id: dayworkId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post daywork';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
