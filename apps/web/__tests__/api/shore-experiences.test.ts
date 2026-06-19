import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockAppendEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@dockwalker/db', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockFrom = vi.fn();
const mockServiceFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      supabase: { from: mockFrom },
      serviceClient: { from: mockServiceFrom },
      ...overrides,
    },
  };
}

function mockChain(data: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const resolve = () => Promise.resolve({ data, error: null });
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(resolve);
  chain.then = vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    resolve().then(cb),
  );
  return chain;
}

describe('Shore Experiences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shore-experiences', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireDomainUser.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      });

      const { GET } = await import('@/app/api/shore-experiences/route');
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns 200 with shore experiences', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockFrom.mockReturnValueOnce(
        mockChain([
          {
            id: 'se1',
            category_id: 'cat1',
            employer_name: 'Hilton',
            job_title: 'Front Desk',
            start_date: '2022-01-01',
            end_date: '2023-06-01',
            is_current: false,
            description: null,
            shore_experience_categories: { id: 'cat1', name: 'Hospitality & Hotels' },
          },
        ]),
      );

      const { GET } = await import('@/app/api/shore-experiences/route');
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.experiences).toHaveLength(1);
      expect(body.experiences[0].employer_name).toBe('Hilton');
    });
  });

  describe('POST /api/shore-experiences', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireDomainUser.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      });

      const { POST } = await import('@/app/api/shore-experiences/route');
      const res = await POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({}),
        }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when required fields missing', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());

      const { POST } = await import('@/app/api/shore-experiences/route');
      const res = await POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({ categoryId: 'cat1' }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid category', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockServiceFrom.mockReturnValueOnce(mockChain(null));

      const { POST } = await import('@/app/api/shore-experiences/route');
      const res = await POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: 'bad-id',
            employerName: 'Test',
            jobTitle: 'Manager',
            startDate: '2022-01-01',
          }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid category');
    });

    it('returns 201 on success', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockServiceFrom.mockReturnValueOnce(mockChain({ id: 'cat1' }));

      const { POST } = await import('@/app/api/shore-experiences/route');
      const res = await POST(
        new Request('http://localhost', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: 'cat1',
            employerName: 'Hilton',
            jobTitle: 'Front Desk',
            startDate: '2022-01-01',
            endDate: '2023-06-01',
            description: 'Great experience',
          }),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'SHORE_EXPERIENCE.ADDED',
          aggregateType: 'shore_experience',
          payload: expect.objectContaining({
            employer_name: 'Hilton',
            job_title: 'Front Desk',
          }),
        }),
      );
    });
  });

  describe('PATCH /api/shore-experiences/[id]', () => {
    it('returns 404 for non-existent entry', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockFrom.mockReturnValueOnce(mockChain(null));

      const { PATCH } = await import('@/app/api/shore-experiences/[id]/route');
      const res = await PATCH(
        new Request('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ employerName: 'New Name' }),
        }),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      );
      expect(res.status).toBe(404);
    });

    it('returns 200 on successful update', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockFrom.mockReturnValueOnce(mockChain({ id: 'se1' }));

      const { PATCH } = await import('@/app/api/shore-experiences/[id]/route');
      const res = await PATCH(
        new Request('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ employerName: 'Updated Corp' }),
        }),
        { params: Promise.resolve({ id: 'se1' }) },
      );
      expect(res.status).toBe(200);
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'SHORE_EXPERIENCE.UPDATED',
          aggregateType: 'shore_experience',
          payload: expect.objectContaining({ employer_name: 'Updated Corp' }),
        }),
      );
    });
  });

  describe('DELETE /api/shore-experiences/[id]', () => {
    it('returns 404 for non-existent entry', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockFrom.mockReturnValueOnce(mockChain(null));

      const { DELETE } = await import('@/app/api/shore-experiences/[id]/route');
      const res = await DELETE(
        new Request('http://localhost', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      );
      expect(res.status).toBe(404);
    });

    it('returns 200 on successful delete', async () => {
      mockRequireDomainUser.mockResolvedValue(guardOk());
      mockFrom.mockReturnValueOnce(mockChain({ id: 'se1' }));

      const { DELETE } = await import('@/app/api/shore-experiences/[id]/route');
      const res = await DELETE(
        new Request('http://localhost', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'se1' }) },
      );
      expect(res.status).toBe(200);
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'SHORE_EXPERIENCE.REMOVED',
          aggregateType: 'shore_experience',
        }),
      );
    });
  });
});
