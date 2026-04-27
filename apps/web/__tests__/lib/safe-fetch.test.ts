import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch } from '@/lib/safe-fetch';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('safeFetch', () => {
  it('returns { ok: true, data } on successful fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ success: true, id: '123' })),
    });

    const result = await safeFetch('/api/test');
    expect(result).toEqual({ ok: true, data: { success: true, id: '123' } });
  });

  it('returns { ok: false, error } on HTTP 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: 'Invalid input' })),
    });

    const result = await safeFetch('/api/test');
    expect(result).toEqual({ ok: false, error: 'Invalid input', status: 400 });
  });

  it('redirects to login on HTTP 401 (default)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: 'Unauthorized' })),
    });

    const result = await safeFetch('/api/test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/session expired/i);
    }
    expect(window.location.href).toBe('/auth/login');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('returns 401 as a normal error when skipAuthRedirect is true (form-modal context)', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: 'http://localhost/daywork/post' },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: 'Unauthorized' })),
    });

    const result = await safeFetch('/api/test', { skipAuthRedirect: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/session expired/i);
    }
    // Critically: the browser was NOT redirected away from the form.
    expect(window.location.href).toBe('http://localhost/daywork/post');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('returns network error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await safeFetch('/api/test');
    expect(result).toEqual({ ok: false, error: 'Network error — check your connection' });
  });

  it('returns network error on timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      // Simulate a request that respects abort signal
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    });

    const result = await safeFetch('/api/test', { timeoutMs: 50 });
    expect(result).toEqual({ ok: false, error: 'Request timed out — try again' });
  });
});
