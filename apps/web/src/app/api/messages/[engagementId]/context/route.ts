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
  const { user, supabase } = guard.value;

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select(
      `
      id, crew_person_id, employer_person_id, start_date, end_date, status, crew_completion_status,
      dayworks(
        working_days, day_rate, currency, meals, notes,
        yacht_roles(name),
        ports(name, cities(name)),
        vessels(name)
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

  const [{ data: otherProfile }, { data: myRating }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('person_id', otherId).single(),
    supabase
      .from('engagement_ratings')
      .select(
        'id, rater_role, pay_accuracy, meals_accuracy, role_accuracy, working_days_accuracy, vessel_condition, would_work_on_vessel_again, skills_as_advertised, certifications_verified, punctuality, would_rehire, communication_accuracy, overall_match',
      )
      .eq('engagement_id', engagementId)
      .eq('rater_person_id', user.id)
      .single(),
  ]);

  return NextResponse.json({
    engagement: {
      ...engagement,
      other_name: otherProfile?.display_name ?? 'Unknown',
      has_rated: !!myRating,
      my_rating: myRating ?? null,
    },
  });
}
