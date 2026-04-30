import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth/require-auth-session';
import { getVesselPrefixLimit } from '@/lib/rate-limit';

interface PublicVesselRow {
  id: string;
  imo_number: string | null;
  name: string;
  vessel_type: string;
  size_band_id: string | null;
  size_band_label: string | null;
  loa_meters: number | null;
  nda_flag: boolean;
  owner_person_id: string;
}

/**
 * GET /api/vessels/lookup?imo=1234567
 * Looks up vessels by IMO number prefix.
 * - 4-6 digits: partial prefix search, returns up to 5 results
 * - 7 digits: exact match, returns single vessel with found: true/false
 * Any authenticated user can look up vessels (for experience entry).
 * Onboarding-friendly: pre-onboarding users hit this from the
 * vessel-experience step.
 *
 * Two-step pattern (S-1 audit, 2026-04-28):
 *   1. service-role IMO scan returns candidate IDs only (no NDA-sensitive
 *      data leaves SQL).
 *   2. user-authenticated `get_vessels_public_batch(uuid[])` RPC returns
 *      masked detail rows — NDA name → 'NDA Vessel' + IMO → null for
 *      callers who are neither owner nor actively engaged on the vessel,
 *      and pending/hidden rows filtered out (except for the submitting
 *      owner). `auth.uid()` must resolve correctly so we use the
 *      user-bound `supabase` client for step 2, not service-role.
 */
export async function GET(request: Request) {
  const guard = await requireAuthSession();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

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

  // Per-user rate limit on partial-prefix branch (audit P1-S7). The
  // exact-IMO branch (7-digit) doesn't enumerate, so we don't bother
  // limiting it. Keyed on user id so a captain on the same WAN as their
  // crew doesn't cap out from shared usage.
  if (imoClean.length < 7) {
    const limiter = getVesselPrefixLimit();
    if (limiter) {
      const { success, remaining, reset } = await limiter.limit(`user:${user.id}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many partial searches. Try the full 7-digit IMO or wait.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(remaining),
            },
          },
        );
      }
    }
  }

  // Step 1 — IDs by IMO match. Service-role to bypass RLS so we don't
  // miss the caller's own pending vessel (RLS would filter that out
  // before the RPC's owner-branch can re-include it).
  const idQuery = serviceClient.from('vessels').select('id, imo_number');
  const { data: candidates, error: idError } =
    imoClean.length < 7
      ? await idQuery.ilike('imo_number', `${imoClean}%`).limit(50)
      : await idQuery.eq('imo_number', imoClean);
  if (idError) {
    return NextResponse.json({ error: idError.message }, { status: 500 });
  }
  const candidateIds = (candidates ?? []).map((v) => v.id as string);
  if (candidateIds.length === 0) {
    return imoClean.length < 7
      ? NextResponse.json({ results: [] })
      : NextResponse.json({ found: false });
  }

  // Step 2 — masked details via the RPC. Visibility filter (pending
  // hidden) + NDA name+IMO mask all happen server-side using auth.uid().
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_vessels_public_batch', {
    p_vessel_ids: candidateIds,
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }
  const visible = (rpcRows ?? []) as PublicVesselRow[];

  // Partial search — return up to 5 visible results. IMO stripped from
  // the partial branch (audit P1-S7) so the response only confirms
  // vessel existence by id+name; the caller types the remaining digits
  // to disambiguate. Exact search (below) returns full IMO since the
  // caller already provided it.
  if (imoClean.length < 7) {
    return NextResponse.json({
      results: visible.slice(0, 5).map((v) => ({
        id: v.id,
        name: v.name,
        vessel_type: v.vessel_type,
        loa_meters: v.loa_meters,
      })),
    });
  }

  // Exact search — one row expected
  const vessel = visible[0];
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
      size_band_label: vessel.size_band_label,
    },
  });
}
