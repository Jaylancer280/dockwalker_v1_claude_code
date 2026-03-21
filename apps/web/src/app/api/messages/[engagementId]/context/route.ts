import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/messages/:engagementId/context
 * Returns engagement metadata for the chat header.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const { data: engagement } = await supabase
      .from('active_engagements')
      .select(
        `
      id, daywork_id, permanent_posting_id, crew_person_id, employer_person_id, start_date, end_date, status, outcome, crew_completion_status,
      cancelled_by, cancellation_reason_category, cancellation_reason_text,
      postponement_status, proposed_start_date, proposed_end_date, proposed_working_days,
      work_started_status, work_started_at,
      dayworks(
        job_number, working_days, day_rate, currency, meals, notes, permanent_opportunity,
        yacht_roles(name),
        ports(name, cities(name)),
        vessels(name, vessel_type, loa_meters, imo_number, vessel_size_bands(label))
      ),
      permanent_postings(
        id, job_number, salary_min, salary_max, salary_currency, salary_period,
        live_aboard, shortlist_cap, notes, status,
        yacht_roles(name),
        ports(name, cities(name)),
        vessels(name, vessel_type, loa_meters, imo_number, vessel_size_bands(label))
      )
    `,
      )
      .eq('id', engagementId)
      .single();

    if (!engagement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (engagement.crew_person_id !== user.id && engagement.employer_person_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the other person's display name
    const otherId =
      engagement.crew_person_id === user.id
        ? engagement.employer_person_id
        : engagement.crew_person_id;

    const [{ data: otherProfile }, { data: myRating }, { data: daywork }, { data: checklist }] =
      await Promise.all([
        supabase.from('profiles').select('display_name').eq('person_id', otherId).single(),
        supabase
          .from('engagement_ratings')
          .select(
            'id, rater_role, rating_context, notice_given, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, permanent_opportunity_accuracy, skills_as_advertised, certifications_verified, punctuality, would_rehire, communication_accuracy, overall_match',
          )
          .eq('engagement_id', engagementId)
          .eq('rater_person_id', user.id)
          .single(),
        engagement.cancelled_by === 'crew'
          ? supabase.from('dayworks').select('status').eq('id', engagement.daywork_id).single()
          : Promise.resolve({ data: null }),
        supabase
          .from('engagement_checklists')
          .select('items, acknowledged_item_ids')
          .eq('engagement_id', engagementId)
          .single(),
      ]);

    // If crew cancelled, employer has responded once daywork is no longer in_progress
    const crewCancelResponded =
      engagement.cancelled_by === 'crew' && daywork?.status !== 'in_progress';

    return NextResponse.json({
      engagement: {
        ...engagement,
        type: engagement.permanent_posting_id ? 'permanent' : 'daywork',
        other_name: otherProfile?.display_name ?? 'Unknown',
        has_rated: !!myRating,
        my_rating: myRating ?? null,
        crew_cancel_responded: crewCancelResponded,
        checklist: checklist
          ? {
              items: checklist.items as Array<{ id: string; label: string; value: string }>,
              acknowledged_item_ids: (checklist.acknowledged_item_ids as string[]) ?? [],
            }
          : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
