import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/vessels/lookup?imo=1234567
 * Looks up a vessel by IMO number. Returns vessel data if found.
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
  if (imoClean.length !== 7) {
    return NextResponse.json({ error: 'IMO number must be exactly 7 digits' }, { status: 400 });
  }

  const { data: vessel, error } = await serviceClient
    .from('vessels')
    .select('id, imo_number, name, vessel_type, size_band_id, loa_meters, vessel_size_bands(label)')
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
      imo_number: vessel.imo_number,
      name: vessel.name,
      vessel_type: vessel.vessel_type,
      size_band_id: vessel.size_band_id,
      loa_meters: vessel.loa_meters,
      size_band_label:
        (vessel.vessel_size_bands as unknown as { label: string } | null)?.label ?? null,
    },
  });
}
