import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { decryptPhone } from '@/lib/crypto';

/**
 * GET /api/notifications/whatsapp/status
 * Returns whether the user has a verified WhatsApp channel, with a masked phone.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    const { data: channel } = await serviceClient
      .from('notification_channels')
      .select('channel_value_encrypted, verified')
      .eq('person_id', user.id)
      .eq('channel_type', 'whatsapp')
      .single();

    if (!channel || !channel.verified) {
      return NextResponse.json({ connected: false, maskedPhone: null });
    }

    // Decrypt and mask the phone number
    let maskedPhone: string | null = null;
    try {
      const phone = decryptPhone(Buffer.from(channel.channel_value_encrypted));
      // Mask middle digits: +33612345678 → +33 ••••• 678
      if (phone.length > 6) {
        const prefix = phone.slice(0, 3);
        const suffix = phone.slice(-3);
        maskedPhone = `${prefix} ${'•'.repeat(phone.length - 6)} ${suffix}`;
      } else {
        maskedPhone = '•'.repeat(phone.length);
      }
    } catch {
      // Decryption failed — key mismatch or corrupt data
      maskedPhone = null;
    }

    return NextResponse.json({ connected: true, maskedPhone });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
