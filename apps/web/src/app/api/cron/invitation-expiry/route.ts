import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/invitation-expiry
 * Vercel Cron — runs daily at 03:00 UTC.
 *
 * Flips `permanent_invitations` rows from 'pending' to 'expired' once
 * they hit the 30-day threshold (spec v2.1). Direct UPDATE rather than
 * an event because:
 *
 *   1. No domain state derives from invitation expiry — the apply
 *      flow already drops mismatched/non-pending invitations silently
 *      (Phase 5a server-side validation), so an expired invitation
 *      simply stops surfacing the apply-after-invite banner.
 *   2. The set-to-expired transition has no projection cascade. There's
 *      no analogue to PERMANENT.APPLIED's race-guarded flip — only the
 *      rows pinned to status='pending' AND created_at past the
 *      threshold will be touched. Concurrent crew apply (which the
 *      Phase 1 PERMANENT.APPLIED handler ALSO guards on
 *      status='pending') wins by transitionally being applied OR
 *      expired, never both.
 *
 * Idempotency: WHERE clause filters by status, so re-running the cron
 * is safe — already-expired rows match neither side and are skipped.
 *
 * Auth: CRON_SECRET bearer token (matches the rest of the cron suite).
 *
 * Powered by `idx_permanent_invitations_pending_expiry` (partial index
 * on `created_at` WHERE status='pending') from migration 00131 — the
 * scan stays fast even at 100k+ permanent invitations.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sc = await createServiceClient();
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sc
      .from('permanent_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', cutoffIso)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const expiredCount = data?.length ?? 0;
    return NextResponse.json({ expired: expiredCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
