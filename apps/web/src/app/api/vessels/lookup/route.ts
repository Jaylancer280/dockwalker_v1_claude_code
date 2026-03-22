import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/vessels/lookup?imo=1234567
 * Looks up vessels by IMO number prefix.
 * - 4-6 digits: partial prefix search, returns up to 5 results
 * - 7 digits: exact match, returns single vessel with found: true/false
 * Any authenticated user can look up vessels (for experience entry).
 */
export async function GET(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  const { searchParams } = new URL(request.url);
  const imo = searchParams.get('imo');

  if (!imo) {
    return NextResponse.json({ error: 'imo query parameter is required' }, { status: 400 });
  }

  const imoClean = imo.replace(/\D/g, '');
  if (imoClean.length < 4 || imoClean.length > 7) {
    return NextResponse.json(
      { error: 'IMO number must be between 4 and 7 digits' },
      { status: 400 },
    );
  }

  // Partial search (4-6 digits): prefix match returning up to 5 results
  if (imoClean.length < 7) {
    const { data: vessels, error } = await serviceClient
      .from('vessels')
      .select('id, name, vessel_type, loa_meters, imo_number')
      .ilike('imo_number', `${imoClean}%`)
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      results: (vessels ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        vessel_type: v.vessel_type,
        loa_meters: v.loa_meters,
        imo_number: v.imo_number,
      })),
    });
  }

  // Exact search (7 digits): single vessel lookup
  const { data: vessel, error } = await serviceClient
    .from('vessels')
    // IMO intentionally excluded — caller already has it, prevents enumeration of NDA vessels
    .select('id, name, vessel_type, size_band_id, loa_meters, vessel_size_bands(label)')
    .eq('imo_number', imoClean)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!vessel) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    vessel: {
      id: vessel.id,
      name: vessel.name,
      vessel_type: vessel.vessel_type,
      size_band_id: vessel.size_band_id,
      loa_meters: vessel.loa_meters,
      size_band_label:
        (vessel.vessel_size_bands as unknown as { label: string } | null)?.label ?? null,
    },
  });
}
