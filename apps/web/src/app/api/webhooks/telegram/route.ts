import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/server';
import { encryptForStorage, decryptPhone, bufferFromBytea } from '@/lib/crypto';
import {
  sendTelegramMessage,
  verifyTelegramWebhookSecret,
  type TelegramUpdate,
} from '@/lib/telegram';

/**
 * POST /api/webhooks/telegram
 *
 * Telegram posts updates here whenever a user interacts with our bot.
 * No auth guard — Telegram authenticates via the X-Telegram-Bot-Api-Secret-Token
 * header which we compared against TELEGRAM_WEBHOOK_SECRET.
 *
 * Supported commands:
 *   /start <token>   Consume a link token minted by /api/notifications/telegram/init
 *                    and attach this chat_id to the DockWalker account that
 *                    owns the token.
 *   /stop            Disconnect Telegram notifications for the linked account.
 */
export async function POST(request: Request) {
  // Verify caller is Telegram, not a random probe.
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!verifyTelegramWebhookSecret(secret)) {
    // Return 200 to avoid Telegram retrying a bogus request. Swallow silently.
    return NextResponse.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  try {
    if (text.startsWith('/start')) {
      await handleStartCommand(chatId, text);
    } else if (text === '/stop' || text === '/disconnect') {
      await handleStopCommand(chatId);
    } else {
      await sendTelegramMessage(
        chatId,
        "👋 Hi! I'm DockWalker's notification bot. Link your account from <b>Settings → Notifications → Telegram</b> in the app to start receiving updates here.",
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    // Don't leak the error to Telegram — always return 200 so they don't retry.
  }

  return NextResponse.json({ ok: true });
}

async function handleStartCommand(chatId: string, text: string) {
  const match = text.match(/^\/start(?:\s+(\S+))?/);
  const token = match?.[1];

  if (!token) {
    await sendTelegramMessage(
      chatId,
      '👋 Welcome to DockWalker. To link this chat to your account, open <b>Settings → Notifications → Telegram</b> in the app and tap <b>Connect Telegram</b>.',
    );
    return;
  }

  const service = await createServiceClient();

  const nowIso = new Date().toISOString();
  const { data: tokenRow } = await service
    .from('telegram_link_tokens')
    .select('id, person_id, expires_at, consumed_at')
    .eq('token', token)
    .single();

  if (!tokenRow) {
    await sendTelegramMessage(chatId, '❌ This link is invalid. Generate a new one from the app.');
    return;
  }

  if (tokenRow.consumed_at) {
    await sendTelegramMessage(
      chatId,
      '❌ This link has already been used. Generate a new one from the app.',
    );
    return;
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await sendTelegramMessage(chatId, '⌛ This link has expired. Generate a new one from the app.');
    return;
  }

  // Consume the token + attach the chat_id to the person's notification channels
  // in a best-effort sequence. If the channel upsert fails we do NOT mark the
  // token consumed — user can retry.
  // Write as a base64 string so PostgREST stores deterministic bytes — passing
  // a raw Buffer let the wire format drift and broke decryption on read.
  const encrypted = encryptForStorage(chatId);

  const { error: channelError } = await service.from('notification_channels').upsert(
    {
      person_id: tokenRow.person_id,
      channel_type: 'telegram',
      channel_value_encrypted: encrypted,
      verified: true,
      verification_code: null,
      verification_expires_at: null,
      updated_at: nowIso,
    },
    { onConflict: 'person_id,channel_type' },
  );

  if (channelError) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Something went wrong linking your account. Please try again.',
    );
    Sentry.captureException(channelError);
    return;
  }

  await service.from('telegram_link_tokens').update({ consumed_at: nowIso }).eq('id', tokenRow.id);

  await service
    .from('user_preferences')
    .upsert({ person_id: tokenRow.person_id, telegram_enabled: true }, { onConflict: 'person_id' });

  await sendTelegramMessage(
    chatId,
    "✅ <b>Linked!</b>\n\nYou'll receive DockWalker notifications here. Manage what you get in the app under Settings → Notifications. Send /stop anytime to disconnect.",
  );
}

async function handleStopCommand(chatId: string) {
  const service = await createServiceClient();

  // Find the channel matching this chat_id by decrypting candidates. Each
  // encryption uses a fresh IV so we can't match on ciphertext directly. Scan
  // + decrypt is fine at launch scale — /stop is rare and the telegram row
  // set stays small.
  const { data: channels } = await service
    .from('notification_channels')
    .select('id, person_id, channel_value_encrypted')
    .eq('channel_type', 'telegram')
    .eq('verified', true);

  const match = (channels ?? []).find((row) => {
    try {
      return decryptPhone(bufferFromBytea(row.channel_value_encrypted)) === chatId;
    } catch {
      return false;
    }
  });

  if (!match) {
    await sendTelegramMessage(chatId, 'ℹ️ This chat is not linked to a DockWalker account.');
    return;
  }

  await service.from('notification_channels').delete().eq('id', match.id);
  await service
    .from('user_preferences')
    .update({ telegram_enabled: false })
    .eq('person_id', match.person_id);

  await sendTelegramMessage(
    chatId,
    '🔕 Disconnected. You will no longer receive DockWalker notifications here. Reconnect any time from the app.',
  );
}
