import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser } from '../push-delivery';
import { resolveNotification } from './event-router';
import { mapEventToNotificationType, resolveDeepLink } from './notification-mapper';
import { sendEmailForEvent } from './email-dispatcher';

export { getRecipientEmail } from './loaders';
export { broadcastQueue } from './broadcast';

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
    .then((contexts) => {
      for (const ctx of contexts) {
        // Push notification
        sendPushToUser(serviceClient, ctx.recipientPersonId, ctx.notification).catch(() => {
          // swallow — push delivery errors are non-fatal
        });

        // In-app notification (skip system messages)
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

        // Email notification (high-value events only, fire-and-forget)
        sendEmailForEvent(serviceClient, eventType, payload, ctx).catch(() => {});
      }
    })
    .catch(() => {
      // swallow — resolution errors are non-fatal
    });
}
