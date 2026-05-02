import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import { notifyOnEvent } from '@/lib/push-triggers';
import { randomUUID } from 'crypto';

/**
 * POST /api/permanent/:id/applicants/:crewId/open-chat
 *
 * Employer-initiated optional shortlist chat (B-011). Opens a phase='shortlist'
 * conversation between employer and a shortlisted candidate. The chat lets the
 * employer ask clarifying questions before committing to the higher-stakes
 * SELECT decision.
 *
 * Idempotent on (posting × crew): the projection's
 * `ON CONFLICT (application_id) DO NOTHING` plus the D-1 idempotency key
 * mean repeated clicks resolve to the same engagement.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; crewId: string }> },
) {
  const { id: postingId, crewId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can open chats' }, { status: 403 });
  }

  try {
    const { data: posting } = await supabase
      .from('permanent_postings')
      .select('id, employer_person_id, status')
      .eq('id', postingId)
      .single();

    if (!posting || posting.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Posting not found' }, { status: 404 });
    }
    if (posting.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot open chat when posting is ${posting.status}` },
        { status: 400 },
      );
    }

    const { data: application } = await serviceClient
      .from('applications')
      .select('id, status')
      .eq('crew_person_id', crewId)
      .eq('permanent_posting_id', postingId)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    if (application.status !== 'shortlisted') {
      return NextResponse.json(
        {
          error: `Can only open a chat with a shortlisted candidate (current: ${application.status})`,
        },
        { status: 400 },
      );
    }

    // If a shortlist-phase engagement already exists for this application,
    // short-circuit and return it. Avoids paying the appendEvent round-trip
    // on repeated clicks. The projection's ON CONFLICT clause is the durable
    // guarantee; this is a UX optimisation.
    const { data: existing } = await serviceClient
      .from('active_engagements')
      .select('id')
      .eq('application_id', application.id)
      .in('phase', ['shortlist', 'active'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, engagementId: existing.id });
    }

    const engagementId = randomUUID();

    await appendEvent(serviceClient, {
      eventType: 'PERMANENT.SHORTLIST_CHAT_OPENED',
      aggregateId: engagementId,
      aggregateType: 'engagement',
      roleContext: person.current_hat,
      payload: {
        engagement_id: engagementId,
        permanent_posting_id: postingId,
        crew_person_id: crewId,
        application_id: application.id,
      },
      personId: user.id,
      idempotencyKey: `PERMANENT.SHORTLIST_CHAT_OPENED:${postingId}:${crewId}`,
    });

    // Re-read to get the engagement_id the projection actually committed —
    // a deduped retry returns the original event id, not ours, but the
    // projection row is keyed on application_id either way.
    const { data: created } = await serviceClient
      .from('active_engagements')
      .select('id')
      .eq('application_id', application.id)
      .eq('phase', 'shortlist')
      .single();

    notifyOnEvent(
      serviceClient,
      'PERMANENT.SHORTLIST_CHAT_OPENED',
      {
        engagement_id: created?.id ?? engagementId,
        permanent_posting_id: postingId,
        crew_person_id: crewId,
        application_id: application.id,
      },
      user.id,
    );

    return NextResponse.json({
      success: true,
      engagementId: created?.id ?? engagementId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to open chat';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
