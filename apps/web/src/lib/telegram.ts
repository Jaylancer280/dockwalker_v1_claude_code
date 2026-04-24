import * as Sentry from '@sentry/nextjs';

const API_BASE = 'https://api.telegram.org';

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
}

export function buildTelegramDeepLink(token: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username) {
    throw new Error('TELEGRAM_BOT_USERNAME env var is not set');
  }
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

export function getTelegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME ?? null;
}

export function verifyTelegramWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  if (!headerValue) return false;
  return headerValue === expected;
}

/**
 * Send a plain or HTML-formatted message to a Telegram chat_id.
 * Graceful no-op when the bot token is not configured.
 * Returns true on success, false on any failure (logged to Sentry).
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts?: { parseMode?: 'HTML' | 'MarkdownV2'; disablePreview?: boolean },
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parseMode ?? 'HTML',
        disable_web_page_preview: opts?.disablePreview ?? true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      Sentry.captureException(
        new Error(`Telegram sendMessage failed: ${res.status} ${body.slice(0, 200)}`),
      );
      // 403: user blocked the bot. 400: chat not found or similar permanent error.
      return false;
    }
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * Returns true if the error response indicates the user has blocked the bot
 * or the chat is otherwise permanently unreachable — the caller should mark
 * the channel unverified so the dispatcher stops trying to send.
 */
export function isPermanentTelegramError(status: number): boolean {
  return status === 403 || status === 400;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
    chat: { id: number; type: string; username?: string };
    text?: string;
  };
}
