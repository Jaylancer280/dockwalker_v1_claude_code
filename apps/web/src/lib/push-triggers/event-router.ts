import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import {
  handleDayworkApplied,
  handleDayworkAccepted,
  handleDayworkRejected,
  handleDayworkShortlisted,
  handleDayworkInvited,
  handleInvitationAccepted,
  handleMessageSent,
  handleWorkStarted,
  handleCancelledByCrew,
  handleCancelledByEmployer,
  handleDayworkCompleted,
  handlePostponement,
  handleChecklist,
} from './daywork-handlers';
import {
  handlePermanentApplied,
  handlePermanentShortlisted,
  handlePermanentSelected,
  handlePermanentRejected,
  handlePermanentPlacementConfirmed,
  handlePermanentSelectionReverted,
  handlePermanentCancelled,
  handlePermanentEngagementClosed,
  handlePermanentInvited,
  handlePermanentShortlistChatOpened,
} from './permanent-handlers';
import { handleSupportThreadOpened, handleSupportMessageSent } from './support-handlers';
import {
  handleReferenceRequested,
  handleReferenceAccepted,
  handleReferenceCommentUpdated,
  handleReferenceContactRequested,
  handleReferenceContactAccepted,
} from './reference-handlers';
import { enqueueBroadcast } from './broadcast';

export async function resolveNotification(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  switch (eventType) {
    case 'DAYWORK.POSTED':
      enqueueBroadcast(sc, payload, actorPersonId);
      return [];

    case 'DAYWORK.APPLIED':
      return handleDayworkApplied(sc, payload);

    case 'DAYWORK.ACCEPTED':
      return handleDayworkAccepted(sc, payload);

    case 'DAYWORK.REJECTED':
      return handleDayworkRejected(sc, payload);

    case 'DAYWORK.SHORTLISTED':
      return handleDayworkShortlisted(sc, payload);

    case 'DAYWORK.INVITED':
      return handleDayworkInvited(sc, payload);

    case 'DAYWORK.INVITATION_ACCEPTED':
      return handleInvitationAccepted(sc, payload);

    case 'MESSAGE.SENT':
      return handleMessageSent(sc, payload, actorPersonId);

    case 'ENGAGEMENT.WORK_STARTED':
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
      return handleWorkStarted(sc, payload, actorPersonId, eventType);

    case 'ENGAGEMENT.CANCELLED_BY_CREW':
      return handleCancelledByCrew(sc, payload);

    case 'ENGAGEMENT.CANCELLED_BY_EMPLOYER':
      return handleCancelledByEmployer(sc, payload);

    case 'DAYWORK.COMPLETED':
      return handleDayworkCompleted(sc, payload);

    case 'ENGAGEMENT.POSTPONEMENT_PROPOSED':
      return handlePostponement(sc, payload);

    case 'CHECKLIST.SET':
      return handleChecklist(sc, payload);

    case 'PERMANENT.APPLIED':
      return handlePermanentApplied(sc, payload, actorPersonId);
    case 'PERMANENT.SHORTLISTED':
      return handlePermanentShortlisted(sc, payload);
    case 'PERMANENT.SELECTED':
      return handlePermanentSelected(sc, payload);
    case 'PERMANENT.REJECTED':
      return handlePermanentRejected(sc, payload);
    case 'PERMANENT.PLACEMENT_CONFIRMED':
      return handlePermanentPlacementConfirmed(sc, payload);
    case 'PERMANENT.SELECTION_REVERTED':
      return handlePermanentSelectionReverted(sc, payload);
    case 'PERMANENT.CANCELLED_BY_EMPLOYER':
      return handlePermanentCancelled(sc, payload);
    case 'PERMANENT.ENGAGEMENT_CLOSED':
      return handlePermanentEngagementClosed(sc, payload, actorPersonId);
    case 'PERMANENT.INVITED':
      return handlePermanentInvited(sc, payload, actorPersonId);
    case 'PERMANENT.SHORTLIST_CHAT_OPENED':
      return handlePermanentShortlistChatOpened(sc, payload);

    case 'SUPPORT.THREAD_OPENED':
      return handleSupportThreadOpened(sc, payload);
    case 'SUPPORT.MESSAGE_SENT':
      return handleSupportMessageSent(sc, payload);

    case 'REFERENCE.REQUESTED':
      return handleReferenceRequested(sc, payload);
    case 'REFERENCE.ACCEPTED':
      return handleReferenceAccepted(sc, payload);
    case 'REFERENCE.COMMENT_UPDATED':
      return handleReferenceCommentUpdated(sc, payload);
    case 'REFERENCE.CONTACT_REQUESTED':
      return handleReferenceContactRequested(sc, payload);
    case 'REFERENCE.CONTACT_ACCEPTED':
      return handleReferenceContactAccepted(sc, payload);

    default:
      return [];
  }
}
