import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * DELETE /api/notifications/telegram
 * Disconnects Telegram: removes the channel, disables the preference,
 * invalidates any unconsumed link tokens.
 */
export async function DELETE() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    await serviceClient
      .from('notification_channels')
      .delete()
      .eq('person_id', user.id)
      .eq('channel_type', 'telegram');

    await serviceClient
      .from('user_preferences')
      .update({ telegram_enabled: false })
      .eq('person_id', user.id);

    // Kill any unconsumed tokens — no point leaving them valid.
    await serviceClient
      .from('telegram_link_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('person_id', user.id)
      .is('consumed_at', null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
