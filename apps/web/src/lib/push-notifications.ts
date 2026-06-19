// Map push notification data to an in-app URL.
// Returns undefined if no mapping exists.
//
// Kept as a pure function so the push-trigger handlers (server-side) and
// any future native or web-push client can derive the same deep-link URL
// from a payload without duplicating the routing table.
export function resolveDeepLinkUrl(data: Record<string, string>): string | undefined {
  const screen = data.screen;
  if (!screen) return undefined;

  switch (screen) {
    case 'chat':
      return data.engagementId ? `/messages/${data.engagementId}` : '/messages';
    case 'discover':
      return data.type === 'invitation' ? '/discover?tab=invitations' : '/discover';
    case 'review':
      return data.dayworkId ? `/daywork/${data.dayworkId}/review` : undefined;
    case 'permanent-apply': {
      const postingId = data.permanentPostingId;
      if (!postingId) return undefined;
      const fromInvitation = data.fromInvitation;
      return fromInvitation
        ? `/permanent/${postingId}/apply?from_invitation=${fromInvitation}`
        : `/permanent/${postingId}/apply`;
    }
    default:
      return undefined;
  }
}
