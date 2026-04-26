import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

interface ActionBody {
  action?: 'approve' | 'merge' | 'hide';
  mergeToId?: string;
  /** Optional name override on Approve — admin can fix typos / casing
   *  in the same call. Updates `vessels.name` AND every existing
   *  `vessel_names` row whose source is still `'pending'`. */
  name?: string;
}

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

      // 1. Flip the vessel's source + optionally rewrite name.
      const vesselUpdates: Record<string, unknown> = { source: 'curated' };
      if (newName) vesselUpdates.name = newName;
      const { error: vEr } = await serviceClient.from('vessels').update(vesselUpdates).eq('id', id);
      if (vEr) return NextResponse.json({ error: vEr.message }, { status: 500 });

      // 2. Promote every still-pending vessel_names row.
      const nameUpdates: Record<string, unknown> = { source: 'curated' };
      if (newName) nameUpdates.name = newName;
      const { error: vnEr } = await serviceClient
        .from('vessel_names')
        .update(nameUpdates)
        .eq('vessel_id', id)
        .eq('source', 'pending');
      if (vnEr) return NextResponse.json({ error: vnEr.message }, { status: 500 });

      // 3. Same for any pending flag-state rows the submitter included.
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
