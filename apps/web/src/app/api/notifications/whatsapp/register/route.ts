import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { encryptPhone } from '@/lib/crypto';

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

/**
 * POST /api/notifications/whatsapp/register
 * Register a phone number for WhatsApp notifications.
 * Encrypts the number, stores it, sends an OTP via Twilio WhatsApp.
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  try {
    const body = await request.json().catch(() => ({}));
    const phoneNumber = body.phoneNumber;

    if (!phoneNumber || typeof phoneNumber !== 'string' || !PHONE_RE.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use E.164 format (e.g. +33612345678)' },
        { status: 400 },
      );
    }

    // Rate limit: 3 registration attempts per person per hour (DB-based)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from('notification_channels')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', user.id)
      .gte('updated_at', oneHourAgo);

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again in an hour.' },
        { status: 429 },
      );
    }

    // Encrypt phone number
    const encrypted = encryptPhone(phoneNumber);

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Upsert notification channel
    const { error: upsertError } = await serviceClient.from('notification_channels').upsert(
      {
        person_id: user.id,
        channel_type: 'whatsapp',
        channel_value_encrypted: encrypted,
        verified: false,
        verification_code: code,
        verification_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'person_id,channel_type' },
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Send OTP via Twilio WhatsApp API
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

    if (twilioSid && twilioAuth && twilioFrom) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')}`;

      await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${phoneNumber}`,
          From: twilioFrom,
          Body: `Your DockWalker verification code is: ${code}. This code expires in 10 minutes.`,
        }).toString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
