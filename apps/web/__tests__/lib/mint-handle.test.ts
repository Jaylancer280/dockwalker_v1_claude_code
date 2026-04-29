import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mintHandle, randomHandle, MintHandleError } from '@/lib/cv/mint-handle';

type UpdateResult = { error: { code: string; message: string } | null };

function makeSupabase(updateSequence: UpdateResult[]): {
  client: SupabaseClient;
  calls: number;
} {
  let calls = 0;
  const client = {
    from: () => ({
      update: () => ({
        eq: () => {
          const result = updateSequence[calls] ?? { error: null };
          calls += 1;
          return Promise.resolve(result);
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return {
    client,
    get calls() {
      return calls;
    },
  };
}

describe('randomHandle', () => {
  it('returns 8-char alphanumeric by default', () => {
    const handle = randomHandle();
    expect(handle).toHaveLength(8);
    expect(handle).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('respects custom length', () => {
    expect(randomHandle(12)).toHaveLength(12);
  });

  it('produces different handles across calls', () => {
    const handles = new Set(Array.from({ length: 20 }, () => randomHandle()));
    expect(handles.size).toBeGreaterThan(15);
  });
});

describe('mintHandle', () => {
  it('returns the minted handle on first-attempt success', async () => {
    const harness = makeSupabase([{ error: null }]);
    const handle = await mintHandle(harness.client, 'p1');
    expect(handle).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(harness.calls).toBe(1);
  });

  it('retries on unique_violation (23505) and returns on next success', async () => {
    const harness = makeSupabase([
      { error: { code: '23505', message: 'duplicate key' } },
      { error: null },
    ]);
    const handle = await mintHandle(harness.client, 'p1');
    expect(handle).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(harness.calls).toBe(2);
  });

  it('throws non-23505 errors immediately without retrying', async () => {
    const harness = makeSupabase([
      { error: { code: '42703', message: 'column does not exist' } },
    ]);
    await expect(mintHandle(harness.client, 'p1')).rejects.toMatchObject({
      code: '42703',
    });
    expect(harness.calls).toBe(1);
  });

  it('gives up after 5 unique_violation retries with MintHandleError', async () => {
    const harness = makeSupabase(
      Array.from({ length: 6 }, () => ({
        error: { code: '23505', message: 'duplicate key' },
      })),
    );
    await expect(mintHandle(harness.client, 'p1')).rejects.toBeInstanceOf(
      MintHandleError,
    );
    expect(harness.calls).toBe(5);
  });

  it('writes cv_handle and cv_handle_updated_at on success', async () => {
    type UpdatePayload = { cv_handle: string; cv_handle_updated_at: string };
    const updateSpy = vi.fn((_payload: UpdatePayload) => {
      void _payload;
      return { eq: () => Promise.resolve({ error: null }) };
    });
    const client = {
      from: () => ({ update: updateSpy }),
    } as unknown as SupabaseClient;

    await mintHandle(client, 'p1');

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [payload] = updateSpy.mock.calls[0]!;
    expect(payload.cv_handle).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(typeof payload.cv_handle_updated_at).toBe('string');
    expect(() => new Date(payload.cv_handle_updated_at)).not.toThrow();
  });
});
