import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { serviceClient } = guard.value;
  const { id } = await params;

  try {
    const [{ data: engagement }, { data: messages }, { data: ratings }] = await Promise.all([
      serviceClient
        .from('active_engagements')
        .select(
          '*, crew_profile:profiles!active_engagements_crew_person_id_profiles_fkey(display_name), employer_profile:profiles!active_engagements_employer_person_id_profiles_fkey(display_name)',
        )
        .eq('id', id)
        .single(),
      serviceClient
        .from('messages')
        .select('id, sender_person_id, content, is_system, created_at')
        .eq('engagement_id', id)
        .order('created_at', { ascending: true }),
      serviceClient.from('engagement_ratings').select('*').eq('engagement_id', id),
    ]);

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    return NextResponse.json({
      engagement: {
        ...engagement,
        type: engagement.daywork_id ? 'daywork' : 'permanent',
        crew_name:
          (engagement.crew_profile as unknown as { display_name: string } | null)?.display_name ??
          'Unknown',
        employer_name:
          (engagement.employer_profile as unknown as { display_name: string } | null)
            ?.display_name ?? 'Unknown',
      },
      messages: messages ?? [],
      ratings: ratings ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch engagement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
