import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

// Import after mock setup
const { notifyOnEvent, broadcastQueue } = await import('@/lib/push-triggers');

function mockFrom(table: string, response: unknown) {
  return vi.fn().mockImplementation((t: string) => {
    if (t === table) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(response),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

function multiMockFrom(mocks: Record<string, unknown>) {
  return vi.fn().mockImplementation((table: string) => {
    const response = mocks[table];
    if (response) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(response),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };
  });
}

describe('notifyOnEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DAYWORK.APPLIED notifies employer with job number', async () => {
    const sc = {
      from: multiMockFrom({
        dayworks: { data: { job_number: 42, poster_person_id: 'emp1' }, error: null },
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(sc, 'DAYWORK.APPLIED', { daywork_id: 'dw1', crew_person_id: 'crew1' }, 'crew1');

    // Let the async resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'emp1',
      expect.objectContaining({
        title: 'New Applicant',
        body: expect.stringContaining('DW-00042'),
        data: expect.objectContaining({ screen: 'review', dayworkId: 'dw1' }),
      }),
    );
  });

  it('DAYWORK.ACCEPTED notifies crew with engagementId deep-link', async () => {
    const sc = {
      from: mockFrom('dayworks', { data: { job_number: 1 }, error: null }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'dw1', crew_person_id: 'crew1', employer_person_id: 'emp1', engagement_id: 'eng-42' },
      'emp1',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({
        title: 'Application Accepted',
        body: expect.stringContaining('accepted'),
        data: expect.objectContaining({ screen: 'chat', engagementId: 'eng-42' }),
      }),
    );
  });

  it('DAYWORK.REJECTED notifies crew', async () => {
    const sc = {
      from: mockFrom('dayworks', { data: { job_number: 5 }, error: null }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'DAYWORK.REJECTED',
      { daywork_id: 'dw1', crew_person_id: 'crew1' },
      'emp1',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({ title: 'Application Update' }),
    );
  });

  it('DAYWORK.SHORTLISTED notifies crew', async () => {
    const sc = {
      from: mockFrom('dayworks', { data: { job_number: 7 }, error: null }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'DAYWORK.SHORTLISTED',
      { daywork_id: 'dw1', crew_person_id: 'crew1' },
      'emp1',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({ title: 'Shortlisted' }),
    );
  });

  it('DAYWORK.INVITED notifies crew', async () => {
    const sc = {
      from: mockFrom('dayworks', { data: { job_number: 10 }, error: null }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'DAYWORK.INVITED',
      { daywork_id: 'dw1', crew_person_id: 'crew1' },
      'emp1',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({
        title: 'New Invitation',
        data: expect.objectContaining({ screen: 'discover', type: 'invitation' }),
      }),
    );
  });

  it('MESSAGE.SENT notifies the other party (not system messages)', async () => {
    const sc = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'active_engagements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { crew_person_id: 'crew1', employer_person_id: 'emp1', daywork_id: 'dw1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { display_name: 'Alice' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'MESSAGE.SENT',
      { engagement_id: 'eng1', sender_person_id: 'crew1', content: 'Hello there' },
      'crew1',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'emp1',
      expect.objectContaining({
        title: 'Alice',
        body: 'Hello there',
        data: expect.objectContaining({ screen: 'chat', engagementId: 'eng1' }),
      }),
    );
  });

  it('MESSAGE.SENT skips system messages', async () => {
    const sc = { from: vi.fn() } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(
      sc,
      'MESSAGE.SENT',
      { engagement_id: 'eng1', sender_person_id: 'sys', content: 'System', is_system: true },
      'sys',
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it('notification failure does not propagate', async () => {
    mockSendPushToUser.mockRejectedValueOnce(new Error('Push failed'));

    const sc = {
      from: multiMockFrom({
        dayworks: { data: { job_number: 1, poster_person_id: 'emp1' }, error: null },
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Should not throw
    notifyOnEvent(sc, 'DAYWORK.APPLIED', { daywork_id: 'dw1', crew_person_id: 'crew1' }, 'crew1');

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalled();
  });

  it('unknown event type returns empty (no notification)', async () => {
    const sc = { from: vi.fn() } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(sc, 'UNKNOWN.EVENT', {}, 'user1');

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it('DAYWORK.COMPLETED notifies crew', async () => {
    const sc = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'dayworks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { job_number: 3 },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'active_engagements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'eng1', crew_person_id: 'crew1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(sc, 'DAYWORK.COMPLETED', { daywork_id: 'dw1' }, 'emp1');

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({
        title: 'Job Completed',
        body: expect.stringContaining('please confirm'),
      }),
    );
  });

  it('CHECKLIST.SET notifies crew', async () => {
    const sc = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'active_engagements') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { crew_person_id: 'crew1', employer_person_id: 'emp1', daywork_id: 'dw1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'dayworks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { job_number: 15 },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    notifyOnEvent(sc, 'CHECKLIST.SET', { engagement_id: 'eng1' }, 'emp1');

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({
        title: 'Checklist Updated',
        body: expect.stringContaining('DW-00015'),
      }),
    );
  });
});

describe('DAYWORK.POSTED broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    broadcastQueue.clear();
  });

  afterEach(() => {
    // Clear any pending timers
    for (const entry of broadcastQueue.values()) {
      clearTimeout(entry.timer);
    }
    broadcastQueue.clear();
    vi.useRealTimers();
  });

  function makeBroadcastSc(overrides: Record<string, unknown> = {}) {
    const defaultAvailability = [
      { person_id: 'crew1' },
      { person_id: 'crew2' },
    ];
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'ports') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { city_id: 'city1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'availability_windows') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({
                    data: (overrides.availability ?? defaultAvailability) as unknown[],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'dayworks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: overrides.daywork ?? { job_number: 1, role_id: 'role1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'yacht_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { name: 'Deckhand' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'cities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { name: 'Antibes' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  it('enqueues broadcast on DAYWORK.POSTED and fires after 60s', async () => {
    const sc = makeBroadcastSc();

    notifyOnEvent(sc, 'DAYWORK.POSTED', { id: 'dw1', location_port_id: 'port1', role_id: 'role1' }, 'emp1');

    // Let the port→city resolution resolve
    await vi.advanceTimersByTimeAsync(10);

    expect(broadcastQueue.size).toBe(1);

    // Advance to 60s to fire
    await vi.advanceTimersByTimeAsync(60_000);

    expect(broadcastQueue.size).toBe(0);
    expect(mockSendPushToUser).toHaveBeenCalledTimes(2); // crew1 + crew2
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      'crew1',
      expect.objectContaining({
        title: 'New Daywork',
        body: expect.stringContaining('Deckhand'),
      }),
    );
  });

  it('excludes poster from broadcast recipients', async () => {
    const sc = makeBroadcastSc({
      availability: [{ person_id: 'emp1' }, { person_id: 'crew1' }],
    });

    notifyOnEvent(sc, 'DAYWORK.POSTED', { id: 'dw1', location_port_id: 'port1', role_id: 'role1' }, 'emp1');

    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(60_000);

    // Only crew1, not emp1 (the poster)
    expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
    expect(mockSendPushToUser).toHaveBeenCalledWith(sc, 'crew1', expect.anything());
  });

  it('does not notify when no crew have availability in city', async () => {
    const sc = makeBroadcastSc({ availability: [] });

    notifyOnEvent(sc, 'DAYWORK.POSTED', { id: 'dw1', location_port_id: 'port1', role_id: 'role1' }, 'emp1');

    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it('collapses multiple postings within 60s into single notification', async () => {
    const sc = makeBroadcastSc();

    // Post two dayworks quickly
    notifyOnEvent(sc, 'DAYWORK.POSTED', { id: 'dw1', location_port_id: 'port1', role_id: 'role1' }, 'emp1');
    await vi.advanceTimersByTimeAsync(10);

    notifyOnEvent(sc, 'DAYWORK.POSTED', { id: 'dw2', location_port_id: 'port1', role_id: 'role2' }, 'emp1');
    await vi.advanceTimersByTimeAsync(10);

    // Should still be queued
    expect(broadcastQueue.size).toBe(1);
    expect(broadcastQueue.get('city1')?.dayworkIds).toEqual(['dw1', 'dw2']);

    // Fire
    await vi.advanceTimersByTimeAsync(60_000);

    // Collapsed notification
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      sc,
      expect.any(String),
      expect.objectContaining({
        title: 'New Daywork',
        body: expect.stringContaining('2 new daywork opportunities'),
      }),
    );
  });
});
