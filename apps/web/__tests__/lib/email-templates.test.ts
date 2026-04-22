import { describe, it, expect } from 'vitest';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  newMessageEmail,
  engagementStartingEmail,
  permanentShortlistedEmail,
  permanentSelectedEmail,
  permanentPlacementConfirmedEmail,
  formatVesselName,
  formatEmailDate,
} from '@/lib/email/templates';

describe('email template helpers', () => {
  it('formatVesselName uses M/Y for motor yachts', () => {
    expect(formatVesselName('Serenity', 'motor')).toBe('M/Y Serenity');
  });

  it('formatVesselName uses S/Y for sail yachts', () => {
    expect(formatVesselName('Wind Rose', 'sail')).toBe('S/Y Wind Rose');
  });

  it('formatEmailDate renders en-GB format', () => {
    expect(formatEmailDate('2026-04-28')).toMatch(/28\s+April\s+2026/);
  });

  it('formatEmailDate falls back to the input on parse failure', () => {
    expect(formatEmailDate('not-a-date')).toBe('not-a-date');
  });
});

describe('email templates', () => {
  it('applicationAcceptedEmail surfaces role + vessel + date in subject and preview', () => {
    const result = applicationAcceptedEmail({
      crewName: 'Alice',
      roleName: 'Deckhand',
      vesselLabel: 'M/Y Serenity',
      jobNumber: 'DW-00042',
      startDateFormatted: '28 April 2026',
      deepLink: 'https://dw.com/messages/eng-1',
    });
    expect(result.subject).toContain('Deckhand');
    expect(result.subject).toContain('M/Y Serenity');
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('DW-00042');
    expect(result.html).toContain('28 April 2026');
    expect(result.html).toContain('https://dw.com/messages/eng-1');
    // Hidden preview span present
    expect(result.html).toContain('display:none');
  });

  it('applicationReceivedEmail includes experience + city facts when provided', () => {
    const result = applicationReceivedEmail({
      employerName: 'Bob',
      crewName: 'Alice',
      roleName: 'Deckhand',
      vesselLabel: 'M/Y Serenity',
      jobNumber: 'DW-00042',
      experienceBracketLabel: '5–15 years',
      cityLabel: 'Antibes',
      deepLink: 'https://dw.com/daywork/d1/review',
    });
    expect(result.subject).toContain('Deckhand');
    expect(result.subject).toContain('Alice');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('5–15 years');
    expect(result.html).toContain('Antibes');
  });

  it('applicationReceivedEmail omits fact list when neither experience nor city is provided', () => {
    const result = applicationReceivedEmail({
      employerName: 'Bob',
      crewName: 'Alice',
      roleName: 'Deckhand',
      vesselLabel: 'M/Y Serenity',
      jobNumber: 'DW-00042',
      experienceBracketLabel: null,
      cityLabel: null,
      deepLink: 'https://dw.com/daywork/d1/review',
    });
    expect(result.html).not.toContain('Experience:');
    expect(result.html).not.toContain('Based in:');
  });

  it('newMessageEmail puts sender name and role in subject and includes preview text', () => {
    const result = newMessageEmail({
      recipientName: 'Bob',
      senderName: 'Alice',
      roleName: 'Chief Stewardess',
      preview: 'See you at the dock tomorrow',
      deepLink: 'https://dw.com/messages/eng-1',
    });
    expect(result.subject).toContain('Alice');
    expect(result.subject).toContain('Chief Stewardess');
    expect(result.html).toContain('See you at the dock tomorrow');
  });

  it('newMessageEmail gracefully handles missing role name', () => {
    const result = newMessageEmail({
      recipientName: 'Bob',
      senderName: 'Alice',
      roleName: null,
      preview: 'Hello',
      deepLink: 'https://dw.com/messages/eng-1',
    });
    expect(result.subject).toContain('Alice');
    expect(result.subject).not.toContain('about');
  });

  it('engagementStartingEmail surfaces vessel when known', () => {
    const result = engagementStartingEmail({
      recipientName: 'Alice',
      otherPartyName: 'Captain Bob',
      roleName: 'Deckhand',
      vesselLabel: 'M/Y Serenity',
      startDateFormatted: '29 April 2026',
      engagementId: 'eng-99',
    });
    expect(result.subject).toContain('Tomorrow');
    expect(result.subject).toContain('Deckhand');
    expect(result.subject).toContain('M/Y Serenity');
    expect(result.html).toContain('29 April 2026');
    expect(result.html).toContain('eng-99');
  });

  it('engagementStartingEmail omits vessel from subject when unknown', () => {
    const result = engagementStartingEmail({
      recipientName: 'Alice',
      otherPartyName: 'Captain Bob',
      roleName: 'Deckhand',
      vesselLabel: null,
      startDateFormatted: '29 April 2026',
      engagementId: 'eng-99',
    });
    expect(result.subject).toContain('Tomorrow');
    expect(result.subject).toContain('Deckhand');
    expect(result.subject).not.toContain('aboard');
  });

  it('permanentShortlistedEmail omits vessel name (NDA-safe at shortlist stage)', () => {
    const result = permanentShortlistedEmail({
      recipientName: 'Alice',
      roleName: 'Chief Engineer',
      jobNumber: 'PM-00001',
    });
    expect(result.subject).toContain('Chief Engineer');
    expect(result.subject).toContain('PM-00001');
    // Vessel names are gated until selection; template must not leak them
    expect(result.subject).not.toContain('aboard');
    expect(result.html).not.toContain('M/Y');
    expect(result.html).not.toContain('S/Y');
  });

  it('permanentSelectedEmail includes vessel (NDA lifted post-selection)', () => {
    const result = permanentSelectedEmail({
      recipientName: 'Alice',
      roleName: 'Chief Engineer',
      vesselLabel: 'M/Y Aurora',
      jobNumber: 'PM-00001',
      engagementId: 'eng-7',
    });
    expect(result.subject).toContain('M/Y Aurora');
    expect(result.html).toContain('eng-7');
  });

  it('permanentPlacementConfirmedEmail links to engagement when id is available', () => {
    const result = permanentPlacementConfirmedEmail({
      recipientName: 'Alice',
      roleName: 'Chief Engineer',
      vesselLabel: 'M/Y Aurora',
      jobNumber: 'PM-00001',
      engagementId: 'eng-8',
    });
    expect(result.html).toContain('/messages/eng-8');
  });

  it('permanentPlacementConfirmedEmail falls back to /messages list when engagement id is null', () => {
    const result = permanentPlacementConfirmedEmail({
      recipientName: 'Alice',
      roleName: 'Chief Engineer',
      vesselLabel: 'M/Y Aurora',
      jobNumber: 'PM-00001',
      engagementId: null,
    });
    // Link goes to general messages index, not a specific engagement
    expect(result.html).not.toMatch(/\/messages\/eng/);
    expect(result.html).toContain('/messages"');
  });
});
