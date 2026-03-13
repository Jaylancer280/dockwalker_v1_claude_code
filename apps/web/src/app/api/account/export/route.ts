import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/account/export
 * Returns a JSON export of the authenticated user's data for GDPR data portability.
 * Includes: profile, events, messages, engagements, availability, vessels.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, supabase } = guard.value;

  const [profileRes, eventsRes, messagesRes, engagementsRes, availRes, vesselsRes, prefsRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('person_id', user.id).single(),
      supabase
        .from('events')
        .select('id, event_type, aggregate_type, aggregate_id, role_context, payload, created_at')
        .eq('person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('messages')
        .select('id, engagement_id, content, sender_type, created_at')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('active_engagements')
        .select('id, daywork_id, crew_person_id, employer_person_id, status, created_at')
        .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`)
        .order('created_at', { ascending: true }),
      supabase
        .from('availability_windows')
        .select('id, date, expires_at, city_id, port_id, not_available')
        .eq('person_id', user.id)
        .order('date', { ascending: true }),
      supabase
        .from('vessels')
        .select('id, imo_number, name, vessel_type, size_band_id, created_at')
        .eq('owner_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase.from('user_preferences').select('*').eq('person_id', user.id).single(),
    ]);

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    person_id: user.id,
    profile: profileRes.data ?? null,
    preferences: prefsRes.data ?? null,
    events: eventsRes.data ?? [],
    messages: messagesRes.data ?? [],
    engagements: engagementsRes.data ?? [],
    availability: availRes.data ?? [],
    vessels: vesselsRes.data ?? [],
  });
}
