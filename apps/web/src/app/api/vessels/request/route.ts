import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';
import { notifyAdminsOfVesselRequest } from '@/lib/push-triggers/vessel-admin-notify';

const VALID_VESSEL_TYPES = new Set(['motor', 'sail']);
const MAX_NAME_LENGTH = 120;
const MAX_BUILDER_LENGTH = 200;

/**
 * POST /api/vessels/request
 *
 * Manual vessel-request submission — last-resort path when the IMO
 * lookup at the four entry points (experience add, daywork post,
 * permanent post, /vessels manager) returns no canonical match.
 *
 * Body: `{ imo_number, name, vessel_type, loa_meters, nda_flag?,
 *         flag_state_id?, year_built?, builder?, gross_tonnage?,
 *         beam_meters? }`.
 *
 * Server-side: validates the IMO is exactly 7 digits and not already
 * registered by THIS user (multiple users may submit the same IMO
 * separately — admins merge duplicates via Wave E's queue), derives
 * the size band from `loa_meters`, fires `VESSEL.CREATED` with
 * `source='pending'`, optionally fires `VESSEL.REFLAGGED` (if a flag
 * state was provided) and `VESSEL.METADATA_UPDATED` (if any of the
 * enrichment fields are set), and fans an in-app notification out to
 * every active admin pointing at `/admin/vessels/pending`. Returns
 * `{ id }` so the client can redirect / pre-fill subsequent forms.
 *
 * The submitting user sees their typed text on their profile / posting
 * because the FK points to the new (pending) row. Other users' vessel
 * lookups stay clean — Wave E exposes the search filter equivalent of
 * Locations V2's 00118 migration; until then, the admin queue still
 * gates the row from polluting curated data.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const imoRaw = String(body.imo_number ?? '').replace(/\D/g, '');
  if (imoRaw.length !== 7) {
    return NextResponse.json({ error: 'IMO number must be exactly 7 digits' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const vesselType = typeof body.vessel_type === 'string' ? body.vessel_type : '';
  if (!VALID_VESSEL_TYPES.has(vesselType)) {
    return NextResponse.json({ error: 'vessel_type must be motor or sail' }, { status: 400 });
  }

  const loa = Number(body.loa_meters);
  if (!Number.isFinite(loa) || loa < 1 || loa > 200) {
    return NextResponse.json(
      { error: 'loa_meters must be a positive number under 200' },
      { status: 400 },
    );
  }

  const ndaFlag = person.current_hat === 'crew' ? false : Boolean(body.nda_flag);

  // Optional enrichment fields. Each validated; explicit null is preserved
  // (admin can clear later via VESSEL.METADATA_UPDATED).
  const flagStateId = typeof body.flag_state_id === 'string' ? body.flag_state_id : null;
  const yearBuilt = body.year_built == null ? null : Number(body.year_built);
  if (
    yearBuilt !== null &&
    (!Number.isInteger(yearBuilt) || yearBuilt < 1850 || yearBuilt > 2100)
  ) {
    return NextResponse.json(
      { error: 'year_built must be an integer between 1850 and 2100' },
      { status: 400 },
    );
  }
  const grossTonnage = body.gross_tonnage == null ? null : Number(body.gross_tonnage);
  if (grossTonnage !== null && (!Number.isFinite(grossTonnage) || grossTonnage <= 0)) {
    return NextResponse.json({ error: 'gross_tonnage must be > 0' }, { status: 400 });
  }
  const beamMeters = body.beam_meters == null ? null : Number(body.beam_meters);
  if (
    beamMeters !== null &&
    (!Number.isFinite(beamMeters) || beamMeters <= 0 || beamMeters >= 100)
  ) {
    return NextResponse.json({ error: 'beam_meters must be > 0 and < 100' }, { status: 400 });
  }
  const builder = typeof body.builder === 'string' ? body.builder.trim() : null;
  if (builder !== null && builder.length > MAX_BUILDER_LENGTH) {
    return NextResponse.json(
      { error: `builder must be ${MAX_BUILDER_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  // Derive size band from LOA — same logic as the legacy POST /api/vessels.
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

  // Per-user IMO uniqueness — same as the legacy route. Different users
  // submitting the same IMO is allowed; admins merge in Wave E.
  const { data: existing } = await serviceClient
    .from('vessels')
    .select('id')
    .eq('imo_number', imoRaw)
    .eq('owner_person_id', user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'You have already submitted a vessel with this IMO number' },
      { status: 409 },
    );
  }

  // Optional flag state validation (FK to flag_states.id text PK).
  let flagStateName: string | null = null;
  if (flagStateId) {
    const { data: flagRow } = await supabase
      .from('flag_states')
      .select('id, name')
      .eq('id', flagStateId)
      .maybeSingle();
    if (!flagRow) {
      return NextResponse.json({ error: 'Unknown flag_state_id' }, { status: 400 });
    }
    flagStateName = flagRow.name as string;
  }

  const vesselId = randomUUID();

  try {
    // 1. VESSEL.CREATED with source='pending' — the projection seeds
    //    `vessel_names` and stamps `submitted_by`.
    await appendEvent(serviceClient, {
      eventType: 'VESSEL.CREATED',
      aggregateId: vesselId,
      aggregateType: 'vessel',
      roleContext: person.current_hat,
      payload: {
        id: vesselId,
        imo_number: imoRaw,
        name,
        vessel_type: vesselType,
        size_band_id: sizeBand.id,
        loa_meters: loa,
        nda_flag: ndaFlag,
        source: 'pending',
      },
      personId: user.id,
    });

    // 2. Optional flag — emit VESSEL.REFLAGGED so the history table
    //    captures the submitter's claimed flag state.
    if (flagStateId) {
      await appendEvent(serviceClient, {
        eventType: 'VESSEL.REFLAGGED',
        aggregateId: vesselId,
        aggregateType: 'vessel',
        roleContext: person.current_hat,
        payload: {
          flag_state_id: flagStateId,
          source: 'pending',
        },
        personId: user.id,
      });
    }

    // 3. Optional metadata bundle. Single event covering whichever
    //    enrichment fields the user filled in.
    const hasMetadata =
      yearBuilt !== null ||
      grossTonnage !== null ||
      beamMeters !== null ||
      (builder !== null && builder !== '');
    if (hasMetadata) {
      const metadataPayload: Record<string, unknown> = {};
      if (yearBuilt !== null) metadataPayload.year_built = yearBuilt;
      if (grossTonnage !== null) metadataPayload.gross_tonnage = grossTonnage;
      if (beamMeters !== null) metadataPayload.beam_meters = beamMeters;
      if (builder !== null && builder !== '') metadataPayload.builder = builder;
      await appendEvent(serviceClient, {
        eventType: 'VESSEL.METADATA_UPDATED',
        aggregateId: vesselId,
        aggregateType: 'vessel',
        roleContext: person.current_hat,
        payload: metadataPayload,
        personId: user.id,
      });
    }

    // 4. Fan-out admin notification (fire-and-forget).
    try {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('display_name')
        .eq('person_id', user.id)
        .maybeSingle();
      const submitterName = (profile?.display_name as string | undefined) ?? 'A user';
      await notifyAdminsOfVesselRequest(serviceClient, {
        submitterName,
        vesselName: name,
        imoNumber: imoRaw,
        flagStateName,
      });
    } catch {
      // Swallow — notification failure is non-fatal.
    }

    return NextResponse.json({ id: vesselId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit vessel request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
