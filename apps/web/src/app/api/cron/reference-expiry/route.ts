import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appendEvent } from '@dockwalker/db';

/**
 * GET /api/cron/reference-expiry
 * Vercel Cron — runs daily at 05:00 UTC.
 *
 * Two queries fire REFERENCE.EXPIRED:
 *   (a) accepted-consent expiry — references with status='accepted' AND
 *       expires_at < now() (the 24-month default).
 *   (b) pending-invitation expiry — status='pending' AND
 *       pending_expires_at < now() (the 30-day default).
 *
 * Each path fires REFERENCE.EXPIRED. The projection (00126) handles both
 * paths in a single handler run with distinct revoke_reason stamps; idempotent
 * via WHERE-clause guards on status. We fire one event PER affected row so
 * each gets its own audit entry rather than a single bulk event.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sc = await createServiceClient();
    const nowIso = new Date().toISOString();

    const { data: acceptedRows } = await sc
      .from('references')
      .select('id, requester_person_id')
      .eq('status', 'accepted')
      .lt('expires_at', nowIso);

    const { data: pendingRows } = await sc
      .from('references')
      .select('id, requester_person_id')
      .eq('status', 'pending')
      .lt('pending_expires_at', nowIso);

    let expiredAccepted = 0;
    let expiredPending = 0;

    for (const r of acceptedRows ?? []) {
      try {
        await appendEvent(sc, {
          eventType: 'REFERENCE.EXPIRED',
          aggregateId: r.id as string,
          aggregateType: 'reference',
          roleContext: 'crew',
          payload: {},
          personId: r.requester_person_id as string,
        });
        expiredAccepted++;
      } catch {
        // Continue past per-row errors so a single bad row doesn't poison the whole run.
      }
    }
    for (const r of pendingRows ?? []) {
      try {
        await appendEvent(sc, {
          eventType: 'REFERENCE.EXPIRED',
          aggregateId: r.id as string,
          aggregateType: 'reference',
          roleContext: 'crew',
          payload: {},
          personId: r.requester_person_id as string,
        });
        expiredPending++;
      } catch {
        // Continue past per-row errors.
      }
    }

    return NextResponse.json({ expiredAccepted, expiredPending });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
