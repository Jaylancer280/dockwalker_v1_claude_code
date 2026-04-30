import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { getQrHireLimit } from '@/lib/rate-limit';
import { CV_BUILDER_ENABLED, CV_BUILDER_LOCKED_PAYLOAD } from '@/lib/cv/feature-flag';
import { randomUUID } from 'crypto';

/**
 * POST /api/permanent/[id]/invite
 *
 * Captain/agent invites a specific crew member to apply to a permanent
 * posting (spec §6 hire-from-QR). Spec v2.1 deferred "select existing
 * posting" to v2; for now the wizard creates a fresh posting then calls
 * this route with the new posting id.
 *
 * Body: { crewPersonId: string, message?: string (≤500 chars) }
 *
 * Auth: employer or agent hat. Caller must be the posting's
 *       `employer_person_id`. (Permanent_postings has no agent column —
 *       agents post via employer_person_id, same as everywhere else.)
 *
 * Rate limit: 5/hour per employer (shared bucket with daywork QR-hire
 * via getQrHireLimit).
 *
 * Idempotency: D-1 idempotency key (`PERMANENT.INVITED:${postingId}:${crewPersonId}`)
 * makes network retries silent — the append_event RPC dedupes via the
 * partial unique index on (person_id, idempotency_key) and returns the
 * original event_id without re-running the projection. After
 * appendEvent we look up the actual row to return the canonical
 * invitation_id (the locally-generated UUID is discarded on a deduped
 * call). Re-invitation of the same crew on the same posting therefore
 * resolves to a 201 with the original invitation_id (no extra
 * notification fires because the projection didn't run).
 *
 * Fires: PERMANENT.INVITED. The push-trigger handler fans out the
 * notification to the invited crew with a deep link to
 * /permanent/[id]/apply?from_invitation={invitation_id}.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!CV_BUILDER_ENABLED) {
    return NextResponse.json(CV_BUILDER_LOCKED_PAYLOAD, { status: 503 });
  }

  const { id: postingId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json(
      { error: 'Only employers and agents can invite crew' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { crewPersonId, message } = body;

    if (typeof crewPersonId !== 'string' || !crewPersonId) {
      return NextResponse.json({ error: 'crewPersonId is required' }, { status: 400 });
    }
    if (
      message !== undefined &&
      message !== null &&
      (typeof message !== 'string' || message.length > 500)
    ) {
      return NextResponse.json(
        { error: 'message must be a string of 500 characters or fewer' },
        { status: 400 },
      );
    }

    // Validate posting exists, is owned by caller, and is in a state that
    // can accept new applications. `in_negotiation` postings have a
    // selected applicant — inviting more crew is pointless and confusing,
    // so we block it here.
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, status, employer_person_id, role_id, vessel_id')
      .eq('id', postingId)
      .single();

    if (!posting) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Not your posting' }, { status: 403 });
    }
    if (posting.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot invite on a posting in '${posting.status}' status` },
        { status: 400 },
      );
    }

    // Validate crew person exists + is active
    const { data: targetPerson } = await serviceClient
      .from('persons')
      .select('id, identity_type, deactivated_at, blocked_at')
      .eq('id', crewPersonId)
      .single();

    if (!targetPerson || targetPerson.identity_type !== 'crew') {
      return NextResponse.json({ error: 'Target crew not found' }, { status: 404 });
    }
    if (targetPerson.deactivated_at || targetPerson.blocked_at) {
      return NextResponse.json(
        { error: 'Crew is no longer active on DockWalker' },
        { status: 400 },
      );
    }

    // 5/hour per employer rate limit (spec §6 abuse mitigation).
    const limiter = getQrHireLimit();
    if (limiter) {
      const { success, remaining, reset } = await limiter.limit(`employer:${user.id}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Hire limit reached. Try again in an hour.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(remaining),
            },
          },
        );
      }
    }

    const newInvitationId = randomUUID();
    const idempotencyKey = `PERMANENT.INVITED:${postingId}:${crewPersonId}`;

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.INVITED',
      aggregateId: newInvitationId,
      aggregateType: 'permanent_invitation',
      roleContext: person.current_hat,
      payload: {
        id: newInvitationId,
        permanent_posting_id: postingId,
        crew_person_id: crewPersonId,
        ...(typeof message === 'string' && message.length > 0 ? { message } : {}),
      },
      personId: user.id,
      idempotencyKey,
    });

    // Look up the canonical invitation row. On first call this equals
    // newInvitationId. On idempotent retry (same key) the append_event
    // RPC silently returned the original event_id without re-running
    // the projection — the row was inserted by the original call, so
    // its id is what we return to the client.
    const { data: invitation } = await serviceClient
      .from('permanent_invitations')
      .select('id')
      .eq('permanent_posting_id', postingId)
      .eq('crew_person_id', crewPersonId)
      .single();

    const invitationId = invitation?.id ?? newInvitationId;

    notifyOnEvent(
      serviceClient,
      'PERMANENT.INVITED',
      {
        id: invitationId,
        permanent_posting_id: postingId,
        crew_person_id: crewPersonId,
      },
      user.id,
    );

    return NextResponse.json({ invitation: { id: invitationId } }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to invite crew';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
