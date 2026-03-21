import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the push-triggers module by calling notifyOnEvent and verifying
// that it calls sendPushToUser with the right arguments for each permanent event.

const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/send', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock the Supabase client returned by the service client
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockAuth = { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'test@test.com' } } }) } };

function makeSc() {
  return { from: mockFrom, rpc: mockRpc, auth: mockAuth } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

// Simple chain builder
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(data: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.neq = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockReturnValue(c);
  c.single = vi.fn().mockResolvedValue({ data });
  return c;
}

import { notifyOnEvent } from '@/lib/push-triggers';

describe('Permanent notification triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PERMANENT.APPLIED notifies employer', async () => {
    // Posting lookup
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 1, yacht_roles: { name: 'Captain' } }));
    // Actor display name
    mockFrom.mockReturnValueOnce(chain({ display_name: 'Crew Joe' }));
    // Notifications insert
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.APPLIED', { permanent_posting_id: 'pp1', crew_person_id: 'c1' }, 'c1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('emp1');
  });

  it('PERMANENT.SHORTLISTED notifies crew', async () => {
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 2, yacht_roles: { name: 'Deckhand' } }));
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.SHORTLISTED', { permanent_posting_id: 'pp1', crew_person_id: 'c1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('c1');
  });

  it('PERMANENT.SELECTED notifies crew with engagement deep link', async () => {
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 3, yacht_roles: { name: 'Engineer' } }));
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.SELECTED', { permanent_posting_id: 'pp1', crew_person_id: 'c1', engagement_id: 'eng1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('c1');
    expect(mockSendPushToUser.mock.calls[0][2].data.engagementId).toBe('eng1');
  });

  it('PERMANENT.REJECTED notifies crew', async () => {
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 4, yacht_roles: { name: 'Stewardess' } }));
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.REJECTED', { permanent_posting_id: 'pp1', crew_person_id: 'c1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('c1');
  });

  it('PERMANENT.PLACEMENT_CONFIRMED notifies placed crew AND remaining', async () => {
    // Posting info
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 5, yacht_roles: { name: 'Chef' } }));
    // Active engagement → placed crew
    mockFrom.mockReturnValueOnce(chain({ crew_person_id: 'c1' }));
    // Not-selected applications (select → eq → eq resolves)
    const innerEq = vi.fn().mockResolvedValue({ data: [{ crew_person_id: 'c2' }, { crew_person_id: 'c3' }] });
    mockFrom.mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: innerEq }) }) });
    // Notifications insert (multiple calls)
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.PLACEMENT_CONFIRMED', { permanent_posting_id: 'pp1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    // Should have 3 push calls: placed crew + 2 not-selected
    expect(mockSendPushToUser.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('PERMANENT.SELECTION_REVERTED notifies previously selected crew', async () => {
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 6, yacht_roles: { name: 'Bosun' } }));
    mockFrom.mockReturnValueOnce(chain({ crew_person_id: 'c1', employer_person_id: 'emp1', daywork_id: null, permanent_posting_id: 'pp1' }));
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.SELECTION_REVERTED', { permanent_posting_id: 'pp1', engagement_id: 'eng1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('c1');
  });

  it('PERMANENT.CANCELLED_BY_EMPLOYER notifies all applicants', async () => {
    mockFrom.mockReturnValueOnce(chain({ employer_person_id: 'emp1', job_number: 7, yacht_roles: { name: 'Captain' } }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appsChain: any = {};
    appsChain.select = vi.fn().mockReturnValue(appsChain);
    appsChain.eq = vi.fn().mockReturnValue(appsChain);
    appsChain.neq = vi.fn().mockResolvedValue({ data: [{ crew_person_id: 'c1' }, { crew_person_id: 'c2' }] });
    mockFrom.mockReturnValueOnce(appsChain);
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.CANCELLED_BY_EMPLOYER', { permanent_posting_id: 'pp1' }, 'emp1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('PERMANENT.ENGAGEMENT_CLOSED notifies other party', async () => {
    mockFrom.mockReturnValueOnce(chain({ crew_person_id: 'c1', employer_person_id: 'emp1', daywork_id: null, permanent_posting_id: 'pp1' }));
    mockFrom.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }) });

    notifyOnEvent(makeSc(), 'PERMANENT.ENGAGEMENT_CLOSED', { engagement_id: 'eng1', outcome: 'withdrew', closed_by: 'crew' }, 'c1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendPushToUser.mock.calls[0][1]).toBe('emp1');
  });

  it('PERMANENT.APPLICATION_BLOCKED does NOT generate notification', async () => {
    notifyOnEvent(makeSc(), 'PERMANENT.APPLICATION_BLOCKED', { crew_person_id: 'c1', permanent_posting_id: 'pp1' }, 'c1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it('PERMANENT.WITHDRAWN does NOT generate notification', async () => {
    notifyOnEvent(makeSc(), 'PERMANENT.WITHDRAWN', { crew_person_id: 'c1', permanent_posting_id: 'pp1' }, 'c1');
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});
