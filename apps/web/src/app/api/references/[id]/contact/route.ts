import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';
import {
  EMPLOYER_FREE_PENDING_BUDGET,
  EMPLOYER_FREE_ACCEPTED_30D_BUDGET,
  getSubscriptionPlan,
} from '@/lib/references/helpers';
import { notifyOnEvent } from '@/lib/push-triggers';

/**
 * POST /api/references/[id]/contact
 *
 *   - Auth required, employer/agent only.
 *   - Body: `{ question?: string }` (≤200 chars, P1-D — surfaced on the
 *     consent prompt + pre-populates the chat's first message on accept).
 *   - Two-tier gate (Free): max 10 outstanding pending + max 5 accepted
 *     contact requests in any rolling 30 days. Pro = unlimited.
 *   - Validates underlying reference is `accepted`.
 *   - Fires REFERENCE.CONTACT_REQUESTED.
 *   - Notification: REFERENCE.CONTACT_REQUESTED → referee with the question.
 *   - Returns `{ contactId, remaining: { pending, monthly } }` so the UI can
 *     update the "X left this month" hint after the request lands.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, person, serviceClient } = guard.value;
    if (!['employer', 'agent'].includes(person.current_hat)) {
      return NextResponse.json(
        { error: 'Reference contacts are employer/agent only' },
        { status: 403 },
      );
    }
    const { id: referenceId } = await params;

    const { data: ref } = await serviceClient
      .from('references')
      .select('id, status, referee_person_id, snapshot_vessel_name')
      .eq('id', referenceId)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }
    if ((ref.status as string) !== 'accepted') {
      return NextResponse.json(
        { error: 'Cannot contact a reference that is not accepted' },
        { status: 409 },
      );
    }
    // Edge case: a dual-hat user can be both the referee AND an employer/agent
    // looking at the crew's profile — block self-contact so they don't notify
    // themselves and burn a budget slot.
    if ((ref.referee_person_id as string | null) === user.id) {
      return NextResponse.json(
        { error: "You're the referee on this reference — you can't contact yourself" },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { question?: string };
    const question = typeof body.question === 'string' ? body.question.trim() : null;
    if (question && question.length > 200) {
      return NextResponse.json(
        { error: 'Question must be 200 characters or less' },
        { status: 400 },
      );
    }

    const plan = await getSubscriptionPlan(serviceClient, user.id);
    let remainingPending = Number.POSITIVE_INFINITY;
    let remainingMonthly = Number.POSITIVE_INFINITY;
    if (plan !== 'employer_pro') {
      const { count: pendingCount } = await serviceClient
        .from('reference_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('employer_person_id', user.id)
        .eq('status', 'pending');
      const pending = pendingCount ?? 0;
      if (pending >= EMPLOYER_FREE_PENDING_BUDGET) {
        return NextResponse.json(
          {
            error: 'You have too many outstanding contact requests',
            gate: {
              reason: 'pending_budget',
              current: pending,
              limit: EMPLOYER_FREE_PENDING_BUDGET,
              upgrade_path: '/billing',
            },
          },
          { status: 402 },
        );
      }
      remainingPending = EMPLOYER_FREE_PENDING_BUDGET - pending - 1;

      const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: acceptedCount } = await serviceClient
        .from('reference_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('employer_person_id', user.id)
        .eq('status', 'accepted')
        .gte('created_at', sinceIso);
      const accepted = acceptedCount ?? 0;
      if (accepted >= EMPLOYER_FREE_ACCEPTED_30D_BUDGET) {
        return NextResponse.json(
          {
            error: 'Monthly contact-request budget reached',
            gate: {
              reason: 'monthly_budget',
              current: accepted,
              limit: EMPLOYER_FREE_ACCEPTED_30D_BUDGET,
              upgrade_path: '/billing',
            },
          },
          { status: 402 },
        );
      }
      remainingMonthly = EMPLOYER_FREE_ACCEPTED_30D_BUDGET - accepted;
    }

    const contactId = randomUUID();
    await appendEvent(serviceClient, {
      eventType: 'REFERENCE.CONTACT_REQUESTED',
      aggregateId: contactId,
      aggregateType: 'reference_contact',
      roleContext: person.current_hat,
      payload: {
        id: contactId,
        reference_id: referenceId,
        question: question && question.length > 0 ? question : null,
      },
      personId: user.id,
    });

    if (ref.referee_person_id) {
      notifyOnEvent(
        serviceClient,
        'REFERENCE.CONTACT_REQUESTED',
        {
          contact_id: contactId,
          reference_id: referenceId,
          recipient_person_id: ref.referee_person_id as string,
          snapshot_vessel_name: ref.snapshot_vessel_name as string,
          question,
        },
        user.id,
      );
    }

    return NextResponse.json({
      contactId,
      remaining: {
        pending: Number.isFinite(remainingPending) ? remainingPending : null,
        monthly: Number.isFinite(remainingMonthly) ? remainingMonthly : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
