import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';

const VALID_PLATFORMS = ['apns', 'fcm', 'web'] as const;

/**
 * POST /api/push-tokens
 * Upsert a device push token for the authenticated user.
 * Body: { token: string, platform: 'apns' | 'fcm' | 'web' }
 */
export async function POST(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const body = await request.json().catch(() => ({}));
    const { token, platform } = body;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'platform must be apns, fcm, or web' }, { status: 400 });
    }

    const { error } = await supabase.from('device_tokens').upsert(
      {
        person_id: user.id,
        token: token.trim(),
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'person_id,token' },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/push-tokens
 * Remove a device push token for the authenticated user.
 * Body: { token: string }
 */
export async function DELETE(request: Request) {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const body = await request.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('person_id', user.id)
      .eq('token', token.trim());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
