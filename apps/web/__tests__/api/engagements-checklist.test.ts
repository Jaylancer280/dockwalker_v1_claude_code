import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as setChecklist } from '@/app/api/engagements/[id]/checklist/route';
import { POST as toggleItem } from '@/app/api/engagements/[id]/checklist/toggle/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

const mockFromAuth = vi.fn();
const mockRpc = vi.fn();

function makeChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data }),
      }),
    }),
  };
}

function guardOk(userId = 'emp1') {
  return {
    ok: true,
    value: {
      user: { id: userId },
      person: { id: userId, identity_type: 'crew', current_hat: 'employer' },
      profile: { person_id: userId },
      supabase: { from: mockFromAuth },
      serviceClient: { rpc: mockRpc },
    },
  };
}

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const activeEngagement = {
  id: 'e1',
  crew_person_id: 'crew1',
  employer_person_id: 'emp1',
  daywork_id: 'd1',
  status: 'active',
};

const validItems = [
  { id: 'arrival_time', label: 'Arrival time', value: '07:00' },
  { id: 'meeting_point', label: 'Meeting point', value: 'Starboard gangway' },
];

// ---------------------------------------------------------------------------
// POST /api/engagements/:id/checklist
// ---------------------------------------------------------------------------

describe('POST /api/engagements/:id/checklist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when engagement not found', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the employer', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain({ ...activeEngagement, status: 'cancelled' }));
    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when items is empty', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(makeRequest({ items: [] }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when items is not an array', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(makeRequest({ items: 'not-array' }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when item missing id', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(
      makeRequest({ items: [{ label: 'Test', value: 'val' }] }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when item value exceeds 500 chars', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(
      makeRequest({ items: [{ id: 'x', label: 'Test', value: 'a'.repeat(501) }] }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when item IDs are duplicated', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await setChecklist(
      makeRequest({
        items: [
          { id: 'same', label: 'A', value: 'x' },
          { id: 'same', label: 'B', value: 'y' },
        ],
      }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('creates checklist successfully (new)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    // Check if existing checklist
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(false);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe('CHECKLIST.SET');
    expect(events[0].payload.items).toEqual(validItems);
    expect(events[1].event_type).toBe('MESSAGE.SENT');
    expect(events[1].payload.content).toContain('set');
  });

  it('updates checklist successfully (existing)', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    // Check if existing checklist — found
    mockFromAuth.mockReturnValueOnce(makeChain({ engagement_id: 'e1' }));
    mockRpc.mockResolvedValueOnce({ data: ['ev1', 'ev2'], error: null });

    const res = await setChecklist(makeRequest({ items: validItems }), makeParams('e1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(true);

    const events = mockRpc.mock.calls[0][1].p_events;
    expect(events[1].payload.content).toContain('updated');
  });
});

// ---------------------------------------------------------------------------
// POST /api/engagements/:id/checklist/toggle
// ---------------------------------------------------------------------------

describe('POST /api/engagements/:id/checklist/toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockRequireDomainUser.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not the crew member', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('emp1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when engagement is not active', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain({ ...activeEngagement, status: 'completed' }));
    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when item_id is missing', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await toggleItem(makeRequest({ checked: true }), makeParams('e1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when checked is not a boolean', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: 'yes' }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when no checklist exists', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockFromAuth.mockReturnValueOnce(makeChain(null));
    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when item not found in checklist', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockFromAuth.mockReturnValueOnce(makeChain({ items: validItems }));
    const res = await toggleItem(
      makeRequest({ item_id: 'nonexistent', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(400);
  });

  it('toggles item successfully', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk('crew1'));
    mockFromAuth.mockReturnValueOnce(makeChain(activeEngagement));
    mockFromAuth.mockReturnValueOnce(makeChain({ items: validItems }));
    mockRpc.mockResolvedValueOnce({ data: 'ev1', error: null });

    const res = await toggleItem(
      makeRequest({ item_id: 'arrival_time', checked: true }),
      makeParams('e1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockRpc.mock.calls[0][1].p_payload.item_id).toBe('arrival_time');
    expect(mockRpc.mock.calls[0][1].p_payload.checked).toBe(true);
  });
});
