import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { appendEvent } from '@dockwalker/db';

/**
 * GET /api/cron/data-scrub
 * Vercel Cron — runs daily at 04:00 UTC (avoids the 05:00 / 07:00 / 08:00
 * existing crons).
 *
 * GDPR Article 17 enforcement (S-2). The deactivation flow at
 * `/api/account/deactivate` appends PERSON.DEACTIVATED + sets
 * `deactivated_at` + bans the auth user. The follow-up
 * PERSON.DATA_SCRUBBED event (which the projection in 00108 uses to
 * null 22 profile PII fields, set persons.current_hat to null, and
 * delete crew_experiences + shore_experiences) was previously a manual
 * admin process — easy to slip past the documented 30-day retention
 * window. This cron automates the trailing-edge wipe.
 *
 * Logic per run:
 *   1. Find persons with `deactivated_at <= now() - 30 days` AND
 *      `deactivated_at IS NOT NULL` (reactivated users naturally
 *      excluded — REACTIVATED nulls deactivated_at).
 *   2. Filter out persons who already have a PERSON.DATA_SCRUBBED
 *      event in the ledger.
 *   3. For each remaining person: append PERSON.DATA_SCRUBBED with a
 *      deterministic idempotency key. The projection wipes the row.
 *
 * Auth: CRON_SECRET bearer token (matches the other crons).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let scrubbed = 0;
  const failures: { personId: string; error: string }[] = [];

  try {
    // 1. Candidates: deactivated 30+ days ago, not yet reactivated.
    const { data: candidates, error: candErr } = await serviceClient
      .from('persons')
      .select('id, deactivated_at')
      .lt('deactivated_at', cutoff)
      .not('deactivated_at', 'is', null);
    if (candErr) {
      return NextResponse.json({ error: candErr.message }, { status: 500 });
    }
    const candidateIds = (candidates ?? []).map((p) => p.id as string);
    if (candidateIds.length === 0) {
      return NextResponse.json({ scrubbed: 0, eligible: 0 });
    }

    // 2. Filter out already-scrubbed via the event ledger.
    const { data: scrubbedEvents, error: evErr } = await serviceClient
      .from('events')
      .select('aggregate_id')
      .eq('event_type', 'PERSON.DATA_SCRUBBED')
      .in('aggregate_id', candidateIds);
    if (evErr) {
      return NextResponse.json({ error: evErr.message }, { status: 500 });
    }
    const alreadyScrubbed = new Set((scrubbedEvents ?? []).map((e) => e.aggregate_id as string));
    const toScrub = candidateIds.filter((id) => !alreadyScrubbed.has(id));

    // 3. Append PERSON.DATA_SCRUBBED for each. Per-person try/catch so
    // a single failure (e.g. a rare projection-handler exception) doesn't
    // abort the whole run.
    for (const personId of toScrub) {
      try {
        await appendEvent(serviceClient, {
          eventType: 'PERSON.DATA_SCRUBBED',
          aggregateId: personId,
          aggregateType: 'person',
          // Subject acts on themselves — matches the existing admin
          // DELETE pattern at /api/admin/users/[personId]. roleContext
          // is irrelevant for the projection but the column is non-null.
          roleContext: 'crew',
          payload: {},
          personId,
          // D-1 idempotency: deterministic key prevents duplicate event
          // rows if Vercel retries the cron within the 5-minute window.
          idempotencyKey: `PERSON.DATA_SCRUBBED:auto:${personId}`,
        });
        scrubbed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        failures.push({ personId, error: message });
      }
    }

    return NextResponse.json({
      scrubbed,
      eligible: toScrub.length,
      candidates: candidateIds.length,
      ...(failures.length > 0 ? { failures } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
