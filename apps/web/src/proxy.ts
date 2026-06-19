import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Allowed origins for state-mutating requests. Production hosts
 * (`www.dockwalker.io` and the apex `dockwalker.io`) plus localhost
 * variants for local dev. Extend if a staging subdomain is added.
 *
 * Webhook routes (Stripe, Telegram) bypass this check entirely — they
 * have their own signature verification and would never carry a
 * browser-set Origin header.
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    'https://www.dockwalker.io',
    'https://dockwalker.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0),
);

export async function proxy(request: NextRequest) {
  // CSRF / origin allowlist — applies to state-mutating methods on API
  // routes (audit P1-S1). Webhooks are exempt; they verify their own
  // signatures upstream. Same-origin browser fetches always carry
  // Origin; if it's missing we let the request through (curl, server-to-
  // server, healthcheck probes) since CSRF is a browser-only attack
  // surface.
  const path = request.nextUrl.pathname;
  const method = request.method;
  if (
    path.startsWith('/api/') &&
    !path.startsWith('/api/webhooks/') &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS'
  ) {
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
  }

  // Rate limit check runs after the origin allowlist — rejects before any auth/DB work
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, fonts (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
