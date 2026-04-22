import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock loaders ---
const mockGetDisplayName = vi.fn().mockResolvedValue('Jane Doe');
const mockGetRecipientEmail = vi.fn().mockResolvedValue('crew@example.com');
const mockHasPushTokens = vi.fn().mockResolvedValue(false);
const mockGetDayworkContext = vi.fn().mockResolvedValue({
  roleName: 'Deckhand',
  vesselName: 'Serenity',
  vesselType: 'motor',
  startDate: '2026-04-28',
  jobNumber: 'DW-00042',
});
const mockGetPermanentPostingContext = vi.fn().mockResolvedValue({
  roleName: 'Chief Engineer',
  vesselName: 'Aurora',
  vesselType: 'motor',
  jobNumber: 'PM-00001',
  employerPersonId: 'emp-1',
});
const mockGetApplicantProfileSummary = vi.fn().mockResolvedValue({
  displayName: 'Alex Smith',
  experienceBracketLabel: '5–15 years',
  cityLabel: 'Antibes',
});
const mockGetEngagementRoleName = vi.fn().mockResolvedValue('Deckhand');
const mockGetActiveEngagementIdByPermanentPosting = vi
  .fn()
  .mockResolvedValue('eng-confirmed');

vi.mock('@/lib/push-triggers/loaders', () => ({
  getDisplayName: (...args: unknown[]) => mockGetDisplayName(...args),
  getRecipientEmail: (...args: unknown[]) => mockGetRecipientEmail(...args),
  hasPushTokens: (...args: unknown[]) => mockHasPushTokens(...args),
  getDayworkContext: (...args: unknown[]) => mockGetDayworkContext(...args),
  getPermanentPostingContext: (...args: unknown[]) => mockGetPermanentPostingContext(...args),
  getApplicantProfileSummary: (...args: unknown[]) => mockGetApplicantProfileSummary(...args),
  getEngagementRoleName: (...args: unknown[]) => mockGetEngagementRoleName(...args),
  getActiveEngagementIdByPermanentPosting: (...args: unknown[]) =>
    mockGetActiveEngagementIdByPermanentPosting(...args),
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

// --- Mock email templates (real formatters so dispatcher logic is exercised) ---
vi.mock('@/lib/email/templates', () => ({
  applicationAcceptedEmail: vi
    .fn()
    .mockReturnValue({ subject: 'You got the job!', html: '<p>Accepted</p>' }),
  applicationReceivedEmail: vi
    .fn()
    .mockReturnValue({ subject: 'New applicant', html: '<p>Applied</p>' }),
  newMessageEmail: vi
    .fn()
    .mockReturnValue({ subject: 'New message', html: '<p>Message</p>' }),
  permanentSelectedEmail: vi
    .fn()
    .mockReturnValue({ subject: 'You have been selected!', html: '<p>Selected</p>' }),
  permanentShortlistedEmail: vi
    .fn()
    .mockReturnValue({ subject: 'Shortlisted', html: '<p>Shortlisted</p>' }),
  permanentPlacementConfirmedEmail: vi
    .fn()
    .mockReturnValue({ subject: 'Placement confirmed', html: '<p>Confirmed</p>' }),
  formatVesselName: (name: string, type: string) =>
    `${type === 'sail' ? 'S/Y' : 'M/Y'} ${name}`,
  formatEmailDate: (iso: string) => iso,
}));

// --- Import after mocks ---
const { sendEmailForEvent } = await import('@/lib/push-triggers/email-dispatcher');
const { newMessageEmail, applicationReceivedEmail, permanentPlacementConfirmedEmail } =
  await import('@/lib/email/templates');

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
    mockGetRecipientEmail.mockResolvedValue('crew@example.com');
    mockHasPushTokens.mockResolvedValue(false);
    mockGetDayworkContext.mockResolvedValue({
      roleName: 'Deckhand',
      vesselName: 'Serenity',
      vesselType: 'motor',
      startDate: '2026-04-28',
      jobNumber: 'DW-00042',
    });
    mockGetPermanentPostingContext.mockResolvedValue({
      roleName: 'Chief Engineer',
      vesselName: 'Aurora',
      vesselType: 'motor',
      jobNumber: 'PM-00001',
      employerPersonId: 'emp-1',
    });
    mockGetApplicantProfileSummary.mockResolvedValue({
      displayName: 'Alex Smith',
      experienceBracketLabel: '5–15 years',
      cityLabel: 'Antibes',
    });
    mockGetEngagementRoleName.mockResolvedValue('Deckhand');
    mockGetActiveEngagementIdByPermanentPosting.mockResolvedValue('eng-confirmed');
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

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('DAYWORK.ACCEPTED skips email when email_enabled is false', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: false }, error: null },
    });

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('DAYWORK.ACCEPTED skips when daywork context not found', async () => {
    mockGetDayworkContext.mockResolvedValue(null);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);

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

  it('PERMANENT.SELECTED skips when permanent posting context not found', async () => {
    mockGetPermanentPostingContext.mockResolvedValue(null);
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

    await sendEmailForEvent(sc, 'DAYWORK.ACCEPTED', { daywork_id: 'dw1' }, defaultCtx);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Richer context — verifies dispatcher passes the right data to templates
  // ---------------------------------------------------------------------------

  it('DAYWORK.APPLIED surfaces applicant experience + city to the employer template', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'DAYWORK.APPLIED',
      { daywork_id: 'dw-77', crew_person_id: 'crew-1' },
      defaultCtx,
    );

    expect(mockGetApplicantProfileSummary).toHaveBeenCalledWith(expect.anything(), 'crew-1');
    expect(applicationReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        crewName: 'Alex Smith',
        roleName: 'Deckhand',
        vesselLabel: 'M/Y Serenity',
        jobNumber: 'DW-00042',
        experienceBracketLabel: '5–15 years',
        cityLabel: 'Antibes',
      }),
    );
  });

  it('MESSAGE.SENT truncates long content with ellipsis and passes role name', async () => {
    mockGetEngagementRoleName.mockResolvedValue('Chief Stewardess');
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    const longMessage = 'A'.repeat(200);
    await sendEmailForEvent(
      sc,
      'MESSAGE.SENT',
      {
        engagement_id: 'eng-42',
        sender_person_id: 'sender-1',
        content: longMessage,
        is_system: false,
      },
      defaultCtx,
    );

    expect(newMessageEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        roleName: 'Chief Stewardess',
        preview: 'A'.repeat(100) + '…',
      }),
    );
  });

  it('MESSAGE.SENT short content is not truncated and has no ellipsis', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'MESSAGE.SENT',
      {
        engagement_id: 'eng-42',
        sender_person_id: 'sender-1',
        content: 'See you at the dock',
        is_system: false,
      },
      defaultCtx,
    );

    expect(newMessageEmail).toHaveBeenCalledWith(
      expect.objectContaining({ preview: 'See you at the dock' }),
    );
  });

  it('PERMANENT.PLACEMENT_CONFIRMED resolves engagement_id from posting and passes to template', async () => {
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
    });

    await sendEmailForEvent(
      sc,
      'PERMANENT.PLACEMENT_CONFIRMED',
      { permanent_posting_id: 'pp1' },
      defaultCtx,
    );

    expect(mockGetActiveEngagementIdByPermanentPosting).toHaveBeenCalledWith(
      expect.anything(),
      'pp1',
    );
    expect(permanentPlacementConfirmedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ engagementId: 'eng-confirmed' }),
    );
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

    const otherCalls = mockCanSendEmail.mock.calls.filter((c) => c[1] === 'other');
    expect(otherCalls).toHaveLength(4);
  });

  it('skips sendEmail when canSendEmail returns false (cooldown tripped)', async () => {
    mockCanSendEmail.mockResolvedValue(false);
    const sc = createMockSc({
      user_preferences: { data: { email_enabled: true }, error: null },
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
