import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // API routes: pass identity via request headers so auth guard can skip getUser()
  if (path.startsWith('/api/')) {
    if (user) {
      // Strip any spoofed headers from the incoming request
      const requestHeaders = new Headers(request.headers);
      requestHeaders.delete('x-user-id');
      requestHeaders.delete('x-person-id');
      requestHeaders.delete('x-current-hat');
      requestHeaders.delete('x-identity-type');

      // Set verified identity headers
      requestHeaders.set('x-user-id', user.id);

      // Try JWT claims for person identity (zero DB queries)
      const meta = user.app_metadata as
        | { person_id?: string; current_hat?: string; identity_type?: string }
        | undefined;
      if (meta?.person_id && meta?.current_hat && meta?.identity_type) {
        requestHeaders.set('x-person-id', meta.person_id);
        requestHeaders.set('x-current-hat', meta.current_hat);
        requestHeaders.set('x-identity-type', meta.identity_type);
      }

      // Create new response with the modified request headers
      supabaseResponse = NextResponse.next({
        request: { headers: requestHeaders },
      });
      // Preserve cookies from the original response
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        supabaseResponse.headers.set('cookie', cookieHeader);
      }
    }
    return supabaseResponse;
  }

  // Routes that redirect authenticated users to the app
  const authEntryRoutes = ['/auth/login', '/auth/signup'];
  // All public routes (no auth required)
  const publicRoutes = [
    ...authEntryRoutes,
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicRoute =
    publicRoutes.some((route) => path.startsWith(route)) || path.startsWith('/jobs');
  const isAuthEntryRoute = authEntryRoutes.some((route) => path.startsWith(route));
  const isLandingPage = path === '/';

  // Not authenticated → redirect to login (unless on public route or landing page)
  if (!user && !isPublicRoute && !isLandingPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Authenticated on login/signup → redirect to app (but NOT on reset-password or forgot-password)
  if (user && isAuthEntryRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  // Try to read identity from JWT custom claims (injected by custom_access_token_hook)
  // Falls back to DB query if claims are missing (pre-hook sessions, onboarding in progress)
  const appMeta = user?.app_metadata as
    | {
        person_id?: string;
        current_hat?: string;
        identity_type?: string;
        onboarded?: boolean;
        deactivated?: boolean;
      }
    | undefined;

  const hasClaims = !!(appMeta?.person_id && appMeta?.current_hat && appMeta?.identity_type);

  // Authenticated: check onboarding status
  if (user && !isPublicRoute && !path.startsWith('/onboarding')) {
    let currentHat: string | null = null;
    let identityType: string | null = null;
    let onboarded = false;

    if (hasClaims) {
      // Fast path: read from JWT claims (zero DB queries)
      currentHat = appMeta!.current_hat!;
      identityType = appMeta!.identity_type!;
      onboarded = appMeta!.onboarded === true;

      // Deactivated users: sign out and redirect to login
      if (appMeta!.deactivated) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
      }
    } else {
      // Fallback: DB query (backward compat for sessions minted before hook was enabled)
      const [{ data: person }, { data: profile }] = await Promise.all([
        supabase
          .from('persons')
          .select('id, current_hat, identity_type, deactivated_at')
          .eq('id', user.id)
          .single(),
        supabase.from('profiles').select('person_id').eq('person_id', user.id).single(),
      ]);
      currentHat = person?.current_hat ?? null;
      identityType = person?.identity_type ?? null;
      onboarded = !!(person && profile);

      // Deactivated users: sign out and redirect to login
      if (person?.deactivated_at) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
      }
    }

    if (!onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Hat-routed landing: redirect /dashboard (and /) to the primary action surface
    if (path === '/dashboard' || path === '/') {
      const url = request.nextUrl.clone();
      url.pathname = currentHat === 'crew' ? '/discover' : '/daywork/mine';
      return NextResponse.redirect(url);
    }

    // Agent cannot access crew discover — redirect to market feed
    if (identityType === 'agent' && path === '/discover') {
      const url = request.nextUrl.clone();
      url.pathname = '/discover/market';
      return NextResponse.redirect(url);
    }

    // Employer hat cannot access crew discover — redirect to mine
    if (currentHat === 'employer' && path === '/discover') {
      const url = request.nextUrl.clone();
      url.pathname = '/daywork/mine';
      return NextResponse.redirect(url);
    }

    // Crew cannot access employer review pages — redirect to discover
    if (
      currentHat === 'crew' &&
      (/^\/daywork\/[^/]+\/review/.test(path) || /^\/permanent\/[^/]+\/review/.test(path))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/discover';
      return NextResponse.redirect(url);
    }
  }

  // On onboarding page but already onboarded → redirect by hat
  if (user && path.startsWith('/onboarding')) {
    let currentHat: string | null = null;
    let onboarded = false;

    if (hasClaims) {
      currentHat = appMeta!.current_hat!;
      onboarded = appMeta!.onboarded === true;
    } else {
      const { data: person } = await supabase
        .from('persons')
        .select('id, current_hat, identity_type')
        .eq('id', user.id)
        .single();

      const { data: profile } = await supabase
        .from('profiles')
        .select('person_id')
        .eq('person_id', user.id)
        .single();

      currentHat = person?.current_hat ?? null;
      onboarded = !!(person && profile);
    }

    if (onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = currentHat === 'crew' ? '/discover' : '/daywork/mine';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
