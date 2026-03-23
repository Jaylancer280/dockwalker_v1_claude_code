import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser } from '../push-delivery';
import { resolveNotification } from './event-router';
import { mapEventToNotificationType, resolveDeepLink } from './notification-mapper';
import { sendEmailForEvent } from './email-dispatcher';

export { getRecipientEmail } from './loaders';
export { broadcastQueue } from './broadcast';

/** Map event types to push preference columns */
function getPushPreferenceKey(
  eventType: string,
): 'push_jobs' | 'push_applications' | 'push_messages' | 'push_reminders' | null {
  switch (eventType) {
    case 'DAYWORK.POSTED':
      return 'push_jobs';
    case 'DAYWORK.APPLIED':
    case 'DAYWORK.ACCEPTED':
    case 'DAYWORK.REJECTED':
    case 'DAYWORK.SHORTLISTED':
    case 'DAYWORK.INVITED':
    case 'DAYWORK.INVITATION_ACCEPTED':
    case 'DAYWORK.INVITATION_DECLINED':
    case 'PERMANENT.APPLIED':
    case 'PERMANENT.SHORTLISTED':
    case 'PERMANENT.SELECTED':
    case 'PERMANENT.REJECTED':
    case 'PERMANENT.PLACEMENT_CONFIRMED':
    case 'PERMANENT.SELECTION_REVERTED':
      return 'push_applications';
    case 'MESSAGE.SENT':
      return 'push_messages';
    case 'ENGAGEMENT.WORK_STARTED':
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
    case 'ENGAGEMENT.COMPLETION_CONFIRMED':
    case 'CHECKLIST.SET':
      return 'push_reminders';
    default:
      return null;
  }
}

/**
 * Fire-and-forget push notification after a domain event.
 * Called from API routes after appendEvent/appendEvents.
 * Never throws — push failures must not break API responses.
 */
export function notifyOnEvent(
  serviceClient: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  actorPersonId: string,
): void {
  resolveNotification(serviceClient, eventType, payload, actorPersonId)
    .then(async (contexts) => {
      for (const ctx of contexts) {
        // Check push preference before sending push
        let pushAllowed = true;
        const prefKey = getPushPreferenceKey(eventType);
        if (prefKey) {
          const { data: prefs } = await serviceClient
            .from('user_preferences')
            .select(prefKey)
            .eq('person_id', ctx.recipientPersonId)
            .single();
          if (prefs && (prefs as Record<string, unknown>)[prefKey] === false) {
            pushAllowed = false;
          }
        }

        // Push notification (if preference allows)
        if (pushAllowed) {
          sendPushToUser(serviceClient, ctx.recipientPersonId, ctx.notification).catch(() => {
            // swallow — push delivery errors are non-fatal
          });
        }

        // In-app notification (skip system messages) — always fires regardless of push preference
        if (eventType === 'MESSAGE.SENT' && payload.is_system) continue;

        const notifType = mapEventToNotificationType(eventType);
        if (notifType) {
          const deepLink = resolveDeepLink(eventType, payload);
          serviceClient
            .from('notifications')
            .insert({
              person_id: ctx.recipientPersonId,
              type: notifType,
              title: ctx.notification.title,
              body: ctx.notification.body,
              deep_link: deepLink,
              role_context: ctx.roleContext,
            })
            .then(() => {});
        }

        // Email notification (critical events only, fire-and-forget)
        sendEmailForEvent(serviceClient, eventType, payload, ctx).catch(() => {});
      }
    })
    .catch(() => {
      // swallow — resolution errors are non-fatal
    });
}
