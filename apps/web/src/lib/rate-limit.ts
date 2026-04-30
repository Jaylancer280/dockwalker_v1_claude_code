import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

let _redis: Redis | null | undefined = undefined;
let _globalLimit: Ratelimit | null = null;
let _writeLimit: Ratelimit | null = null;
let _cvHandleAuthLimit: Ratelimit | null = null;
let _cvHandleAnonLimit: Ratelimit | null = null;
let _qrHireLimit: Ratelimit | null = null;
let _redisDownWarned = false;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!_redisDownWarned) {
      // Fail-open is intentional during dev / when Upstash is intentionally
      // unset, but in production this means rate limiting is silently OFF.
      // Log once at first miss so it surfaces in Sentry / Vercel logs rather
      // than disappearing into the void.
      console.error(
        '[rate-limit] Upstash credentials missing — rate limiting DISABLED for this process. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env.',
      );
      Sentry.captureMessage('Rate limiting disabled (Upstash credentials missing)', {
        level: 'error',
        tags: { module: 'rate-limit' },
      });
      _redisDownWarned = true;
    }
    _redis = null;
    return null;
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

/**
 * Health-check helper — used by /api/health to surface rate-limit
 * configuration state without exposing the Upstash creds.
 */
export function isRateLimitingActive(): boolean {
  return getRedis() !== null;
}

// Global: 100 requests per 60 seconds per IP
function getGlobalLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_globalLimit) {
    _globalLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'rl:global',
    });
  }
  return _globalLimit;
}

// Write routes: 30 requests per 60 seconds per IP
function getWriteLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_writeLimit) {
    _writeLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'rl:write',
    });
  }
  return _writeLimit;
}

/**
 * CV-handle landing endpoint rate limits (spec §5):
 *   - Unauth IP: 20 requests / hour
 *   - Auth IP:   100 requests / hour
 *
 * Tighter than the global API limit because the endpoint is an unsigned-in
 * scrape target and a caching CDN is not feasible (response varies per
 * caller). Generous enough that a real captain scanning one CV doesn't
 * trip it.
 */
export function getCvHandleAuthLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_cvHandleAuthLimit) {
    _cvHandleAuthLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 m'),
      prefix: 'rl:cv-handle:auth',
    });
  }
  return _cvHandleAuthLimit;
}

/**
 * Hire-from-QR rate limit (spec §6 abuse mitigation):
 *   - 5 QR-flagged hire actions per hour per employer.
 *
 * Applies to both daywork (POST /api/daywork with inviteCrewPersonId)
 * and permanent (POST /api/permanent/[id]/invite). Keyed by the
 * employer's person_id, NOT by IP — a captain on a yacht and
 * shoreside ops staff sharing the same WAN should not multiply each
 * other's hire budget.
 */
export function getQrHireLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_qrHireLimit) {
    _qrHireLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 m'),
      prefix: 'rl:qr-hire',
    });
  }
  return _qrHireLimit;
}

let _reactivateLimit: Ratelimit | null = null;

/**
 * Reactivate route rate limit:
 *   - 5 reactivation attempts per hour per IP.
 *
 * Defensive depth. The route already gates on authenticated session
 * (post-password-reset), so the enumeration surface is small, but
 * legitimate users only ever hit this once. 5/hour leaves headroom
 * for accidental retries while shutting down any session-stuffing
 * probe attempt.
 */
export function getReactivateLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_reactivateLimit) {
    _reactivateLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 m'),
      prefix: 'rl:reactivate',
    });
  }
  return _reactivateLimit;
}

let _vesselPrefixLimit: Ratelimit | null = null;

/**
 * Vessel-lookup partial-prefix rate limit (audit P1-S7):
 *   - 10 prefix searches per hour per user.
 *
 * The lookup route is onboarding-friendly so we can't gate to onboarded-only.
 * The exact-IMO branch (7-digit) doesn't enumerate (caller already knows the
 * IMO) — only the 4-6 digit prefix branch is interesting to an attacker.
 * 10/hour is generous for legitimate "I'm not sure of the last digit" cases
 * but expensive enough to make brute enumeration uneconomic at scale.
 */
export function getVesselPrefixLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_vesselPrefixLimit) {
    _vesselPrefixLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 m'),
      prefix: 'rl:vessel-prefix',
    });
  }
  return _vesselPrefixLimit;
}

export function getCvHandleAnonLimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_cvHandleAnonLimit) {
    _cvHandleAnonLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '60 m'),
      prefix: 'rl:cv-handle:anon',
    });
  }
  return _cvHandleAnonLimit;
}

export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const path = request.nextUrl.pathname;
  const method = request.method;

  // Skip rate limiting for health check, webhooks, and cron jobs
  if (path === '/api/health' || path.startsWith('/api/webhooks/') || path.startsWith('/api/cron/'))
    return null;

  // Skip non-API routes (pages are not rate limited at this layer)
  if (!path.startsWith('/api/')) return null;

  // Global limit — all API requests
  const globalLimit = getGlobalLimit();
  if (globalLimit) {
    const { success, remaining, reset } = await globalLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(remaining),
          },
        },
      );
    }
  }

  // Write limit — POST, PATCH, DELETE only
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    const writeLimit = getWriteLimit();
    if (writeLimit) {
      const { success, remaining, reset } = await writeLimit.limit(`${ip}:write`);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
              'X-RateLimit-Remaining': String(remaining),
            },
          },
        );
      }
    }
  }

  return null; // not rate limited
}
