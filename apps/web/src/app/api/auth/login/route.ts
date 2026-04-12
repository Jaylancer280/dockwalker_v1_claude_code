import { createClient } from '@supabase/supabase-js';
import { createChunks, stringToBase64URL, DEFAULT_COOKIE_OPTIONS } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// @supabase/ssr serializes sessions to cookies with this prefix when
// cookieEncoding is 'base64url' (the default for createServerClient).
const BASE64_PREFIX = 'base64-';

const DEACTIVATED_MESSAGE =
  'This account has been deactivated. You can restore it within 30 days by resetting your password.';

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return NextResponse.redirect(
      `${origin}/auth/login?login_error=${encodeURIComponent('Email and password are required')}`,
      303,
    );
  }

  // Use vanilla supabase-js (no SSR storage adapter) — we manage cookies
  // ourselves so there's no dependency on the async setAll subscriber chain
  // that the SSR client uses, which has timing issues with route handlers.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    const msg = error?.message || 'Sign in failed';
    const friendlyMsg = msg.toLowerCase().includes('banned') ? DEACTIVATED_MESSAGE : msg;
    return NextResponse.redirect(
      `${origin}/auth/login?login_error=${encodeURIComponent(friendlyMsg)}`,
      303,
    );
  }

  // Defensive: catch the zombie state where auth ban was lifted but
  // persons.deactivated_at is still set. The middleware would otherwise
  // bounce the user without explanation.
  try {
    const serviceClient = await createServiceClient();
    const { data: person } = await serviceClient
      .from('persons')
      .select('deactivated_at')
      .eq('id', data.session.user.id)
      .single();
    if (person?.deactivated_at) {
      return NextResponse.redirect(
        `${origin}/auth/login?login_error=${encodeURIComponent(DEACTIVATED_MESSAGE)}`,
        303,
      );
    }
  } catch {
    // If the check fails, allow login to proceed — the middleware's
    // deactivated check will catch it on the next request.
  }

  // Manually serialize the session into the exact cookie format that
  // @supabase/ssr's createServerClient expects to read. This bypasses
  // the SSR client's async storage flow entirely.
  //
  // Format (mirrors applyServerStorage in @supabase/ssr/cookies.js):
  //   key:   `sb-{projectRef}-auth-token` (chunked if > 3180 chars)
  //   value: `base64-{base64url(JSON.stringify(session))}`
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const sessionJson = JSON.stringify(data.session);
  const encodedValue = BASE64_PREFIX + stringToBase64URL(sessionJson);
  const chunks = createChunks(storageKey, encodedValue);

  const response = NextResponse.redirect(`${origin}/onboarding`, 303);
  for (const chunk of chunks) {
    response.cookies.set(chunk.name, chunk.value, DEFAULT_COOKIE_OPTIONS);
  }
  return response;
}
