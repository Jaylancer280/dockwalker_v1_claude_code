import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

let _redis: Redis | null | undefined = undefined;
let _globalLimit: Ratelimit | null = null;
let _writeLimit: Ratelimit | null = null;
let _cvHandleAuthLimit: Ratelimit | null = null;
let _cvHandleAnonLimit: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redis = null;
    return null;
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
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
