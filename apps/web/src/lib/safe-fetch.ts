type SafeFetchSuccess<T> = { ok: true; data: T };
type SafeFetchError = { ok: false; error: string; status?: number };
type SafeFetchResult<T> = SafeFetchSuccess<T> | SafeFetchError;

// When NEXT_PUBLIC_API_BASE_URL is set, prefix relative /api/* calls so
// they reach an absolute origin. Useful for any future cross-origin client
// (web push worker, edge function caller). Same-origin browser calls leave
// the path untouched.
function resolveUrl(url: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (base && url.startsWith('/')) {
    return `${base}${url}`;
  }
  return url;
}

/**
 * Thin wrapper around fetch with timeout and safe error parsing.
 * Returns a discriminated union — never throws.
 *
 * Auth handling (`skipAuthRedirect`):
 *   - **Default (false):** a 401 hard-redirects the browser to `/auth/login`.
 *     Use for navigation-style fetches (page loads, list refreshes) where
 *     dropping the user back at sign-in is the right recovery.
 *   - **`skipAuthRedirect: true`:** a 401 is returned as a normal error
 *     result. Use inside form modals so a stale-session response surfaces
 *     as a toast — the user keeps their typed-in data and can re-auth in
 *     another tab. Without this, mid-form 401s wipe the form on redirect
 *     (and on group-routed pages, dump the user back at the route's
 *     entry state — e.g. the daywork-vs-permanent type selector).
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number; skipAuthRedirect?: boolean },
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 15000, skipAuthRedirect = false, ...fetchInit } = init ?? {};
  url = resolveUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    // 401 — session expired
    if (res.status === 401) {
      if (!skipAuthRedirect && typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return {
        ok: false,
        error: 'Your session expired — please sign in again',
        status: 401,
      };
    }

    // HTTP error — parse body safely
    const text = await res.text();
    const body = (() => {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return {};
      }
    })();
    if (res.status >= 500) {
      return {
        ok: false,
        error: body.error ?? 'Server error — try again in a moment',
        status: res.status,
      };
    }
    return { ok: false, error: body.error ?? 'Something went wrong', status: res.status };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out — try again' };
    }
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}
