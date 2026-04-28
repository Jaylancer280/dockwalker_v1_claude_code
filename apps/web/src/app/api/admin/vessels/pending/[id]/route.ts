import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

interface ActionBody {
  action?: 'approve' | 'merge' | 'hide';
  mergeToId?: string;
  /** All fields below are optional admin-curation overrides on Approve.
   *  User submission only requires name + IMO + vessel_type + LOA; the
   *  admin enriches the rest from Equasis / MarineTraffic before
   *  promoting to canonical.
   *
   *  Direct-update pattern (no event ledger churn) — same approach
   *  used for the source flip and the locations-pending approve.
   *  Per the project's curation discipline, admin moderation is a
   *  privileged path that bypasses VESSEL.METADATA_UPDATED events;
   *  the values are stored on `vessels` columns and do not yet
   *  flow through `vessel_flag_states` history rows.
   */
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
 * POST /api/admin/vessels/pending/:id
 *
 * Three actions for the admin curation queue:
 *
 *   - approve: flips `source` from 'pending' → 'curated' on the vessel
 *     itself AND every still-pending row in `vessel_names` /
 *     `vessel_flag_states`. Optional `name` field rewrites the vessel
 *     name + the seeded vessel_names row in the same transaction. The
 *     submitter's UUID + every FK pointing at this vessel keep working.
 *
 *   - merge: re-points every FK referencing the pending vessel
 *     (`crew_experiences.vessel_id`, `dayworks.vessel_id`,
 *     `permanent_postings.vessel_id`) to `mergeToId`, then deletes the
 *     pending row. CASCADE on the `vessel_names` / `vessel_flag_states`
 *     `vessel_id` FKs sweeps the history. The merge target must be
 *     `source IN ('curated', 'user_submitted')` — admins can't merge
 *     into another pending row.
 *
 *   - hide: stamps `vessels.hidden_at = now()`. The submitter's existing
 *     FK (their experience entry / their daywork posting) keeps
 *     resolving the row, but Wave F's `get_vessel_public` filter
 *     (`hidden_at IS NULL`) will exclude it from everyone else's
 *     lookup / display.
 *
 * All three require the vessel to currently be `source='pending'` to
 * prevent admins from accidentally mutating already-curated rows.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid vessel id' }, { status: 400 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'approve' && action !== 'merge' && action !== 'hide') {
    return NextResponse.json(
      { error: 'action must be one of: approve, merge, hide' },
      { status: 400 },
    );
  }

  const { data: pending, error: lookupError } = await serviceClient
    .from('vessels')
    .select('id, source, name')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!pending) {
    return NextResponse.json({ error: 'Vessel not found' }, { status: 404 });
  }
  if (pending.source !== 'pending') {
    return NextResponse.json({ error: 'Only pending vessels can be acted on' }, { status: 409 });
  }

  try {
    if (action === 'approve') {
      const newName =
        typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : null;

      // 1. Build the vessel UPDATE — source flip is mandatory; every
      //    other column is an optional admin override.
      const vesselUpdates: Record<string, unknown> = { source: 'curated' };
      if (newName) vesselUpdates.name = newName;

      if (body.vessel_type !== undefined) {
        if (!VALID_VESSEL_TYPES.includes(body.vessel_type)) {
          return NextResponse.json({ error: 'vessel_type must be motor or sail' }, { status: 400 });
        }
        vesselUpdates.vessel_type = body.vessel_type;
      }

      // LOA change auto-derives the size band so the displayed range
      // stays in sync. Admin can change LOA without thinking about
      // bands.
      if (body.loa_meters !== undefined) {
        const loa = Number(body.loa_meters);
        if (!Number.isFinite(loa) || loa <= 0) {
          return NextResponse.json(
            { error: 'loa_meters must be a positive number' },
            { status: 400 },
          );
        }
        vesselUpdates.loa_meters = loa;
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
        vesselUpdates.size_band_id = band.id;
      }

      if (body.flag_state_id !== undefined) {
        if (body.flag_state_id !== null && !UUID_RE.test(body.flag_state_id)) {
          return NextResponse.json({ error: 'Invalid flag_state_id' }, { status: 400 });
        }
        vesselUpdates.flag_state_id = body.flag_state_id;
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
          vesselUpdates.year_built = year;
        } else {
          vesselUpdates.year_built = null;
        }
      }

      if (body.builder !== undefined) {
        vesselUpdates.builder =
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
          vesselUpdates.gross_tonnage = gt;
        } else {
          vesselUpdates.gross_tonnage = null;
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
          vesselUpdates.beam_meters = beam;
        } else {
          vesselUpdates.beam_meters = null;
        }
      }

      if (body.nda_flag !== undefined) {
        vesselUpdates.nda_flag = body.nda_flag === true;
      }

      const { error: vEr } = await serviceClient.from('vessels').update(vesselUpdates).eq('id', id);
      if (vEr) return NextResponse.json({ error: vEr.message }, { status: 500 });

      // 2. Promote every still-pending vessel_names row, mirroring any
      //    name change so the timeline stays consistent.
      const nameUpdates: Record<string, unknown> = { source: 'curated' };
      if (newName) nameUpdates.name = newName;
      const { error: vnEr } = await serviceClient
        .from('vessel_names')
        .update(nameUpdates)
        .eq('vessel_id', id)
        .eq('source', 'pending');
      if (vnEr) return NextResponse.json({ error: vnEr.message }, { status: 500 });

      // 3. Promote any pending flag-state rows the submitter seeded.
      //    Note: we do NOT insert a new vessel_flag_states row when the
      //    admin SETS a flag for the first time during approve — that
      //    timeline-tracking belongs to a future VESSEL.REFLAGGED flow.
      //    Per "they sit in the db but not projected for now": the flag
      //    lives on the vessels column directly.
      const { error: vfEr } = await serviceClient
        .from('vessel_flag_states')
        .update({ source: 'curated' })
        .eq('vessel_id', id)
        .eq('source', 'pending');
      if (vfEr) return NextResponse.json({ error: vfEr.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    if (action === 'hide') {
      const { error } = await serviceClient
        .from('vessels')
        .update({ hidden_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // action === 'merge'
    const mergeToId = body.mergeToId;
    if (!mergeToId || !UUID_RE.test(mergeToId)) {
      return NextResponse.json({ error: 'mergeToId is required for merge' }, { status: 400 });
    }
    if (mergeToId === id) {
      return NextResponse.json({ error: 'Cannot merge a vessel into itself' }, { status: 400 });
    }

    const { data: target, error: tEr } = await serviceClient
      .from('vessels')
      .select('id, source')
      .eq('id', mergeToId)
      .maybeSingle();
    if (tEr) return NextResponse.json({ error: tEr.message }, { status: 500 });
    if (!target) {
      return NextResponse.json({ error: 'Merge target not found' }, { status: 404 });
    }
    if (target.source !== 'curated' && target.source !== 'user_submitted') {
      return NextResponse.json(
        { error: 'Merge target must be a curated or user-submitted vessel' },
        { status: 400 },
      );
    }

    // Re-point every FK referencing the pending vessel. Order is dependency-
    // safe — there are no inter-table dependencies among these three tables
    // that would fail mid-ripple.
    const ripple = [
      { table: 'crew_experiences', column: 'vessel_id' },
      { table: 'dayworks', column: 'vessel_id' },
      { table: 'permanent_postings', column: 'vessel_id' },
    ] as const;

    for (const { table, column } of ripple) {
      const { error } = await serviceClient
        .from(table)
        .update({ [column]: mergeToId })
        .eq(column, id);
      if (error) {
        return NextResponse.json(
          { error: `Failed to re-point ${table}.${column}: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // CASCADE on vessel_id FK sweeps vessel_names + vessel_flag_states.
    const { error: dEr } = await serviceClient.from('vessels').delete().eq('id', id);
    if (dEr) {
      return NextResponse.json({ error: dEr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mergedInto: mergeToId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
