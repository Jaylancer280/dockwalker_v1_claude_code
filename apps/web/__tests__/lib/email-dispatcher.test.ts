import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock loaders ---
const mockGetDisplayName = vi.fn().mockResolvedValue('Jane Doe');
const mockGetJobNumber = vi.fn().mockResolvedValue('DW-00042');
const mockGetRecipientEmail = vi.fn().mockResolvedValue('crew@example.com');
const mockGetPermanentPostingInfo = vi.fn().mockResolvedValue({
  role_name: 'Chief Engineer',
  job_number: 'PM-00001',
});
const mockHasPushTokens = vi.fn().mockResolvedValue(false);

vi.mock('@/lib/push-triggers/loaders', () => ({
  getDisplayName: (...args: unknown[]) => mockGetDisplayName(...args),
  getJobNumber: (...args: unknown[]) => mockGetJobNumber(...args),
  getRecipientEmail: (...args: unknown[]) => mockGetRecipientEmail(...args),
  getPermanentPostingInfo: (...args: unknown[]) => mockGetPermanentPostingInfo(...args),
  hasPushTokens: (...args: unknown[]) => mockHasPushTokens(...args),
}));

// --- Mock sendEmail ---
const mockSendEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/email/send', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// --- Mock email templates ---
vi.mock('@/lib/email/templates', () => ({
  applicationAcceptedEmail: () => ({ subject: 'You got the job!', html: '<p>Accepted</p>' }),
  permanentSelectedEmail: () => ({ subject: 'You have been selected!', html: '<p>Selected</p>' }),
}));

// --- Import after mocks ---
const { sendEmailForEvent } = await import('@/lib/push-triggers/email-dispatcher');

// --- Supabase mock builder ---
function createMockSc(tableResponses: Record<string, { data: unknown; error: unknown }> = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const response = tableResponses[table] ?? { data: null, error: null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
        then: (resolve: (v: unknown) => void) => resolve(response),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.single.mockReturnValue(builder);
      return builder;
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const defaultCtx = {
  recipientPersonId: 'person-1',
  notification: { title: 'Test', body: 'Test body', data: {} },
  roleContext: 'crew' as const,
};

describe('sendEmailForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDisplayName.mockResolvedValue('Jane Doe');
    mockGetJobNumber.mockResolvedValue('DW-00042');
    mockGetRecipientEmail.mockResolvedValue('crew@example.com');
    mockGetPermanentPostingInfo.mockResolvedValue({
      role_name: 'Chief Engineer',
      job_number: 'PM-00001',
    });
    mockHasPushTokens.mockResolvedValue(false);
  });

  it('ignores events that are not DAYWORK.ACCEPTED or PERMANENT.SELECTED', async () => {
    const sc = createMockSc();
    await sendEmailForEvent(sc, 'DAYWORK.APPLIED', { daywork_id: 'dw1' }, defaultCtx);
    await sendEmailForEvent(sc, 'MESSAGE.SENT', {}, defaultCtx);
    await sendEmailForEvent(sc, 'PERSON.CREATED', {}, defaultCtx);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('DAYWORK.ACCEPTED sends email when user has no push tokens and email_enabled is true', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
      dayworks: { data: { start_date: '2026-04-01' }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'dw1', engagement_id: 'eng1' },
      defaultCtx,
    );

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'crew@example.com',
      subject: 'You got the job!',
      html: '<p>Accepted</p>',
    });
  });

  it('DAYWORK.ACCEPTED skips email when user HAS push tokens', async () => {
    mockHasPushTokens.mockResolvedValue(true);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'dw1' },
      defaultCtx,
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('DAYWORK.ACCEPTED skips email when email_enabled is false', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: false }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'dw1' },
      defaultCtx,
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('PERMANENT.SELECTED sends email when user has no push tokens and email_enabled is true', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'PERMANENT.SELECTED',
      { permanent_posting_id: 'pp1', engagement_id: 'eng2' },
      defaultCtx,
    );

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'crew@example.com',
      subject: 'You have been selected!',
      html: '<p>Selected</p>',
    });
  });

  it('PERMANENT.SELECTED skips when permanent posting info not found', async () => {
    mockGetPermanentPostingInfo.mockResolvedValue(null);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'PERMANENT.SELECTED',
      { permanent_posting_id: 'pp1', engagement_id: 'eng2' },
      defaultCtx,
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips email when getRecipientEmail returns null', async () => {
    mockGetRecipientEmail.mockResolvedValue(null);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'dw1' },
      defaultCtx,
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
