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
      'id, imo_number, name, vessel_type, size_band_id, nda_flag, created_at, vessel_size_bands(label)',
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
 *   sizeBandId: string (required),
 *   ndaFlag: boolean (optional, default false)
 * }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json(
      { error: 'Only employers and agents can create vessels' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { imoNumber, name, vesselType, sizeBandId, ndaFlag } = body;

  // Validate required fields
  if (!imoNumber || !name || !vesselType || !sizeBandId) {
    return NextResponse.json(
      { error: 'imoNumber, name, vesselType, and sizeBandId are required' },
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

  // Validate size band exists
  const { data: sizeBand } = await supabase
    .from('vessel_size_bands')
    .select('id')
    .eq('id', sizeBandId)
    .single();

  if (!sizeBand) {
    return NextResponse.json({ error: 'Invalid size band ID' }, { status: 400 });
  }

  // Check IMO not already registered
  const { data: existing } = await serviceClient
    .from('vessels')
    .select('id')
    .eq('imo_number', imoClean)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'A vessel with this IMO number is already registered' },
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
        size_band_id: sizeBandId,
        nda_flag: ndaFlag ?? false,
      },
      personId: user.id,
    });

    return NextResponse.json({ id: vesselId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create vessel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
