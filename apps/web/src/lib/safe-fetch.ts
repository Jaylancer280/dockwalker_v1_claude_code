type SafeFetchSuccess<T> = { ok: true; data: T };
type SafeFetchError = { ok: false; error: string; status?: number };
type SafeFetchResult<T> = SafeFetchSuccess<T> | SafeFetchError;

/**
 * Resolve a relative URL to an absolute URL.
 * In Capacitor (NEXT_PUBLIC_API_BASE_URL set), relative /api/* calls
 * are prefixed with the server URL so they reach Vercel.
 * In browser (no prefix), relative URLs work as-is.
 */
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
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 15000, ...fetchInit } = init ?? {};
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

    // 401 — session expired, redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/auth/login';
      return { ok: false, error: 'Session expired', status: 401 };
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
