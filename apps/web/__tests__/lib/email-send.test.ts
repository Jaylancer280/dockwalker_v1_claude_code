import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ id: 'email-1' });

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('no-ops when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import('@/lib/email/send');
    await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls Resend SDK with correct params when key is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'DW <noreply@dw.com>';
    const { sendEmail } = await import('@/lib/email/send');
    await sendEmail({ to: 'crew@example.com', subject: 'Accepted', html: '<p>Great</p>' });
    expect(mockSend).toHaveBeenCalledWith({
      from: 'DW <noreply@dw.com>',
      to: 'crew@example.com',
      subject: 'Accepted',
      html: '<p>Great</p>',
    });
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });
});
