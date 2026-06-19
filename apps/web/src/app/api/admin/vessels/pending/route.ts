import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export interface PendingVessel {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  flag_state_id: string | null;
  flag_state_name: string | null;
  gross_tonnage: number | null;
  beam_meters: number | null;
  year_built: number | null;
  builder: string | null;
  nda_flag: boolean;
  size_band_label: string | null;
  created_at: string;
  submitted_by: string | null;
  submitter_name: string | null;
}

interface RawVessel {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  flag_state_id: string | null;
  gross_tonnage: number | null;
  beam_meters: number | null;
  year_built: number | null;
  builder: string | null;
  nda_flag: boolean;
  created_at: string;
  submitted_by: string | null;
  vessel_size_bands: { label: string } | null;
  flag_states: { name: string } | null;
}

/**
 * GET /api/admin/vessels/pending
 *
 * Returns every `source='pending'` vessel that hasn't been hidden,
 * with its size-band label, flag-state name, submitter display name,
 * and all admin-enrichment columns. Backs the
 * `/admin/vessels/pending` queue page.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;

  try {
    const { data, error } = await serviceClient
      .from('vessels')
      .select(
        'id, imo_number, name, vessel_type, loa_meters, flag_state_id, gross_tonnage, beam_meters, year_built, builder, nda_flag, created_at, submitted_by, vessel_size_bands(label), flag_states:flag_state_id(name)',
      )
      .eq('source', 'pending')
      .is('hidden_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as RawVessel[];
    const submitterIds = Array.from(
      new Set(rows.map((r) => r.submitted_by).filter((id): id is string => !!id)),
    );

    const nameById = new Map<string, string>();
    if (submitterIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('person_id, display_name')
        .in('person_id', submitterIds);
      for (const p of profiles ?? []) {
        const personId = (p as { person_id?: string }).person_id;
        const displayName = (p as { display_name?: string | null }).display_name;
        if (personId && displayName) {
          nameById.set(personId, displayName);
        }
      }
    }

    const vessels: PendingVessel[] = rows.map((v) => ({
      id: v.id,
      imo_number: v.imo_number,
      name: v.name,
      vessel_type: v.vessel_type,
      loa_meters: v.loa_meters,
      flag_state_id: v.flag_state_id,
      flag_state_name: v.flag_states?.name ?? null,
      gross_tonnage: v.gross_tonnage,
      beam_meters: v.beam_meters,
      year_built: v.year_built,
      builder: v.builder,
      nda_flag: v.nda_flag,
      size_band_label: v.vessel_size_bands?.label ?? null,
      created_at: v.created_at,
      submitted_by: v.submitted_by,
      submitter_name: v.submitted_by ? (nameById.get(v.submitted_by) ?? null) : null,
    }));

    return NextResponse.json({ vessels });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pending vessels lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
