import { describe, it, expect } from 'vitest';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  newMessageEmail,
} from '@/lib/email/templates';

describe('email templates', () => {
  it('applicationAcceptedEmail returns subject and HTML with deep link', () => {
    const result = applicationAcceptedEmail({
      crewName: 'Alice',
      jobTitle: 'DW-00042',
      startDate: '2026-04-01',
      deepLink: 'https://dw.com/messages/eng-1',
    });
    expect(result.subject).toContain('DW-00042');
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('https://dw.com/messages/eng-1');
    expect(result.html).toContain('2026-04-01');
  });

  it('applicationReceivedEmail returns subject and HTML with crew name', () => {
    const result = applicationReceivedEmail({
      employerName: 'Bob',
      crewName: 'Alice',
      jobTitle: 'DW-00042',
      deepLink: 'https://dw.com/daywork/d1/review',
    });
    expect(result.subject).toContain('DW-00042');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('https://dw.com/daywork/d1/review');
  });

  it('newMessageEmail returns subject and HTML with preview', () => {
    const result = newMessageEmail({
      recipientName: 'Bob',
      senderName: 'Alice',
      preview: 'See you at the dock tomorrow',
      deepLink: 'https://dw.com/messages/eng-1',
    });
    expect(result.subject).toContain('Alice');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('See you at the dock tomorrow');
    expect(result.html).toContain('https://dw.com/messages/eng-1');
  });
});
