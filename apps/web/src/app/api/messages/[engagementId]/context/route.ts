import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/messages/:engagementId/context
 * Returns engagement metadata for the chat header.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: engagement } = await supabase
    .from('active_engagements')
    .select(
      `
      id, crew_person_id, employer_person_id, start_date, end_date,
      dayworks(yacht_roles(name), ports(name))
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

  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('person_id', otherId)
    .single();

  return NextResponse.json({
    engagement: {
      ...engagement,
      other_name: otherProfile?.display_name ?? 'Unknown',
    },
  });
}
