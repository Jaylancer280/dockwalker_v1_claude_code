import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { randomUUID } from 'crypto';

/**
 * GET /api/vessels
 * Returns the authenticated user's vessels.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  // Owner policy on vessels table ensures only own vessels returned
  const { data: vessels, error } = await supabase
    .from('vessels')
    .select(
      'id, imo_number, name, vessel_type, size_band_id, loa_meters, nda_flag, created_at, vessel_size_bands(label)',
    )
    .eq('owner_person_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vessels: vessels ?? [] });
}

/**
 * POST /api/vessels
 * Creates a new vessel. Requires employer or agent hat.
 *
 * Body: {
 *   imoNumber: string (required),
 *   name: string (required),
 *   vesselType: 'private' | 'charter' (required),
 *   loaMeters: number (required, LOA in meters — size band auto-derived),
 *   ndaFlag: boolean (optional, default false)
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  // All authenticated users can create vessels (crew for experience entries,
  // employers/agents for job postings). NDA flag restricted to employer/agent.

  const body = await request.json();
  const { imoNumber, name, vesselType, loaMeters, ndaFlag } = body;

  // Validate required fields
  if (!imoNumber || !name || !vesselType || loaMeters == null) {
    return NextResponse.json(
      { error: 'imoNumber, name, vesselType, and loaMeters are required' },
      { status: 400 },
    );
  }

  // Validate IMO format (7 digits)
  const imoClean = imoNumber.toString().replace(/\D/g, '');
  if (imoClean.length !== 7) {
    return NextResponse.json({ error: 'IMO number must be exactly 7 digits' }, { status: 400 });
  }

  if (!['private', 'charter'].includes(vesselType)) {
    return NextResponse.json({ error: 'vesselType must be private or charter' }, { status: 400 });
  }

  const loa = Number(loaMeters);
  if (!Number.isFinite(loa) || loa < 1) {
    return NextResponse.json({ error: 'loaMeters must be a positive number' }, { status: 400 });
  }

  // Auto-derive size band from LOA
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

  // Check IMO not already registered by this user (per-registrant uniqueness)
  const { data: existing } = await serviceClient
    .from('vessels')
    .select('id')
    .eq('imo_number', imoClean)
    .eq('owner_person_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'You have already registered a vessel with this IMO number' },
      { status: 409 },
    );
  }

  const vesselId = randomUUID();

  try {
    await appendEvent(serviceClient, {
      eventType: 'VESSEL.CREATED',
      aggregateId: vesselId,
      aggregateType: 'vessel',
      roleContext: person.current_hat,
      payload: {
        id: vesselId,
        imo_number: imoClean,
        name,
        vessel_type: vesselType,
        size_band_id: sizeBand.id,
        loa_meters: loa,
        nda_flag: person.current_hat === 'crew' ? false : (ndaFlag ?? false),
      },
      personId: user.id,
    });

    return NextResponse.json({ id: vesselId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create vessel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
