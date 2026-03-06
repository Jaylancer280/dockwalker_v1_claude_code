import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/messages
 * Returns all active engagements for the authenticated user
 * with last message preview, for the conversations list.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get engagements where user is crew or employer
  const { data: asCrew } = await supabase
    .from('active_engagements')
    .select(
      `
      id, crew_person_id, employer_person_id, daywork_id, start_date, end_date, status,
      dayworks(yacht_roles(name), ports(name)),
      profiles:employer_person_id(display_name)
    `,
    )
    .eq('crew_person_id', user.id)
    .eq('status', 'active');

  const { data: asEmployer } = await supabase
    .from('active_engagements')
    .select(
      `
      id, crew_person_id, employer_person_id, daywork_id, start_date, end_date, status,
      dayworks(yacht_roles(name), ports(name)),
      profiles:crew_person_id(display_name)
    `,
    )
    .eq('employer_person_id', user.id)
    .eq('status', 'active');

  const engagements = [
    ...(asCrew ?? []).map((e) => ({ ...e, role: 'crew' as const })),
    ...(asEmployer ?? []).map((e) => ({ ...e, role: 'employer' as const })),
  ];

  // Get last message for each engagement
  const engagementIds = engagements.map((e) => e.id);
  const lastMessages: Record<
    string,
    { content: string; created_at: string; sender_person_id: string }
  > = {};

  if (engagementIds.length > 0) {
    // Get the most recent message per engagement
    const { data: messages } = await supabase
      .from('messages')
      .select('engagement_id, content, created_at, sender_person_id')
      .in('engagement_id', engagementIds)
      .order('created_at', { ascending: false });

    for (const msg of messages ?? []) {
      if (!lastMessages[msg.engagement_id]) {
        lastMessages[msg.engagement_id] = {
          content: msg.content,
          created_at: msg.created_at,
          sender_person_id: msg.sender_person_id,
        };
      }
    }
  }

  const conversations = engagements.map((eng) => ({
    ...eng,
    last_message: lastMessages[eng.id] ?? null,
  }));

  // Sort by last message time (most recent first), then by engagement creation
  conversations.sort((a, b) => {
    const aTime = a.last_message?.created_at ?? a.start_date;
    const bTime = b.last_message?.created_at ?? b.start_date;
    return bTime.localeCompare(aTime);
  });

  return NextResponse.json({ conversations });
}
