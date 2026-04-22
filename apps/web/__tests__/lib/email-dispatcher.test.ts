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

// --- Mock cooldown (defaults to allow all — per-test override to simulate blocking) ---
const mockCanSendEmail = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/email/cooldown', () => ({
  canSendEmail: (...args: unknown[]) => mockCanSendEmail(...args),
}));

// --- Mock email templates ---
vi.mock('@/lib/email/templates', () => ({
  applicationAcceptedEmail: () => ({ subject: 'You got the job!', html: '<p>Accepted</p>' }),
  applicationReceivedEmail: () => ({ subject: 'New applicant', html: '<p>Applied</p>' }),
  newMessageEmail: () => ({ subject: 'New message', html: '<p>Message</p>' }),
  permanentSelectedEmail: () => ({ subject: 'You have been selected!', html: '<p>Selected</p>' }),
  permanentShortlistedEmail: () => ({ subject: 'Shortlisted', html: '<p>Shortlisted</p>' }),
  permanentPlacementConfirmedEmail: () => ({ subject: 'Placement confirmed', html: '<p>Confirmed</p>' }),
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
    mockCanSendEmail.mockResolvedValue(true);
  });

  it('ignores events that are not in the handled set', async () => {
    const sc = createMockSc();
    await sendEmailForEvent(sc, 'PERSON.CREATED', {}, defaultCtx);
    await sendEmailForEvent(sc, 'DAYWORK.POSTED', {}, defaultCtx);
    await sendEmailForEvent(sc, 'VESSEL.CREATED', {}, defaultCtx);
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

  // ---------------------------------------------------------------------------
  // Cooldown integration
  // ---------------------------------------------------------------------------

  it('MESSAGE.SENT passes engagement_id to canSendEmail as "message" cooldown', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'MESSAGE.SENT',
      {
        engagement_id: 'eng-42',
        sender_person_id: 'sender-1',
        content: 'Hey there, quick question',
        is_system: false,
      },
      defaultCtx,
    );

    expect(mockCanSendEmail).toHaveBeenCalledWith('person-1', 'message', 'eng-42');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('DAYWORK.APPLIED passes daywork_id to canSendEmail as "applied" cooldown', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.APPLIED',
      { daywork_id: 'dw-77', crew_person_id: 'crew-1' },
      defaultCtx,
    );

    expect(mockCanSendEmail).toHaveBeenCalledWith('person-1', 'applied', 'dw-77');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('once-per-flow events (DAYWORK.ACCEPTED, PERMANENT.*) pass "other" kind', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
      dayworks: { data: { start_date: '2026-04-01' }, error: null },
    });

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);
    await sendEmailForEvent(
      sc,
      'PERMANENT.SELECTED',
      { permanent_posting_id: 'pp1', engagement_id: 'eng1' },
      defaultCtx,
    );
    await sendEmailForEvent(
      sc,
      'PERMANENT.SHORTLISTED',
      { permanent_posting_id: 'pp1' },
      defaultCtx,
    );
    await sendEmailForEvent(
      sc,
      'PERMANENT.PLACEMENT_CONFIRMED',
      { permanent_posting_id: 'pp1' },
      defaultCtx,
    );

    // All four events called canSendEmail with 'other'
    const otherCalls = mockCanSendEmail.mock.calls.filter((c) => c[1] === 'other');
    expect(otherCalls).toHaveLength(4);
  });

  it('skips sendEmail when canSendEmail returns false (cooldown tripped)', async () => {
    mockCanSendEmail.mockResolvedValue(false);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
      dayworks: { data: { start_date: '2026-04-01' }, error: null },
    });

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);
    await sendEmailForEvent(
      sc,
      'MESSAGE.SENT',
      {
        engagement_id: 'eng1',
        sender_person_id: 'sender-1',
        content: 'Hey',
        is_system: false,
      },
      defaultCtx,
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
