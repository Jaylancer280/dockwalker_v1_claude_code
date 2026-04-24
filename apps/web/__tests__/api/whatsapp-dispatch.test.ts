import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing
const mockResolveNotification = vi.fn();
const mockSendPushToUser = vi.fn();
const mockMapEventToNotificationType = vi.fn();
const mockResolveDeepLink = vi.fn();
const mockSendEmailForEvent = vi.fn();
const mockGetWhatsAppChannel = vi.fn();
const mockSendWhatsAppForEvent = vi.fn();

vi.mock('@/lib/push-triggers/event-router', () => ({
  resolveNotification: (...args: unknown[]) => mockResolveNotification(...args),
}));
vi.mock('@/lib/push-delivery', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));
vi.mock('@/lib/push-triggers/notification-mapper', () => ({
  mapEventToNotificationType: (...args: unknown[]) => mockMapEventToNotificationType(...args),
  resolveDeepLink: (...args: unknown[]) => mockResolveDeepLink(...args),
}));
vi.mock('@/lib/push-triggers/email-dispatcher', () => ({
  sendEmailForEvent: (...args: unknown[]) => mockSendEmailForEvent(...args),
}));
vi.mock('@/lib/push-triggers/whatsapp-dispatcher', () => ({
  getWhatsAppChannel: (...args: unknown[]) => mockGetWhatsAppChannel(...args),
  sendWhatsAppForEvent: (...args: unknown[]) => mockSendWhatsAppForEvent(...args),
}));
vi.mock('@/lib/push-triggers/telegram-dispatcher', () => ({
  getTelegramChatId: vi.fn().mockResolvedValue(null),
  sendTelegramForEvent: vi.fn().mockResolvedValue(false),
}));

const mockServiceFrom = vi.fn();
const mockServiceClient = {
  from: mockServiceFrom,
};

function chainable(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });
  return builder;
}

// Import after mocks
import { notifyOnEvent } from '@/lib/push-triggers/index';

const CTX = {
  recipientPersonId: 'crew1',
  notification: { title: 'Test', body: 'Body' },
  roleContext: 'crew' as const,
};

describe('notifyOnEvent — WhatsApp dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveNotification.mockResolvedValue([CTX]);
    mockMapEventToNotificationType.mockReturnValue('application');
    mockResolveDeepLink.mockReturnValue('/discover');
    mockSendPushToUser.mockResolvedValue(undefined);
    mockSendEmailForEvent.mockResolvedValue(undefined);
    // Default: no WhatsApp, push preference allowed
    mockGetWhatsAppChannel.mockResolvedValue(null);
    // Preferences: all allowed
    mockServiceFrom.mockReturnValue(chainable(null));
  });

  it('skips system messages for all channels', async () => {
    notifyOnEvent(
      mockServiceClient as never,
      'MESSAGE.SENT',
      { is_system: true },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockGetWhatsAppChannel).not.toHaveBeenCalled();
    expect(mockSendEmailForEvent).not.toHaveBeenCalled();
  });

  it('sends push + email when no WhatsApp connected', async () => {
    notifyOnEvent(
      mockServiceClient as never,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'd1', engagement_id: 'e1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetWhatsAppChannel).toHaveBeenCalledWith(mockServiceClient, 'crew1');
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendEmailForEvent).toHaveBeenCalled();
  });

  it('skips push + email when WhatsApp succeeds', async () => {
    const phoneBuf = Buffer.from('encrypted');
    mockGetWhatsAppChannel.mockResolvedValue(phoneBuf);
    mockSendWhatsAppForEvent.mockResolvedValue(true);

    notifyOnEvent(
      mockServiceClient as never,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'd1', engagement_id: 'e1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWhatsAppForEvent).toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockSendEmailForEvent).not.toHaveBeenCalled();
  });

  it('falls back to push + email when WhatsApp fails', async () => {
    const phoneBuf = Buffer.from('encrypted');
    mockGetWhatsAppChannel.mockResolvedValue(phoneBuf);
    mockSendWhatsAppForEvent.mockResolvedValue(false);

    notifyOnEvent(
      mockServiceClient as never,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'd1', engagement_id: 'e1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWhatsAppForEvent).toHaveBeenCalled();
    expect(mockSendPushToUser).toHaveBeenCalled();
    expect(mockSendEmailForEvent).toHaveBeenCalled();
  });

  it('respects 5-minute cooldown on MESSAGE.SENT WhatsApp', async () => {
    const phoneBuf = Buffer.from('encrypted');
    mockGetWhatsAppChannel.mockResolvedValue(phoneBuf);
    mockSendWhatsAppForEvent.mockResolvedValue(true);

    // First message — should send WhatsApp
    notifyOnEvent(
      mockServiceClient as never,
      'MESSAGE.SENT',
      { engagement_id: 'e1', sender_person_id: 'actor1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWhatsAppForEvent).toHaveBeenCalledTimes(1);
    expect(mockSendPushToUser).not.toHaveBeenCalled();

    // Second message within cooldown — should skip WhatsApp, fall through to push
    vi.clearAllMocks();
    mockResolveNotification.mockResolvedValue([CTX]);
    mockMapEventToNotificationType.mockReturnValue('message');
    mockResolveDeepLink.mockReturnValue('/messages/e1');
    mockGetWhatsAppChannel.mockResolvedValue(phoneBuf);
    mockSendWhatsAppForEvent.mockResolvedValue(true);
    mockSendPushToUser.mockResolvedValue(undefined);
    mockSendEmailForEvent.mockResolvedValue(undefined);
    mockServiceFrom.mockReturnValue(chainable(null));

    notifyOnEvent(
      mockServiceClient as never,
      'MESSAGE.SENT',
      { engagement_id: 'e1', sender_person_id: 'actor1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWhatsAppForEvent).not.toHaveBeenCalled();
    expect(mockSendPushToUser).toHaveBeenCalled();
  });

  it('skips WhatsApp when category preference is disabled', async () => {
    const phoneBuf = Buffer.from('encrypted');
    mockGetWhatsAppChannel.mockResolvedValue(phoneBuf);
    // Preference: push_applications = false
    mockServiceFrom.mockReturnValue(chainable({ push_applications: false }));

    notifyOnEvent(
      mockServiceClient as never,
      'DAYWORK.ACCEPTED',
      { daywork_id: 'd1', engagement_id: 'e1' },
      'actor1',
    );
    await new Promise((r) => setTimeout(r, 50));
    // WhatsApp should NOT be attempted because category is disabled
    expect(mockGetWhatsAppChannel).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});
