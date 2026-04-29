import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockAppendEvent = vi.fn().mockResolvedValue('evt-1');
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockMintHandle = vi.fn();
vi.mock('@/lib/cv/mint-handle', () => {
  // Defined inside factory because vi.mock is hoisted above the imports —
  // top-level class would be in the temporal dead zone here.
  class MintHandleError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'MintHandleError';
    }
  }
  return {
    mintHandle: (...args: unknown[]) => mockMintHandle(...args),
    MintHandleError,
  };
});

import { POST } from '@/app/api/admin/cv/mint-handle/[personId]/route';
import { MintHandleError } from '@/lib/cv/mint-handle';

const mockServiceFrom = vi.fn();
function adminOk() {
  return {
    ok: true,
    value: {
      user: { id: 'admin-1' },
      person: { id: 'admin-1', identity_type: 'crew', current_hat: 'employer', is_admin: true },
      profile: { person_id: 'admin-1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockServiceFrom },
    },
  };
}

function makeParams(personId: string) {
  return { params: Promise.resolve({ personId }) };
}

function profileChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

const request = new Request('http://localhost/api/admin/cv/mint-handle/target-1', {
  method: 'POST',
});

describe('POST /api/admin/cv/mint-handle/[personId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 when caller is not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    });
    const res = await POST(request, makeParams('target-1'));
    expect(res.status).toBe(403);
    expect(mockMintHandle).not.toHaveBeenCalled();
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('returns 404 when target profile is missing', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue(profileChain(null, { code: 'PGRST116' }));
    const res = await POST(request, makeParams('missing'));
    expect(res.status).toBe(404);
    expect(mockMintHandle).not.toHaveBeenCalled();
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('returns 409 when target already has cv_handle', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue(
      profileChain({ person_id: 'target-1', cv_handle: 'existingH' }),
    );
    const res = await POST(request, makeParams('target-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.handle).toBe('existingH');
    expect(mockMintHandle).not.toHaveBeenCalled();
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('mints handle, fires CV.HANDLE_REGENERATED with old_handle=null, returns 201', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue(
      profileChain({ person_id: 'target-1', cv_handle: null }),
    );
    mockMintHandle.mockResolvedValue('NeWhAndL');

    const res = await POST(request, makeParams('target-1'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.handle).toBe('NeWhAndL');

    expect(mockMintHandle).toHaveBeenCalledTimes(1);
    expect(mockAppendEvent).toHaveBeenCalledTimes(1);
    const eventArgs = mockAppendEvent.mock.calls[0]![1];
    expect(eventArgs.eventType).toBe('CV.HANDLE_REGENERATED');
    expect(eventArgs.aggregateId).toBe('target-1');
    expect(eventArgs.aggregateType).toBe('person');
    expect(eventArgs.payload).toEqual({ old_handle: null, new_handle: 'NeWhAndL' });
    expect(eventArgs.personId).toBe('admin-1');
  });

  it('returns 500 with MintHandleError detail when retries exhaust', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue(
      profileChain({ person_id: 'target-1', cv_handle: null }),
    );
    mockMintHandle.mockRejectedValue(new MintHandleError('exhausted retry budget (5)'));

    const res = await POST(request, makeParams('target-1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/exhausted/);
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('returns 500 on unknown errors thrown during mint', async () => {
    mockRequireAdmin.mockResolvedValue(adminOk());
    mockServiceFrom.mockReturnValue(
      profileChain({ person_id: 'target-1', cv_handle: null }),
    );
    mockMintHandle.mockRejectedValue(new Error('unexpected'));

    const res = await POST(request, makeParams('target-1'));
    expect(res.status).toBe(500);
  });
});
