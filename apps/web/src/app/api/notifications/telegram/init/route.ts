import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import {
  buildTelegramDeepLink,
  getTelegramBotUsername,
  isTelegramConfigured,
} from '@/lib/telegram';

const TOKEN_TTL_MINUTES = 10;
const MAX_ACTIVE_TOKENS = 3;

/**
 * POST /api/notifications/telegram/init
 * Mints a one-time link token, returns the t.me deep link the UI should open.
 * The user taps through, the bot receives `/start <token>`, our webhook
 * consumes the token and writes the notification_channels row.
 */
export async function POST() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;
  const { user, serviceClient } = guard.value;

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: 'Telegram notifications are not configured on this server.' },
      { status: 503 },
    );
  }

  try {
    // Rate limit: cap active (unexpired, unconsumed) tokens per person.
    const nowIso = new Date().toISOString();
    const { count } = await serviceClient
      .from('telegram_link_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', user.id)
      .is('consumed_at', null)
      .gt('expires_at', nowIso);

    if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
      return NextResponse.json(
        { error: 'Too many active link tokens. Wait a few minutes and try again.' },
        { status: 429 },
      );
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    const { error } = await serviceClient.from('telegram_link_tokens').insert({
      person_id: user.id,
      token,
      expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      deepLink: buildTelegramDeepLink(token),
      botUsername: getTelegramBotUsername(),
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
