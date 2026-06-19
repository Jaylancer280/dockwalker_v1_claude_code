import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * DELETE /api/notifications/whatsapp
 * Disconnect WhatsApp notifications. Hard-deletes the channel row (zero retention).
 */
export async function DELETE() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    // Hard-delete the notification channel
    await serviceClient
      .from('notification_channels')
      .delete()
      .eq('person_id', user.id)
      .eq('channel_type', 'whatsapp');

    // Disable whatsapp in preferences
    await serviceClient
      .from('user_preferences')
      .update({ whatsapp_enabled: false })
      .eq('person_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
