import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

interface ActionBody {
  action?: 'approve' | 'merge' | 'hide';
  mergeToId?: string;
  name?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/locations/pending/ports/:id
 *
 * Three actions for the admin curation queue:
 *   - approve: flip source 'pending' → 'curated' on the port. Optional
 *     `name` field lets the admin fix typos in the same call.
 *   - merge: re-point every FK referencing the pending port
 *     (`profiles.location_port_id`, `dayworks.location_port_id`,
 *     `daywork_templates.location_port_id`,
 *     `availability_windows.port_id`, `permanent_postings.port_id`,
 *     `permanent_templates.port_id`) to `mergeToId`, then delete the
 *     pending row. The canonical row must be `source IN ('curated',
 *     'osm')`.
 *   - hide: stamp `hidden_at = now()` so the row stays resolvable for
 *     the submitting user's existing FK but is invisible to all
 *     searches and to the pending queue.
 *
 * All three require the port to currently be `source='pending'` to
 * prevent admins from accidentally mutating curated rows.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid port id' }, { status: 400 });
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
    .from('ports')
    .select('id, source, name')
    .eq('id', id)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!pending) {
    return NextResponse.json({ error: 'Port not found' }, { status: 404 });
  }
  if (pending.source !== 'pending') {
    return NextResponse.json({ error: 'Only pending ports can be acted on' }, { status: 409 });
  }

  try {
    if (action === 'approve') {
      const updates: Record<string, unknown> = { source: 'curated' };
      if (typeof body.name === 'string' && body.name.trim().length > 0) {
        updates.name = body.name.trim();
      }
      const { error } = await serviceClient.from('ports').update(updates).eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'hide') {
      const { error } = await serviceClient
        .from('ports')
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
      return NextResponse.json({ error: 'Cannot merge a port into itself' }, { status: 400 });
    }

    const { data: target, error: targetLookupError } = await serviceClient
      .from('ports')
      .select('id, source')
      .eq('id', mergeToId)
      .maybeSingle();
    if (targetLookupError) {
      return NextResponse.json({ error: targetLookupError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: 'Merge target not found' }, { status: 404 });
    }
    if (target.source !== 'curated' && target.source !== 'osm') {
      return NextResponse.json(
        { error: 'Merge target must be a curated or OSM port' },
        { status: 400 },
      );
    }

    const ripple = [
      { table: 'profiles', column: 'location_port_id' },
      { table: 'dayworks', column: 'location_port_id' },
      { table: 'daywork_templates', column: 'location_port_id' },
      { table: 'availability_windows', column: 'port_id' },
      { table: 'permanent_postings', column: 'port_id' },
      { table: 'permanent_templates', column: 'port_id' },
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

    const { error: deleteError } = await serviceClient.from('ports').delete().eq('id', id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mergedInto: mergeToId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
