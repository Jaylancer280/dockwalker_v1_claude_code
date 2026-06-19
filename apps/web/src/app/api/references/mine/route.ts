import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

interface ReferenceRow {
  id: string;
  experience_id: string | null;
  vessel_id: string | null;
  status: string;
  claimed_referee_role: string;
  claimed_referee_name: string;
  claimed_referee_email: string | null;
  token: string;
  comment: string | null;
  comment_updated_at: string | null;
  consented_at: string | null;
  responded_at: string | null;
  expires_at: string;
  pending_expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  snapshot_vessel_imo: string;
  snapshot_vessel_name: string;
  snapshot_start_date: string;
  snapshot_end_date: string | null;
  requester_person_id: string;
  referee_person_id: string | null;
  created_at: string;
}

const REF_COLUMNS = [
  'id',
  'experience_id',
  'vessel_id',
  'status',
  'claimed_referee_role',
  'claimed_referee_name',
  'claimed_referee_email',
  'token',
  'comment',
  'comment_updated_at',
  'consented_at',
  'responded_at',
  'expires_at',
  'pending_expires_at',
  'revoked_at',
  'revoke_reason',
  'snapshot_vessel_imo',
  'snapshot_vessel_name',
  'snapshot_start_date',
  'snapshot_end_date',
  'requester_person_id',
  'referee_person_id',
  'created_at',
  'include_on_cv',
].join(',');

/**
 * GET /api/references/mine
 *
 * Returns three buckets:
 *   - `outbound` — caller is requester. Includes all statuses; UI splits into
 *     pending / accepted / expired / revoked / declined sub-lists.
 *   - `inbound_accepted` — caller is referee with status='accepted'. Powers
 *     the Settings → References inbound list (edit comment, revoke consent).
 *   - `inbound_pending` — caller is referee with status='pending'. Powers
 *     the consent pseudo-thread in `/messages`.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, serviceClient } = guard.value;

    const [{ data: outbound }, { data: inboundAccepted }, { data: inboundPending }] =
      await Promise.all([
        serviceClient
          .from('references')
          .select(REF_COLUMNS)
          .eq('requester_person_id', user.id)
          .order('created_at', { ascending: false })
          .returns<ReferenceRow[]>(),
        serviceClient
          .from('references')
          .select(REF_COLUMNS)
          .eq('referee_person_id', user.id)
          .eq('status', 'accepted')
          .order('consented_at', { ascending: false })
          .returns<ReferenceRow[]>(),
        serviceClient
          .from('references')
          .select(REF_COLUMNS)
          .eq('referee_person_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .returns<ReferenceRow[]>(),
      ]);

    return NextResponse.json({
      outbound: outbound ?? [],
      inbound_accepted: inboundAccepted ?? [],
      inbound_pending: inboundPending ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
