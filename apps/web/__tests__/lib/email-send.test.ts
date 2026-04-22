import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ id: 'email-1' });
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
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

  it('captures exception to Sentry and rethrows when Resend fails', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const err = new Error('Invalid from address');
    mockSend.mockRejectedValueOnce(err);
    const { sendEmail } = await import('@/lib/email/send');

    await expect(
      sendEmail({ to: 'crew@example.com', subject: 'Boom', html: '<p>Oops</p>' }),
    ).rejects.toThrow('Invalid from address');

    expect(mockCaptureException).toHaveBeenCalledWith(err, {
      tags: { source: 'email-dispatch' },
      extra: { subject: 'Boom' },
    });
    delete process.env.RESEND_API_KEY;
  });

  it('emits Sentry warning (once) when RESEND_API_KEY is missing in production', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import('@/lib/email/send');

    await sendEmail({ to: 'a@b.com', subject: 'X', html: '<p>Y</p>' });
    await sendEmail({ to: 'a@b.com', subject: 'X', html: '<p>Y</p>' });

    // Warning fires exactly once across multiple calls
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'RESEND_API_KEY not set in production',
      'warning',
    );

    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
