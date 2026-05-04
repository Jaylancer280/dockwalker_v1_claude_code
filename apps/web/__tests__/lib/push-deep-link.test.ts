import { describe, it, expect } from 'vitest';
import { resolveDeepLinkUrl } from '@/lib/push-notifications';

describe('resolveDeepLinkUrl', () => {
  it('maps screen:chat + engagementId to /messages/:id', () => {
    expect(resolveDeepLinkUrl({ screen: 'chat', engagementId: 'eng-1' })).toBe('/messages/eng-1');
  });

  it('maps screen:chat without engagementId to /messages', () => {
    expect(resolveDeepLinkUrl({ screen: 'chat' })).toBe('/messages');
  });

  it('maps screen:discover to /discover', () => {
    expect(resolveDeepLinkUrl({ screen: 'discover' })).toBe('/discover');
  });

  it('maps screen:discover with type:invitation to /discover?tab=invitations', () => {
    expect(resolveDeepLinkUrl({ screen: 'discover', type: 'invitation' })).toBe('/discover?tab=invitations');
  });

  it('maps screen:review + dayworkId to /daywork/:id/review', () => {
    expect(resolveDeepLinkUrl({ screen: 'review', dayworkId: 'dw-1' })).toBe('/daywork/dw-1/review');
  });

  it('returns undefined for screen:review without dayworkId', () => {
    expect(resolveDeepLinkUrl({ screen: 'review' })).toBeUndefined();
  });

  it('returns undefined when no screen present', () => {
    expect(resolveDeepLinkUrl({})).toBeUndefined();
  });

  it('returns undefined for unknown screen', () => {
    expect(resolveDeepLinkUrl({ screen: 'settings' })).toBeUndefined();
  });

  it('maps screen:permanent-apply + posting + invitation to /permanent/:id/apply?from_invitation=', () => {
    expect(
      resolveDeepLinkUrl({
        screen: 'permanent-apply',
        permanentPostingId: 'pp-1',
        fromInvitation: 'inv-9',
      }),
    ).toBe('/permanent/pp-1/apply?from_invitation=inv-9');
  });

  it('maps screen:permanent-apply without invitation to /permanent/:id/apply', () => {
    expect(
      resolveDeepLinkUrl({ screen: 'permanent-apply', permanentPostingId: 'pp-1' }),
    ).toBe('/permanent/pp-1/apply');
  });

  it('returns undefined for screen:permanent-apply without postingId', () => {
    expect(resolveDeepLinkUrl({ screen: 'permanent-apply' })).toBeUndefined();
  });
});
