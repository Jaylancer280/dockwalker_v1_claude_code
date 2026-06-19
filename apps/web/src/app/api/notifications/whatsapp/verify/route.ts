import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

/**
 * POST /api/notifications/whatsapp/verify
 * Verify OTP code for WhatsApp registration.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    const body = await request.json().catch(() => ({}));
    const code = body.code;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 });
    }

    // Look up unverified channel with valid code
    const { data: channel } = await serviceClient
      .from('notification_channels')
      .select('id, verification_code, verification_expires_at')
      .eq('person_id', user.id)
      .eq('channel_type', 'whatsapp')
      .eq('verified', false)
      .single();

    if (!channel) {
      return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 400 });
    }

    // Check expiry
    if (
      !channel.verification_expires_at ||
      new Date(channel.verification_expires_at) < new Date()
    ) {
      return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 400 });
    }

    // Check code
    if (channel.verification_code !== code) {
      return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 400 });
    }

    // Mark as verified, clear code
    const { error: updateError } = await serviceClient
      .from('notification_channels')
      .update({
        verified: true,
        verification_code: null,
        verification_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Enable whatsapp in preferences
    await serviceClient
      .from('user_preferences')
      .upsert({ person_id: user.id, whatsapp_enabled: true }, { onConflict: 'person_id' });

    return NextResponse.json({ verified: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
