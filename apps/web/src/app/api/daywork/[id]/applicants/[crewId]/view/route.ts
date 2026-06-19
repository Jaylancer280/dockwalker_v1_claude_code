import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { appendEvent } from '@dockwalker/db';

/**
 * POST /api/daywork/:id/applicants/:crewId/view
 * Marks an application as viewed. Emits DAYWORK.VIEWED.
 * Idempotent — does nothing if already viewed/accepted/rejected.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; crewId: string }> },
) {
  const { id: dayworkId, crewId } = await params;
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, person, supabase, serviceClient } = guard.value;

  if (!['employer', 'agent'].includes(person.current_hat)) {
    return NextResponse.json({ error: 'Only employers can view applicants' }, { status: 403 });
  }

  // Verify ownership
  const { data: daywork } = await supabase
    .from('dayworks')
    .select('id, poster_person_id')
    .eq('id', dayworkId)
    .single();

  if (!daywork || daywork.poster_person_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check application state — only fire event if still 'applied'
  // Use serviceClient: ownership verified above; RLS blocks agents.
  const { data: application } = await serviceClient
    .from('applications')
    .select('id, status')
    .eq('crew_person_id', crewId)
    .eq('daywork_id', dayworkId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Idempotent: if already past 'applied', just return success
  if (application.status !== 'applied') {
    return NextResponse.json({ success: true, alreadyViewed: true });
  }

  try {
    await appendEvent(serviceClient, {
      eventType: 'DAYWORK.VIEWED',
      aggregateId: `${crewId}:${dayworkId}`,
      aggregateType: 'application',
      roleContext: person.current_hat as 'employer' | 'agent',
      payload: {
        daywork_id: dayworkId,
        crew_person_id: crewId,
      },
      personId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark viewed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
