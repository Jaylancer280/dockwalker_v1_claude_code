type SafeFetchSuccess<T> = { ok: true; data: T };
type SafeFetchError = { ok: false; error: string };
type SafeFetchResult<T> = SafeFetchSuccess<T> | SafeFetchError;

/**
 * Thin wrapper around fetch with timeout and safe error parsing.
 * Returns a discriminated union — never throws.
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 15000, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    // HTTP error — parse body safely
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    return { ok: false, error: body.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}
