import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/daywork
 * Create a new daywork posting. Requires employer or agent hat.
 *
 * Body: {
 *   vesselId, roleId, locationPortId, startDate, endDate, workingDays,
 *   requiredCertificationIds?, experienceBracketId?, dayRate?, meals?, notes?
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

  const { data: person } = await supabase
    .from('persons')
    .select('current_hat')
    .eq('id', user.id)
    .single();

  if (!person || !['employer', 'agent'].includes(person.current_hat)) {
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
    meals,
    notes,
  } = body;

  // Validate required fields
  if (!vesselId || !roleId || !locationPortId || !startDate || !endDate || !workingDays) {
    return NextResponse.json(
      {
        error: 'vesselId, roleId, locationPortId, startDate, endDate, and workingDays are required',
      },
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

  // Validate working days
  const days = parseInt(workingDays, 10);
  if (isNaN(days) || days < 1 || days > 14) {
    return NextResponse.json({ error: 'Working days must be between 1 and 14' }, { status: 400 });
  }

  // Validate meals if provided
  const validMeals = ['breakfast', 'lunch', 'dinner'];
  if (meals && !Array.isArray(meals)) {
    return NextResponse.json({ error: 'Meals must be an array' }, { status: 400 });
  }
  if (meals && meals.some((m: string) => !validMeals.includes(m))) {
    return NextResponse.json({ error: 'Invalid meal option' }, { status: 400 });
  }

  // Verify vessel belongs to this user
  const { data: vessel } = await supabase
    .from('vessels')
    .select('id')
    .eq('id', vesselId)
    .eq('owner_person_id', user.id)
    .single();

  if (!vessel) {
    return NextResponse.json({ error: 'Vessel not found or not owned by you' }, { status: 404 });
  }

  const dayworkId = randomUUID();

  try {
    const { error: eventError } = await serviceClient.rpc('append_event', {
      p_event_type: 'DAYWORK.POSTED',
      p_aggregate_id: dayworkId,
      p_aggregate_type: 'daywork',
      p_role_context: person.current_hat,
      p_payload: {
        id: dayworkId,
        vessel_id: vesselId,
        role_id: roleId,
        location_port_id: locationPortId,
        start_date: startDate,
        end_date: endDate,
        working_days: days,
        required_certification_ids: requiredCertificationIds ?? [],
        experience_bracket_id: experienceBracketId ?? null,
        day_rate: dayRate ? parseFloat(dayRate) : null,
        meals: meals ?? [],
        notes: notes ?? null,
      },
      p_person_id: user.id,
    });

    if (eventError) {
      throw new Error(eventError.message);
    }

    return NextResponse.json({ id: dayworkId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post daywork';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
