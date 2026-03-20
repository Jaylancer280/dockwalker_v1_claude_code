import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

const VALID_YES_NO_PARTIAL = ['yes', 'no', 'partial'];
const VALID_DAYS_ACCURACY = ['fewer', 'as_listed', 'more'];
const VALID_CERT_VERIFIED = ['yes', 'no', 'not_checked'];

/**
 * POST /api/engagements/:id/rate
 * Submit a rating for a completed or cancelled engagement.
 * Crew and employer have different required fields, and cancelled context has a lighter form.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase, serviceClient } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select('id, crew_person_id, employer_person_id, daywork_id, status, crew_completion_status')
    .eq('id', engagementId)
    .not('daywork_id', 'is', null)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
  }

  const isCrew = engagement.crew_person_id === user.id;
  const isEmployer = engagement.employer_person_id === user.id;

  if (!isCrew && !isEmployer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (engagement.status !== 'completed' && engagement.status !== 'cancelled') {
    return NextResponse.json(
      { error: 'Engagement must be completed or cancelled to rate' },
      { status: 400 },
    );
  }

  // Crew must have confirmed/disputed before rating completed engagements
  if (engagement.status === 'completed' && isCrew && engagement.crew_completion_status === null) {
    return NextResponse.json(
      { error: 'You must confirm or dispute completion before rating' },
      { status: 400 },
    );
  }

  // Check if already rated
  const { data: existingRating } = await supabase
    .from('engagement_ratings')
    .select('id')
    .eq('engagement_id', engagementId)
    .eq('rater_person_id', user.id)
    .single();

  if (existingRating) {
    return NextResponse.json({ error: 'You have already rated this engagement' }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));

  // Validate symmetric fields (required for both contexts)
  if (typeof body.communication_accuracy !== 'boolean') {
    return NextResponse.json(
      { error: 'communication_accuracy must be a boolean' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(body.overall_match) || body.overall_match < 1 || body.overall_match > 5) {
    return NextResponse.json({ error: 'overall_match must be an integer 1-5' }, { status: 400 });
  }

  try {
    if (engagement.status === 'cancelled') {
      // Cancelled-context rating — lighter form
      if (isCrew) {
        if (!VALID_YES_NO_PARTIAL.includes(body.notice_given)) {
          return NextResponse.json(
            { error: 'notice_given must be yes, no, or partial' },
            { status: 400 },
          );
        }

        await appendEvent(serviceClient, {
          eventType: 'ENGAGEMENT.CANCELLATION_RATED_BY_CREW',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'crew',
          payload: {
            engagement_id: engagementId,
            notice_given: body.notice_given as 'yes' | 'no' | 'partial',
            communication_accuracy: body.communication_accuracy,
            overall_match: body.overall_match,
          },
          personId: user.id,
        });
      } else {
        await appendEvent(serviceClient, {
          eventType: 'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'employer',
          payload: {
            engagement_id: engagementId,
            communication_accuracy: body.communication_accuracy,
            overall_match: body.overall_match,
          },
          personId: user.id,
        });
      }
    } else {
      // Completed-context rating — full form
      if (isCrew) {
        if (!VALID_YES_NO_PARTIAL.includes(body.pay_accuracy)) {
          return NextResponse.json(
            { error: 'pay_accuracy must be yes, no, or partial' },
            { status: 400 },
          );
        }
        if (!VALID_YES_NO_PARTIAL.includes(body.meals_accuracy)) {
          return NextResponse.json(
            { error: 'meals_accuracy must be yes, no, or partial' },
            { status: 400 },
          );
        }
        if (!VALID_YES_NO_PARTIAL.includes(body.role_accuracy)) {
          return NextResponse.json(
            { error: 'role_accuracy must be yes, no, or partial' },
            { status: 400 },
          );
        }
        if (!VALID_DAYS_ACCURACY.includes(body.working_days_accuracy)) {
          return NextResponse.json(
            { error: 'working_days_accuracy must be fewer, as_listed, or more' },
            { status: 400 },
          );
        }
        if (
          !Number.isInteger(body.vessel_condition) ||
          body.vessel_condition < 1 ||
          body.vessel_condition > 5
        ) {
          return NextResponse.json(
            { error: 'vessel_condition must be an integer 1-5' },
            { status: 400 },
          );
        }
        if (typeof body.would_work_on_vessel_again !== 'boolean') {
          return NextResponse.json(
            { error: 'would_work_on_vessel_again must be a boolean' },
            { status: 400 },
          );
        }

        // Check if the daywork had permanent_opportunity flag for accuracy rating
        let permanentOpportunityAccuracy: string | undefined;
        if (body.permanent_opportunity_accuracy) {
          const validAccuracy = ['yes', 'no', 'not_applicable'];
          if (!validAccuracy.includes(body.permanent_opportunity_accuracy)) {
            return NextResponse.json(
              { error: 'permanent_opportunity_accuracy must be yes, no, or not_applicable' },
              { status: 400 },
            );
          }
          // Verify the daywork actually had the flag
          const { data: dayworkData } = await supabase
            .from('dayworks')
            .select('permanent_opportunity')
            .eq('id', engagement.daywork_id)
            .single();
          if (dayworkData?.permanent_opportunity) {
            permanentOpportunityAccuracy = body.permanent_opportunity_accuracy;
          }
        }

        await appendEvent(serviceClient, {
          eventType: 'ENGAGEMENT.RATED_BY_CREW',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'crew',
          payload: {
            engagement_id: engagementId,
            pay_accuracy: body.pay_accuracy,
            meals_accuracy: body.meals_accuracy,
            role_accuracy: body.role_accuracy,
            working_days_accuracy: body.working_days_accuracy,
            vessel_condition: body.vessel_condition,
            would_work_on_vessel_again: body.would_work_on_vessel_again,
            communication_accuracy: body.communication_accuracy,
            overall_match: body.overall_match,
            ...(permanentOpportunityAccuracy
              ? { permanent_opportunity_accuracy: permanentOpportunityAccuracy }
              : {}),
          },
          personId: user.id,
        });
      } else {
        if (!VALID_YES_NO_PARTIAL.includes(body.skills_as_advertised)) {
          return NextResponse.json(
            { error: 'skills_as_advertised must be yes, no, or partial' },
            { status: 400 },
          );
        }
        if (!VALID_CERT_VERIFIED.includes(body.certifications_verified)) {
          return NextResponse.json(
            { error: 'certifications_verified must be yes, no, or not_checked' },
            { status: 400 },
          );
        }
        if (!VALID_YES_NO_PARTIAL.includes(body.punctuality)) {
          return NextResponse.json(
            { error: 'punctuality must be yes, no, or partial' },
            { status: 400 },
          );
        }
        if (typeof body.would_rehire !== 'boolean') {
          return NextResponse.json({ error: 'would_rehire must be a boolean' }, { status: 400 });
        }

        await appendEvent(serviceClient, {
          eventType: 'ENGAGEMENT.RATED_BY_EMPLOYER',
          aggregateId: engagementId,
          aggregateType: 'engagement',
          roleContext: 'employer',
          payload: {
            engagement_id: engagementId,
            skills_as_advertised: body.skills_as_advertised,
            certifications_verified: body.certifications_verified,
            punctuality: body.punctuality,
            would_rehire: body.would_rehire,
            communication_accuracy: body.communication_accuracy,
            overall_match: body.overall_match,
          },
          personId: user.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to submit rating';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
