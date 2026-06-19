import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

interface PatchBody {
  name?: string;
  vessel_type?: 'motor' | 'sail';
  loa_meters?: number;
  flag_state_id?: string | null;
  year_built?: number | null;
  builder?: string | null;
  gross_tonnage?: number | null;
  beam_meters?: number | null;
  nda_flag?: boolean;
}

const VALID_VESSEL_TYPES = ['motor', 'sail'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/vessels/[id]
 *
 * Mistake-recovery edit for vessels that are already past the
 * pending-curation queue (source='curated' or 'user_submitted'). Mirrors
 * the field set + validation rules of the pending-approve action so an
 * admin who typo'd during approve can fix it without touching SQL.
 *
 * Refuses pending vessels — those should go through
 * `/api/admin/vessels/pending/[id]` so the source flip is part of the
 * single transaction.
 *
 * Direct-update pattern, same as approve and the locations queue.
 * Per "they sit in the db but not projected for now": no
 * VESSEL.METADATA_UPDATED / VESSEL.RENAMED / VESSEL.REFLAGGED events
 * fire here. The values land on the vessels columns and the
 * vessel_names timeline name (when name changes) is rewritten in place.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid vessel id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await serviceClient
    .from('vessels')
    .select('id, source, name')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
  }
  if (existing.source === 'pending') {
    return NextResponse.json(
      {
        error:
          'Pending vessels must go through the pending-vessels Approve action — use that route instead.',
      },
      { status: 409 },
    );
  }

  const updates: Record<string, unknown> = {};

  const newName =
    typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : null;
  if (newName && newName !== existing.name) {
    updates.name = newName;
  }

  if (body.vessel_type !== undefined) {
    if (!VALID_VESSEL_TYPES.includes(body.vessel_type)) {
      return NextResponse.json({ error: 'vessel_type must be motor or sail' }, { status: 400 });
    }
    updates.vessel_type = body.vessel_type;
  }

  if (body.loa_meters !== undefined) {
    const loa = Number(body.loa_meters);
    if (!Number.isFinite(loa) || loa <= 0) {
      return NextResponse.json({ error: 'loa_meters must be a positive number' }, { status: 400 });
    }
    updates.loa_meters = loa;
    const { data: bands } = await serviceClient
      .from('vessel_size_bands')
      .select('id, min_meters, max_meters')
      .order('min_meters');
    const band = (bands ?? []).find(
      (b) =>
        loa >= (b.min_meters as number) &&
        (b.max_meters === null || loa < (b.max_meters as number)),
    );
    if (!band) {
      return NextResponse.json(
        { error: `LOA ${loa}m does not match any size band` },
        { status: 400 },
      );
    }
    updates.size_band_id = band.id;
  }

  if (body.flag_state_id !== undefined) {
    if (body.flag_state_id !== null && !UUID_RE.test(body.flag_state_id)) {
      return NextResponse.json({ error: 'Invalid flag_state_id' }, { status: 400 });
    }
    updates.flag_state_id = body.flag_state_id;
  }

  if (body.year_built !== undefined) {
    if (body.year_built !== null) {
      const year = Number(body.year_built);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
        return NextResponse.json(
          { error: `year_built must be an integer between 1900 and ${currentYear}` },
          { status: 400 },
        );
      }
      updates.year_built = year;
    } else {
      updates.year_built = null;
    }
  }

  if (body.builder !== undefined) {
    updates.builder =
      typeof body.builder === 'string' && body.builder.trim().length > 0
        ? body.builder.trim()
        : null;
  }

  if (body.gross_tonnage !== undefined) {
    if (body.gross_tonnage !== null) {
      const gt = Number(body.gross_tonnage);
      if (!Number.isFinite(gt) || gt <= 0) {
        return NextResponse.json(
          { error: 'gross_tonnage must be a positive number' },
          { status: 400 },
        );
      }
      updates.gross_tonnage = gt;
    } else {
      updates.gross_tonnage = null;
    }
  }

  if (body.beam_meters !== undefined) {
    if (body.beam_meters !== null) {
      const beam = Number(body.beam_meters);
      if (!Number.isFinite(beam) || beam <= 0) {
        return NextResponse.json(
          { error: 'beam_meters must be a positive number' },
          { status: 400 },
        );
      }
      updates.beam_meters = beam;
    } else {
      updates.beam_meters = null;
    }
  }

  if (body.nda_flag !== undefined) {
    updates.nda_flag = body.nda_flag === true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const { error: vEr } = await serviceClient.from('vessels').update(updates).eq('id', id);
    if (vEr) return NextResponse.json({ error: vEr.message }, { status: 500 });

    // Mirror name change to the open-ended vessel_names row so the
    // timeline-table denormalisation stays consistent.
    if (newName) {
      const { error: vnEr } = await serviceClient
        .from('vessel_names')
        .update({ name: newName })
        .eq('vessel_id', id)
        .is('effective_to', null);
      if (vnEr) return NextResponse.json({ error: vnEr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
