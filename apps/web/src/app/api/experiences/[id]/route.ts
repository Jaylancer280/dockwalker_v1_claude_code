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

  try {
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

    const body = await request.json().catch(() => ({}));
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
      seaTimeDays,
      seaTimeNauticalMiles,
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

    // Agent-specific constraints
    if (person.identity_type === 'agent') {
      if (isCurrent === true) {
        return NextResponse.json(
          { error: 'Agents cannot mark experience as current' },
          { status: 400 },
        );
      }
      if (endDate === null) {
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

    // P0-A — Snapshot field edit-lock when active references exist on this
    // experience. Vessel/role/start/end are frozen on the experience while
    // references are pending or accepted; users must revoke references first.
    // The projection layer enforces the same check as defence in depth (00126).
    const wantsLockedFieldChange =
      // We only check fields that are explicitly being SET (not undefined).
      // vesselId isn't accepted by this route (vessel changes happen via a
      // separate flow), so we only need role/start/end.
      roleId !== undefined || startDate !== undefined || endDate !== undefined;
    if (wantsLockedFieldChange) {
      const { count: activeRefCount } = await serviceClient
        .from('references')
        .select('id', { count: 'exact', head: true })
        .eq('experience_id', id)
        .in('status', ['pending', 'accepted']);
      if ((activeRefCount ?? 0) > 0) {
        const { data: thisExp } = await serviceClient
          .from('crew_experiences')
          .select('role_id, start_date, end_date')
          .eq('id', id)
          .single();
        const lockedFields: string[] = [];
        if (roleId !== undefined && roleId !== thisExp?.role_id) lockedFields.push('role');
        if (startDate !== undefined && startDate !== thisExp?.start_date)
          lockedFields.push('start_date');
        if (
          endDate !== undefined &&
          endDate !== thisExp?.end_date &&
          // null === null is a no-op
          !(endDate === null && thisExp?.end_date === null)
        )
          lockedFields.push('end_date');
        if (lockedFields.length > 0) {
          return NextResponse.json(
            {
              error:
                'Revoke active references on this experience before changing vessel, role, or dates.',
              locked_fields: lockedFields,
              active_references: activeRefCount,
            },
            { status: 409 },
          );
        }
      }
    }

    if (contractDetails && contractDetails.length > 100) {
      return NextResponse.json(
        { error: 'Contract details must be 100 characters or less' },
        { status: 400 },
      );
    }

    // Check for is_current duplicate (excluding this experience)
    if (isCurrent) {
      const { data: currentExps } = await serviceClient
        .from('crew_experiences')
        .select('id')
        .eq('person_id', user.id)
        .eq('is_current', true)
        .neq('id', id)
        .limit(1);

      if (currentExps && currentExps.length > 0) {
        return NextResponse.json(
          { error: 'You already have a current experience. End it before adding another.' },
          { status: 409 },
        );
      }
    }

    // Check for date overlap with existing experiences (excluding this one)
    if (startDate || endDate !== undefined) {
      // Need the full record to compute overlap when only one date is changing
      const { data: thisExp } = await serviceClient
        .from('crew_experiences')
        .select('start_date, end_date')
        .eq('id', id)
        .single();

      const effectiveStart = startDate ?? thisExp?.start_date;
      const effectiveEnd = endDate !== undefined ? endDate : thisExp?.end_date;

      if (effectiveStart) {
        const { data: otherExps } = await serviceClient
          .from('crew_experiences')
          .select('id, start_date, end_date')
          .eq('person_id', user.id)
          .neq('id', id);

        if (otherExps) {
          const todayStr = new Date().toISOString().split('T')[0];
          const hasOverlap = otherExps.some((exp) => {
            const expStart = exp.start_date;
            const expEnd = exp.end_date;
            // Open-ended role: future-dated experience alongside open-ended current role is allowed
            if (!expEnd && effectiveStart > todayStr) return false;
            if (!effectiveEnd && expStart > todayStr) return false;
            const newEndsAfterExpStarts = !effectiveEnd || effectiveEnd >= expStart;
            const expEndsAfterNewStarts = !expEnd || expEnd >= effectiveStart;
            return newEndsAfterExpStarts && expEndsAfterNewStarts;
          });
          if (hasOverlap) {
            return NextResponse.json(
              { error: 'Experience dates overlap with an existing entry' },
              { status: 409 },
            );
          }
        }
      }
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
    if (seaTimeDays !== undefined)
      payload.sea_time_days = seaTimeDays != null ? Math.max(0, Math.round(seaTimeDays)) : null;
    if (seaTimeNauticalMiles !== undefined)
      payload.sea_time_nautical_miles =
        seaTimeNauticalMiles != null ? Math.max(0, Math.round(seaTimeNauticalMiles)) : null;
    if (contractType !== undefined) payload.contract_type = contractType;
    if (contractDetails !== undefined) payload.contract_details = contractDetails;
    if (description !== undefined) payload.description = description;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

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
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/experiences/[id]
 * Removes a crew experience entry. Only the owner can delete.
 *
 * Fix A — references auto-revoke + in-app notification fan-out: BEFORE firing
 * EXPERIENCE.REMOVED, we capture the affected accepted-referee set so we can
 * notify them after the projection's 3-step soft-revoke completes. The
 * projection (00126) handles the actual revoke + revoke_reason stamping.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
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

    // Capture affected accepted referees BEFORE firing EXPERIENCE.REMOVED so
    // the projection's revoke doesn't blank the data we need for the body.
    const { data: affectedRefs } = await serviceClient
      .from('references')
      .select('id, referee_person_id, snapshot_vessel_name, snapshot_start_date, snapshot_end_date')
      .eq('experience_id', id)
      .eq('status', 'accepted')
      .not('referee_person_id', 'is', null);
    const { data: requesterProfile } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('person_id', user.id)
      .maybeSingle();
    const requesterName = requesterProfile?.display_name ?? 'A crew member';

    await appendEvent(serviceClient, {
      eventType: 'EXPERIENCE.REMOVED',
      aggregateId: id,
      aggregateType: 'experience',
      roleContext: person.current_hat,
      payload: {},
      personId: user.id,
    });

    // In-app-only fan-out (Fix A — no email, no push, no WhatsApp). Direct
    // notifications insert because notifyOnEvent has no channel override and
    // would multi-cast. Fire-and-forget — never block the response.
    if (affectedRefs && affectedRefs.length > 0) {
      const rows = affectedRefs
        .filter(
          (
            r,
          ): r is {
            id: string;
            referee_person_id: string;
            snapshot_vessel_name: string;
            snapshot_start_date: string;
            snapshot_end_date: string | null;
          } => r.referee_person_id !== null,
        )
        .map((r) => {
          const dates = r.snapshot_end_date
            ? `${r.snapshot_start_date}—${r.snapshot_end_date}`
            : `from ${r.snapshot_start_date}`;
          return {
            person_id: r.referee_person_id,
            type: 'reference_auto_revoked',
            title: 'Reference withdrawn',
            body: `${requesterName} removed the experience this reference was tied to. Your reference for ${r.snapshot_vessel_name} · ${dates} has been withdrawn.`,
            deep_link: '/profile/settings/references',
            role_context: 'crew',
          };
        });
      if (rows.length > 0) {
        serviceClient
          .from('notifications')
          .insert(rows)
          .then(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
