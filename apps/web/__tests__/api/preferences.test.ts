import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET, PATCH } from '@/app/api/preferences/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: vi.fn() },
      serviceClient: { from: mockFrom, rpc: vi.fn() },
      ...overrides,
    },
  };
}

const DEFAULT_PREFS = {
  email_enabled: true,
  push_jobs: true,
  push_applications: true,
  push_messages: true,
  push_reminders: true,
};

function chainableBuilder(resolvedData: unknown, resolvedError: unknown = null) {
  const result = { data: resolvedData, error: resolvedError };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.upsert = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

function jsonRequest(method: string, body: Record<string, unknown>) {
  return new Request('http://localhost/api/preferences', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns default preferences when no row exists (upsert creates one)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const upsertBuilder = chainableBuilder(null);
    const selectBuilder = chainableBuilder(DEFAULT_PREFS);
    mockFrom.mockReturnValueOnce(upsertBuilder).mockReturnValueOnce(selectBuilder);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toEqual(DEFAULT_PREFS);
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      { person_id: 'u1' },
      { onConflict: 'person_id', ignoreDuplicates: true },
    );
  });

  it('returns existing preferences when row exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const existing = {
      email_enabled: false,
      push_jobs: false,
      push_applications: true,
      push_messages: true,
      push_reminders: false,
    };
    const upsertBuilder = chainableBuilder(null);
    const selectBuilder = chainableBuilder(existing);
    mockFrom.mockReturnValueOnce(upsertBuilder).mockReturnValueOnce(selectBuilder);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toEqual(existing);
  });
});

describe('PATCH /api/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await PATCH(jsonRequest('PATCH', { email_enabled: false }));
    expect(res.status).toBe(401);
  });

  it('updates a single field and returns updated preferences', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const updated = { ...DEFAULT_PREFS, push_jobs: false };
    const builder = chainableBuilder(updated);
    mockFrom.mockReturnValueOnce(builder);

    const res = await PATCH(jsonRequest('PATCH', { push_jobs: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toEqual(updated);
    expect(builder.upsert).toHaveBeenCalledWith(
      { person_id: 'u1', push_jobs: false },
      { onConflict: 'person_id' },
    );
  });

  it('updates multiple fields in one call', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    const updated = {
      email_enabled: false,
      push_jobs: false,
      push_applications: true,
      push_messages: true,
      push_reminders: true,
    };
    const builder = chainableBuilder(updated);
    mockFrom.mockReturnValueOnce(builder);

    const res = await PATCH(
      jsonRequest('PATCH', { email_enabled: false, push_jobs: false }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferences).toEqual(updated);
    expect(builder.upsert).toHaveBeenCalledWith(
      { person_id: 'u1', email_enabled: false, push_jobs: false },
      { onConflict: 'person_id' },
    );
  });

  it('rejects non-boolean value with 400', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(jsonRequest('PATCH', { push_jobs: 'yes' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('push_jobs');
    expect(body.error).toContain('boolean');
  });

  it('rejects body with no valid fields with 400', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const res = await PATCH(jsonRequest('PATCH', { invalid_field: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No valid fields');
  });
});
