import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

const VALID_VESSEL_TYPES = ['motor', 'sail'] as const;
const VALID_VESSEL_OPERATIONS = ['private', 'charter'] as const;

/**
 * PATCH /api/vessels/[id]
 * Updates an existing vessel. Only the owner can update.
 * NDA flag cannot be removed once set (immutability guard).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  const { id } = await params;

  // Verify ownership
  const { data: existing } = await supabase
    .from('vessels')
    .select('id, nda_flag')
    .eq('id', id)
    .eq('owner_person_id', user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, vesselType, vesselOperation, loaMeters, ndaFlag } = body;

  if (vesselType && !VALID_VESSEL_TYPES.includes(vesselType)) {
    return NextResponse.json({ error: 'vesselType must be motor or sail' }, { status: 400 });
  }

  if (vesselOperation && !VALID_VESSEL_OPERATIONS.includes(vesselOperation)) {
    return NextResponse.json(
      { error: 'vesselOperation must be private or charter' },
      { status: 400 },
    );
  }

  if (loaMeters !== undefined) {
    const loa = Number(loaMeters);
    if (!Number.isFinite(loa) || loa < 1) {
      return NextResponse.json({ error: 'loaMeters must be a positive number' }, { status: 400 });
    }
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
  }

  // NDA immutability: cannot remove NDA flag once set
  if (ndaFlag === false && existing.nda_flag === true) {
    return NextResponse.json({ error: 'NDA flag cannot be removed once set' }, { status: 400 });
  }

  // Build payload with only provided fields
  const payload: Record<string, unknown> = {};
  if (name !== undefined) payload.name = name.trim();
  if (vesselType !== undefined) payload.vessel_type = vesselType;
  if (vesselOperation !== undefined) payload.vessel_operation = vesselOperation;
  if (ndaFlag !== undefined) payload.nda_flag = ndaFlag;

  // Auto-derive size band from LOA if LOA is changing
  if (loaMeters !== undefined) {
    const loa = Number(loaMeters);
    const { data: sizeBands } = await supabase
      .from('vessel_size_bands')
      .select('id, min_meters, max_meters')
      .order('min_meters');

    if (!sizeBands || sizeBands.length === 0) {
      return NextResponse.json({ error: 'Size bands not available' }, { status: 500 });
    }

    const sizeBand = sizeBands.find(
      (b) => loa >= b.min_meters && (b.max_meters === null || loa < b.max_meters),
    );

    if (!sizeBand) {
      return NextResponse.json(
        { error: `LOA ${loa}m does not match any size band (minimum ${sizeBands[0].min_meters}m)` },
        { status: 400 },
      );
    }

    payload.loa_meters = loa;
    payload.size_band_id = sizeBand.id;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'VESSEL.UPDATED',
      aggregateId: id,
      aggregateType: 'vessel',
      roleContext: person.current_hat,
      payload: payload as Parameters<typeof appendEvent<'VESSEL.UPDATED'>>[1]['payload'],
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update vessel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
