import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/calls/turn-credentials
 * Returns ICE servers (STUN + optional TURN) for WebRTC voice calls.
 * Requires auth + at least one active permanent engagement.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    // Verify user has an active permanent engagement (prevents credential farming)
    const { data: engagement } = await supabase
      .from('active_engagements')
      .select('id')
      .not('permanent_posting_id', 'is', null)
      .eq('status', 'active')
      .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`)
      .limit(1);

    if (!engagement || engagement.length === 0) {
      return NextResponse.json(
        { error: 'Voice calls require an active permanent engagement' },
        { status: 403 },
      );
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    // If Twilio credentials available, fetch TURN servers
    if (sid && token) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          iceServers: data.ice_servers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
        });
      }
    }

    // Fallback: STUN only (works for ~80% of users)
    return NextResponse.json({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
