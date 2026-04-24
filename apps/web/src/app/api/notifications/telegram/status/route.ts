import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * GET /api/notifications/telegram/status
 * Returns whether the user has a verified Telegram channel.
 * Used for both the initial settings render and the post-deep-link poll.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    const { data: channel } = await serviceClient
      .from('notification_channels')
      .select('verified')
      .eq('person_id', user.id)
      .eq('channel_type', 'telegram')
      .single();

    return NextResponse.json({
      connected: Boolean(channel?.verified),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
