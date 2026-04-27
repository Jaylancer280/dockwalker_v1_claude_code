import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '@/app/api/account/export/route';

const mockRequireDomainUser = vi.fn();
vi.mock('@/lib/auth/require-domain-user', () => ({
  requireDomainUser: (...args: unknown[]) => mockRequireDomainUser(...args),
}));

vi.mock('@/lib/crypto', () => ({
  decryptPhone: vi.fn().mockReturnValue('+33612345678'),
}));

const mockFrom = vi.fn();

function guardOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    value: {
      user: { id: 'u1' },
      person: { id: 'u1', identity_type: 'crew', current_hat: 'crew' },
      profile: { person_id: 'u1' },
      supabase: { from: mockFrom },
      serviceClient: { rpc: vi.fn() },
      ...overrides,
    },
  };
}

// Helper to create a chainable mock for Supabase queries
function chainMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.eq = handler;
  chain.or = handler;
  chain.in = handler;
  chain.order = handler;
  chain.single = () => Promise.resolve(result);
  // For queries that don't end with .single()
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

describe('GET /api/account/export', () => {
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

  it('returns exported data with all sections including experiences and applications', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    const profileData = { person_id: 'u1', display_name: 'Test User' };
    const eventsData = [{ id: 'e1', event_type: 'PERSON.CREATED' }];
    const messagesData = [{ id: 'm1', content: 'Hello' }];
    const engagementsData = [{ id: 'eng1', status: 'active' }];
    const availData = [{ id: 'a1', date: '2026-03-15' }];
    const vesselsData = [{ id: 'v1', name: 'Test Vessel' }];
    const prefsData = { profile_visible: true };
    const experiencesData = [{ id: 'exp1', vessel_id: 'v1', role_id: 'r1' }];
    const applicationsData = [{ id: 'app1', daywork_id: 'd1', status: 'applied' }];
    const invitationsData = [{ id: 'inv1', daywork_id: 'd1', status: 'pending' }];
    const ratingsData = [{ id: 'rat1', engagement_id: 'eng1' }];
    const deviceTokensData = [{ id: 'dt1', platform: 'apns' }];
    const advisorConvsData = [{ id: 'ac1', title: 'Test' }];

    let callIndex = 0;
    const results = [
      chainMock({ data: profileData, error: null }),        // profiles
      chainMock({ data: eventsData, error: null }),          // events
      chainMock({ data: messagesData, error: null }),        // messages
      chainMock({ data: engagementsData, error: null }),     // active_engagements
      chainMock({ data: availData, error: null }),           // availability_windows
      chainMock({ data: vesselsData, error: null }),         // vessels
      chainMock({ data: prefsData, error: null }),           // user_preferences
      chainMock({ data: experiencesData, error: null }),     // crew_experiences
      chainMock({ data: applicationsData, error: null }),    // applications
      chainMock({ data: invitationsData, error: null }),     // daywork_invitations
      chainMock({ data: ratingsData, error: null }),         // engagement_ratings
      chainMock({ data: deviceTokensData, error: null }),    // device_tokens
      chainMock({ data: advisorConvsData, error: null }),    // advisor_conversations
      chainMock({ data: [], error: null }),                    // permanent_postings
      chainMock({ data: [], error: null }),                     // references (requester)
      chainMock({ data: [], error: null }),                     // references (referee)
      chainMock({ data: [], error: null }),                     // reference_contacts (employer)
      chainMock({ data: null, error: null }),                   // notification_channels (WhatsApp)
      chainMock({ data: [], error: null }),                     // engagement_documents
    ];
    mockFrom.mockImplementation(() => results[callIndex++]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.person_id).toBe('u1');
    expect(body.exported_at).toBeDefined();
    expect(body.profile).toEqual(profileData);
    expect(body.events).toEqual(eventsData);
    expect(body.messages).toEqual(messagesData);
    expect(body.engagements).toEqual(engagementsData);
    expect(body.availability).toEqual(availData);
    expect(body.vessels).toEqual(vesselsData);
    expect(body.preferences).toEqual(prefsData);
    expect(body.experiences).toEqual(experiencesData);
    expect(body.applications).toEqual(applicationsData);
    expect(body.invitations).toEqual(invitationsData);
    expect(body.ratings).toEqual(ratingsData);
    expect(body.device_tokens).toEqual(deviceTokensData);
    expect(body.advisor_conversations).toEqual(advisorConvsData);
    expect(body.references).toEqual({ outbound: [], inbound: [] });
    expect(body.reference_contacts).toEqual({ as_employer: [], as_referee: [] });

    expect(mockFrom).toHaveBeenCalledTimes(19);
  });

  it('returns empty arrays when user has no data', async () => {
    mockRequireDomainUser.mockResolvedValue(guardOk());

    let callIndex = 0;
    const results = Array.from({ length: 19 }, () =>
      chainMock({ data: null, error: null }),
    );
    mockFrom.mockImplementation(() => results[callIndex++]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.profile).toBeNull();
    expect(body.preferences).toBeNull();
    expect(body.events).toEqual([]);
    expect(body.messages).toEqual([]);
    expect(body.engagements).toEqual([]);
    expect(body.availability).toEqual([]);
    expect(body.vessels).toEqual([]);
    expect(body.experiences).toEqual([]);
    expect(body.applications).toEqual([]);
    expect(body.invitations).toEqual([]);
    expect(body.ratings).toEqual([]);
    expect(body.device_tokens).toEqual([]);
    expect(body.advisor_conversations).toEqual([]);
  });
});
