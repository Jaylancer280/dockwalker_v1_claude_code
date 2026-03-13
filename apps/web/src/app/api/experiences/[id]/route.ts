import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

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
    vesselOperation,
    flagState,
    salaryAmount,
    salaryCurrency,
    salaryPeriod,
    contractType,
    contractDetails,
    description,
  } = body;

  if (vesselOperation && !VALID_VESSEL_OPERATIONS.includes(vesselOperation)) {
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

  // Build payload with only provided fields
  const payload: Record<string, unknown> = {};
  if (roleId !== undefined) payload.role_id = roleId;
  if (startDate !== undefined) payload.start_date = startDate;
  if (endDate !== undefined) payload.end_date = endDate;
  if (isCurrent !== undefined) payload.is_current = isCurrent;
  if (vesselOperation !== undefined) payload.vessel_operation = vesselOperation;
  if (flagState !== undefined) payload.flag_state = flagState;
  if (salaryAmount !== undefined) payload.salary_amount = salaryAmount;
  if (salaryCurrency !== undefined) payload.salary_currency = salaryCurrency;
  if (salaryPeriod !== undefined) payload.salary_period = salaryPeriod;
  if (contractType !== undefined) payload.contract_type = contractType;
  if (contractDetails !== undefined) payload.contract_details = contractDetails;
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
