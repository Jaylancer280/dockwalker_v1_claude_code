import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';

/**
 * GET /api/vessels/lookup?imo=1234567
 * Looks up vessels by IMO number prefix.
 * - 4-6 digits: partial prefix search, returns up to 5 results
 * - 7 digits: exact match, returns single vessel with found: true/false
 * Any authenticated user can look up vessels (for experience entry).
 * Onboarding-friendly: pre-onboarding users hit this from the
 * vessel-experience step.
 */
export async function GET(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

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

  // Wave F filter: hide `source='pending'` and `hidden_at IS NOT NULL`
  // rows from everyone EXCEPT the submitting owner. The submitter still
  // needs to find their own pending vessel via this lookup (e.g. to
  // attach it to a new posting before admin approval lands).
  const PUBLIC_SOURCES = ['curated', 'user_submitted'] as const;

  // Partial search (4-6 digits): prefix match returning up to 5 results
  if (imoClean.length < 7) {
    const { data: vessels, error } = await serviceClient
      .from('vessels')
      .select('id, name, vessel_type, loa_meters, imo_number, source, hidden_at, owner_person_id')
      .ilike('imo_number', `${imoClean}%`)
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const visible = (vessels ?? []).filter((v) => {
      if (v.hidden_at && v.owner_person_id !== user.id) return false;
      if (v.source === 'pending' && v.owner_person_id !== user.id) return false;
      return (
        PUBLIC_SOURCES.includes(v.source as 'curated' | 'user_submitted') ||
        v.owner_person_id === user.id
      );
    });

    return NextResponse.json({
      results: visible.slice(0, 5).map((v) => ({
        id: v.id,
        name: v.name,
        vessel_type: v.vessel_type,
        loa_meters: v.loa_meters,
        imo_number: v.imo_number,
      })),
    });
  }

  // Exact search (7 digits): single vessel lookup with the same Wave F
  // filter — but if the only matching row is THIS user's own pending
  // submission, return it so they can attach it to follow-on flows.
  const { data: vessels, error } = await serviceClient
    .from('vessels')
    .select(
      'id, name, vessel_type, size_band_id, loa_meters, source, hidden_at, owner_person_id, vessel_size_bands(label)',
    )
    .eq('imo_number', imoClean);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const candidates = (vessels ?? []) as unknown as Array<{
    id: string;
    name: string;
    vessel_type: string;
    size_band_id: string | null;
    loa_meters: number | null;
    source: string;
    hidden_at: string | null;
    owner_person_id: string;
    vessel_size_bands: { label: string } | null;
  }>;
  const vessel =
    candidates.find(
      (v) =>
        !v.hidden_at &&
        (v.source === 'curated' || v.source === 'user_submitted' || v.owner_person_id === user.id),
    ) ?? null;

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
