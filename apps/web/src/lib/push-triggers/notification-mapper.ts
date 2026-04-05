export function mapEventToNotificationType(eventType: string): string | null {
  const map: Record<string, string> = {
    'DAYWORK.APPLIED': 'application_received',
    'DAYWORK.ACCEPTED': 'application_accepted',
    'DAYWORK.REJECTED': 'application_rejected',
    'DAYWORK.INVITED': 'invitation_received',
    'DAYWORK.SHORTLISTED': 'application_shortlisted',
    'DAYWORK.INVITATION_ACCEPTED': 'invitation_accepted',
    'DAYWORK.POSTED': 'new_job_posted',
    'MESSAGE.SENT': 'message_received',
    'DAYWORK.COMPLETED': 'job_completed',
    'ENGAGEMENT.CANCELLED_BY_CREW': 'engagement_cancelled',
    'ENGAGEMENT.CANCELLED_BY_EMPLOYER': 'engagement_cancelled',
    'ENGAGEMENT.WORK_STARTED': 'work_started',
    'ENGAGEMENT.WORK_STARTED_CONFIRMED': 'work_started_confirmed',
    'ENGAGEMENT.POSTPONEMENT_PROPOSED': 'postponement_proposed',
    'CHECKLIST.SET': 'checklist_updated',
    'PERMANENT.APPLIED': 'permanent_application_received',
    'PERMANENT.SHORTLISTED': 'permanent_shortlisted',
    'PERMANENT.SELECTED': 'permanent_selected',
    'PERMANENT.REJECTED': 'permanent_rejected',
    'PERMANENT.PLACEMENT_CONFIRMED': 'permanent_placed',
    'PERMANENT.SELECTION_REVERTED': 'permanent_selection_reverted',
    'PERMANENT.CANCELLED_BY_EMPLOYER': 'permanent_posting_cancelled',
    'PERMANENT.ENGAGEMENT_CLOSED': 'permanent_conversation_closed',
  };
  return map[eventType] ?? null;
}

export function resolveDeepLink(
  eventType: string,
  payload: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case 'DAYWORK.APPLIED':
      return payload.daywork_id ? `/daywork/${payload.daywork_id}/review` : null;
    case 'DAYWORK.ACCEPTED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'DAYWORK.INVITED':
      return '/daywork/invitations';
    case 'DAYWORK.INVITATION_ACCEPTED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'MESSAGE.SENT':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'DAYWORK.POSTED':
      return '/discover';
    case 'DAYWORK.COMPLETED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.CANCELLED_BY_CREW':
    case 'ENGAGEMENT.CANCELLED_BY_EMPLOYER':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.POSTPONEMENT_PROPOSED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'CHECKLIST.SET':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'PERMANENT.APPLIED':
      return payload.permanent_posting_id
        ? `/permanent/${payload.permanent_posting_id}/review`
        : null;
    case 'PERMANENT.SELECTED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'PERMANENT.SHORTLISTED':
    case 'PERMANENT.REJECTED':
    case 'PERMANENT.PLACEMENT_CONFIRMED':
    case 'PERMANENT.SELECTION_REVERTED':
    case 'PERMANENT.CANCELLED_BY_EMPLOYER':
      return '/discover';
    case 'PERMANENT.ENGAGEMENT_CLOSED':
      return null;
    default:
      return null;
  }
}
