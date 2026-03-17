import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { checkRateLimit } from '@/lib/rate-limit';

export async function proxy(request: NextRequest) {
  // Rate limit check runs first — rejects before any auth/DB work
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
