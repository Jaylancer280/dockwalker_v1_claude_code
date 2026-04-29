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
      requestHeaders.delete('x-blocked');

      // Set verified identity headers
      requestHeaders.set('x-user-id', user.id);

      // Try JWT claims for person identity (zero DB queries)
      const meta = user.app_metadata as
        | {
            person_id?: string;
            current_hat?: string;
            identity_type?: string;
            blocked?: boolean;
          }
        | undefined;
      if (meta?.person_id && meta?.current_hat && meta?.identity_type) {
        requestHeaders.set('x-person-id', meta.person_id);
        requestHeaders.set('x-current-hat', meta.current_hat);
        requestHeaders.set('x-identity-type', meta.identity_type);
        if (meta.blocked === true) {
          requestHeaders.set('x-blocked', 'true');
        }
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
    '/privacy',
    '/terms',
    '/ref/', // Reference consent landing — public so the share-link works for
    //         first-time visitors who don't have a DockWalker account yet.
    //         The page itself routes them to lightweight signup if needed.
    '/cv/', // QR-landing for printed CVs (spec §5). Public so a captain can
    //         scan the QR before signing up; the page itself shows a teaser
    //         when signed-out and the full profile when signed-in.
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
        is_admin?: boolean;
        blocked?: boolean;
      }
    | undefined;

  const hasClaims = !!(appMeta?.person_id && appMeta?.current_hat && appMeta?.identity_type);

  // Admin path guard: non-admins cannot access /admin/* pages.
  // Fast path reads is_admin from the JWT claim injected by 00105. Fallback DB
  // query covers sessions minted before 00105 shipped (up to ~1 hour).
  if (user && path.startsWith('/admin')) {
    let isAdmin = appMeta?.is_admin === true;
    if (!isAdmin && appMeta?.is_admin === undefined) {
      const adminCheck = await supabase
        .from('persons')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      isAdmin = adminCheck.data?.is_admin === true;
    }
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Blocked user redirect: send to /blocked page. Fast path reads the blocked
  // claim; falls back to DB for pre-hook sessions. Authoritative enforcement
  // still lives in the API layer (requireDomainUser) — middleware is UX only.
  if (
    user &&
    !isPublicRoute &&
    !isLandingPage &&
    !path.startsWith('/blocked') &&
    !path.startsWith('/support') &&
    appMeta?.person_id
  ) {
    let isBlocked = appMeta.blocked === true;
    if (!isBlocked && appMeta.blocked === undefined) {
      const blockedCheck = await supabase
        .from('persons')
        .select('blocked_at')
        .eq('id', appMeta.person_id)
        .single();
      isBlocked = !!blockedCheck.data?.blocked_at;
    }
    if (isBlocked) {
      const url = request.nextUrl.clone();
      url.pathname = '/blocked';
      return NextResponse.redirect(url);
    }
  }

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
      // Treat null current_hat as "not onboarded" — admin-scrubbed users keep
      // their profile row but have current_hat nulled, routing them back
      // through onboarding.
      onboarded = !!(person && profile && person.current_hat);

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
      // Phase 6: preserve the user's intended target as `?next=<path>` so
      // the onboarding page can route them back after completion. Skip
      // when the original target is itself /onboarding or a known root
      // surface — the user explicitly asked for /onboarding or didn't
      // pick a target.
      const originalPath = request.nextUrl.pathname;
      const originalQs = request.nextUrl.search;
      const skipNext =
        originalPath === '/' ||
        originalPath === '/dashboard' ||
        originalPath.startsWith('/onboarding');
      url.pathname = '/onboarding';
      url.search = '';
      if (!skipNext) {
        url.searchParams.set('next', originalPath + originalQs);
      }
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

  // On onboarding page — check deactivated first, then redirect if already onboarded
  if (user && path.startsWith('/onboarding')) {
    // Deactivated users must not proceed through onboarding
    if (hasClaims && appMeta!.deactivated) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }

    let currentHat: string | null = null;
    let onboarded = false;

    if (hasClaims) {
      currentHat = appMeta!.current_hat!;
      onboarded = appMeta!.onboarded === true;
    } else {
      const { data: person } = await supabase
        .from('persons')
        .select('id, current_hat, identity_type, deactivated_at')
        .eq('id', user.id)
        .single();

      // DB fallback deactivation check for onboarding path
      if (person?.deactivated_at) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('person_id')
        .eq('person_id', user.id)
        .single();

      currentHat = person?.current_hat ?? null;
      onboarded = !!(person && profile && person.current_hat);
    }

    if (onboarded) {
      const url = request.nextUrl.clone();
      url.pathname = currentHat === 'crew' ? '/discover' : '/daywork/mine';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
