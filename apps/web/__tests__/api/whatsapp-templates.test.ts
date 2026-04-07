import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock whatsapp send
const mockSendWhatsApp = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/whatsapp', () => ({
  sendWhatsApp: (...args: unknown[]) => mockSendWhatsApp(...args),
}));

// Mock loaders
vi.mock('@/lib/push-triggers/loaders', () => ({
  getJobNumber: vi.fn().mockResolvedValue('PM-00045'),
  getDisplayName: vi.fn().mockResolvedValue('Sophie'),
  getPermanentPostingInfo: vi.fn().mockResolvedValue({
    employer_person_id: 'emp1',
    role_name: 'Chief Stewardess',
    job_number: 'PM-00045',
  }),
}));

import { sendWhatsAppForEvent } from '@/lib/push-triggers/whatsapp-dispatcher';

const mockFrom = vi.fn();
const sc = { from: mockFrom } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function chainable(data: unknown = null) {
  const result = { data, error: null };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.neq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

describe('WhatsApp template resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(chainable());
  });

  it('PERMANENT.CANCELLED_BY_EMPLOYER uses pm_posting_cancelled template', async () => {
    const phoneBuf = Buffer.from('encrypted');
    const ctx = {
      recipientPersonId: 'crew1',
      notification: { title: 'Posting Closed', body: 'Chief Stewardess posting has been closed' },
      roleContext: 'crew' as const,
    };

    await sendWhatsAppForEvent(
      sc,
      'PERMANENT.CANCELLED_BY_EMPLOYER',
      { permanent_posting_id: 'pp1' },
      ctx,
      phoneBuf,
    );

    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      phoneBuf,
      'pm_posting_cancelled',
      ['Chief Stewardess', 'PM-00045'],
      expect.stringContaining('/discover'),
    );
  });

  it('PERMANENT.PLACEMENT_CONFIRMED uses pm_placement_confirmed for placed crew', async () => {
    const phoneBuf = Buffer.from('encrypted');
    const ctx = {
      recipientPersonId: 'crew1',
      notification: { title: 'Placement Confirmed', body: 'Your placement as Chief Stewardess is confirmed' },
      roleContext: 'crew' as const,
    };

    await sendWhatsAppForEvent(
      sc,
      'PERMANENT.PLACEMENT_CONFIRMED',
      { permanent_posting_id: 'pp1', engagement_id: 'eng1' },
      ctx,
      phoneBuf,
    );

    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      phoneBuf,
      'pm_placement_confirmed',
      ['Chief Stewardess', 'PM-00045'],
      expect.stringContaining('/messages/eng1'),
    );
  });

  it('PERMANENT.PLACEMENT_CONFIRMED uses pm_position_filled for not-selected crew', async () => {
    const phoneBuf = Buffer.from('encrypted');
    const ctx = {
      recipientPersonId: 'crew2',
      notification: { title: 'Position Filled', body: 'The Chief Stewardess position has been filled' },
      roleContext: 'crew' as const,
    };

    await sendWhatsAppForEvent(
      sc,
      'PERMANENT.PLACEMENT_CONFIRMED',
      { permanent_posting_id: 'pp1', engagement_id: 'eng1' },
      ctx,
      phoneBuf,
    );

    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      phoneBuf,
      'pm_position_filled',
      ['Chief Stewardess', 'PM-00045'],
      expect.stringContaining('/discover'),
    );
  });
});
