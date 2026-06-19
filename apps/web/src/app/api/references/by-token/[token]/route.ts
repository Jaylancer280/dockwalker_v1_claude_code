import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { maskEmail } from '@/lib/references/helpers';

/**
 * GET /api/references/by-token/[token]
 *
 * Public read — no auth required. Returns the snapshot summary for the
 * `/ref/[token]` consent landing page so the would-be referee can verify
 * the request before signing in. Refuses if status is not pending or the
 * pending_expires_at has passed. Email is masked (e.g. `c***n@example.com`).
 * Never returns full PII beyond the requester's display name.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    const sc = await createServiceClient();
    const { data: ref } = await sc
      .from('references')
      .select(
        [
          'id',
          'requester_person_id',
          'status',
          'pending_expires_at',
          'requester_role_at_time',
          'claimed_referee_role',
          'claimed_referee_email',
          'snapshot_vessel_imo',
          'snapshot_vessel_name',
          'snapshot_start_date',
          'snapshot_end_date',
        ].join(','),
      )
      .eq('token', token)
      .maybeSingle<{
        id: string;
        requester_person_id: string;
        status: string;
        pending_expires_at: string;
        requester_role_at_time: string;
        claimed_referee_role: string;
        claimed_referee_email: string | null;
        snapshot_vessel_imo: string;
        snapshot_vessel_name: string;
        snapshot_start_date: string;
        snapshot_end_date: string | null;
      }>();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if (ref.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invitation is no longer pending', status: ref.status },
        { status: 410 },
      );
    }
    if (new Date(ref.pending_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }
    const { data: requester } = await sc
      .from('profiles')
      .select('display_name')
      .eq('person_id', ref.requester_person_id)
      .maybeSingle();
    return NextResponse.json({
      id: ref.id,
      requester_display_name: (requester?.display_name as string | undefined) ?? 'A crew member',
      requester_role_at_time: ref.requester_role_at_time,
      claimed_referee_role: ref.claimed_referee_role,
      claimed_referee_email_masked: ref.claimed_referee_email
        ? maskEmail(ref.claimed_referee_email)
        : null,
      claimed_referee_email_required: ref.claimed_referee_email !== null,
      snapshot_vessel_imo: ref.snapshot_vessel_imo,
      snapshot_vessel_name: ref.snapshot_vessel_name,
      snapshot_start_date: ref.snapshot_start_date,
      snapshot_end_date: ref.snapshot_end_date,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
