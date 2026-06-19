import { NextResponse } from 'next/server';
import { isRateLimitingActive } from '@/lib/rate-limit';

/**
 * GET /api/health — process-level health + critical-config indicators.
 *
 * Surfaces:
 *   - rate_limiting: false → Upstash creds missing → app is fail-open
 *   - sentry: false       → DSN missing → errors aren't aggregated
 *
 * Both can ship with `false` in dev. In production both should be `true`
 * — set up an external uptime monitor (BetterUptime, UptimeRobot, etc.)
 * to alert when either flips off.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rate_limiting: isRateLimitingActive(),
    sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  });
}
