import { Redis } from '@upstash/redis';

/**
 * Email cooldowns — Upstash-backed rate limits to keep transactional email
 * feeling useful rather than spammy.
 *
 * Three layers, composed in order by `canSendEmail()`:
 *   - Per-conversation message cooldown  — 15 min per (recipient × engagement)
 *   - Per-posting applied cooldown       — 60 min per (poster × daywork)
 *   - Per-recipient daily cap            — 20 emails per 24h (safety net)
 *
 * Once-per-flow events (DAYWORK.ACCEPTED, PERMANENT.SELECTED, etc.) pass
 * kind='other' and only hit the daily cap.
 *
 * When Upstash isn't configured (no env vars), all cooldowns no-op and emails
 * are always allowed — same graceful-degradation pattern as the main rate
 * limiter in `src/lib/rate-limit.ts`.
 */

const MESSAGE_COOLDOWN_SECONDS = 15 * 60;
const APPLIED_COOLDOWN_SECONDS = 60 * 60;
const DAILY_CAP = 20;
const DAILY_TTL_SECONDS = 24 * 60 * 60;

let _redis: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export type CooldownKind = 'message' | 'applied' | 'other';

/**
 * Returns true if the email should be sent (cooldowns/cap not tripped).
 * Atomically reserves the cooldown slot when it returns true — callers do not
 * need to mark a separate "sent" flag.
 *
 * @param recipientId  person_id of the recipient
 * @param kind         which cooldown layer applies
 * @param resourceId   engagement id (kind='message') or daywork id (kind='applied'); ignored for 'other'
 */
export async function canSendEmail(
  recipientId: string,
  kind: CooldownKind,
  resourceId?: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  // Per-event cooldown first (atomic SET NX EX). Reserving here before the
  // daily-cap INCR means a blocked per-event send doesn't consume a daily
  // slot. Down-side: if the daily cap trips below, the per-event key is
  // already set — the user will still be blocked from this specific resource
  // for the remainder of its cooldown tomorrow. Acceptable trade-off.
  if (kind === 'message' && resourceId) {
    const key = `email:cd:msg:${recipientId}:${resourceId}`;
    const set = await redis.set(key, '1', { ex: MESSAGE_COOLDOWN_SECONDS, nx: true });
    if (set !== 'OK') return false;
  } else if (kind === 'applied' && resourceId) {
    const key = `email:cd:app:${recipientId}:${resourceId}`;
    const set = await redis.set(key, '1', { ex: APPLIED_COOLDOWN_SECONDS, nx: true });
    if (set !== 'OK') return false;
  }

  // Daily cap — INCR always increments; first caller sets the 24h TTL.
  const today = new Date().toISOString().slice(0, 10);
  const dailyKey = `email:cd:day:${recipientId}:${today}`;
  const count = await redis.incr(dailyKey);
  if (count === 1) {
    await redis.expire(dailyKey, DAILY_TTL_SECONDS);
  }
  return count <= DAILY_CAP;
}
