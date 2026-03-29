import { supabase } from './supabase';

type ApiSuccess<T> = { ok: true; data: T };
type ApiError = { ok: false; error: string };
type ApiResult<T> = ApiSuccess<T> | ApiError;

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Authenticated GET from the Vercel API.
 * Used for complex read endpoints where duplicating query logic is impractical.
 */
export async function apiGet<T = unknown>(
  path: string,
): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    return { ok: false, error: parsed.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticated POST to the Vercel API.
 * All mobile writes go through this — reads go direct to Supabase.
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    return { ok: false, error: parsed.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticated PATCH to the Vercel API.
 * Used for partial updates (profile, experiences, vessels).
 */
export async function apiPatch<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    return { ok: false, error: parsed.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticated DELETE to the Vercel API.
 */
export async function apiDelete<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    return { ok: false, error: parsed.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticated multipart upload to the Vercel API.
 * Used for avatar upload (POST /api/profile/avatar).
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<ApiResult<T>> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, data };
    }

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    return { ok: false, error: parsed.error ?? 'Something went wrong' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  } finally {
    clearTimeout(timeout);
  }
}
