import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

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
 * PATCH /api/experiences/[id]
 * Updates an existing crew experience entry. Only the owner can update.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  const { id } = await params;

  // Verify ownership
  const { data: existing } = await supabase
    .from('crew_experiences')
    .select('id')
    .eq('id', id)
    .eq('person_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  }

  const body = await request.json();
  const {
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

  if (charterOrPrivate && !VALID_CHARTER_PRIVATE.includes(charterOrPrivate)) {
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

  // Build payload with only provided fields
  const payload: Record<string, unknown> = {};
  if (roleId !== undefined) payload.role_id = roleId;
  if (startDate !== undefined) payload.start_date = startDate;
  if (endDate !== undefined) payload.end_date = endDate;
  if (isCurrent !== undefined) payload.is_current = isCurrent;
  if (charterOrPrivate !== undefined) payload.charter_or_private = charterOrPrivate;
  if (flagState !== undefined) payload.flag_state = flagState;
  if (salaryAmount !== undefined) payload.salary_amount = salaryAmount;
  if (salaryCurrency !== undefined) payload.salary_currency = salaryCurrency;
  if (salaryPeriod !== undefined) payload.salary_period = salaryPeriod;
  if (rotationType !== undefined) payload.rotation_type = rotationType;
  if (rotationDetails !== undefined) payload.rotation_details = rotationDetails;
  if (description !== undefined) payload.description = description;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'EXPERIENCE.UPDATED',
      aggregateId: id,
      aggregateType: 'experience',
      roleContext: person.current_hat,
      payload: payload as Parameters<typeof appendEvent<'EXPERIENCE.UPDATED'>>[1]['payload'],
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update experience';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/experiences/[id]
 * Removes a crew experience entry. Only the owner can delete.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  const { id } = await params;

  // Verify ownership
  const { data: existing } = await supabase
    .from('crew_experiences')
    .select('id')
    .eq('id', id)
    .eq('person_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'EXPERIENCE.REMOVED',
      aggregateId: id,
      aggregateType: 'experience',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove experience';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
