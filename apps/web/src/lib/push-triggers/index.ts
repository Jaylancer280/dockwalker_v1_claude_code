import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser } from '../push-delivery';
import { resolveNotification } from './event-router';
import { mapEventToNotificationType, resolveDeepLink } from './notification-mapper';
import { sendEmailForEvent } from './email-dispatcher';
import { getWhatsAppChannel, sendWhatsAppForEvent } from './whatsapp-dispatcher';
import { getTelegramChatId, sendTelegramForEvent } from './telegram-dispatcher';

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

/** 5-minute cooldown cache for WhatsApp per-conversation dedup (same as email) */
const whatsappCooldowns = new Map<string, number>();

/** 5-minute cooldown cache for Telegram per-conversation dedup */
const telegramCooldowns = new Map<string, number>();

/**
 * Fire-and-forget notification after a domain event.
 * Dispatch priority: Telegram → WhatsApp → push → email. Whichever external
 * channel delivers first suppresses the rest, so the user gets one
 * notification per event per channel preference. In-app always fires.
 * Never throws — delivery failures must not break API responses.
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
        // Skip system messages for all external channels
        if (eventType === 'MESSAGE.SENT' && payload.is_system) continue;

        // 1. In-app notification — always fires
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

        // 2. Check push preference for this event category
        let categoryAllowed = true;
        const prefKey = getPushPreferenceKey(eventType);
        if (prefKey) {
          const { data: prefs } = await serviceClient
            .from('user_preferences')
            .select(prefKey)
            .eq('person_id', ctx.recipientPersonId)
            .single();
          if (prefs && (prefs as Record<string, unknown>)[prefKey] === false) {
            categoryAllowed = false;
          }
        }

        // 3a. Try Telegram first (if connected + enabled + category allowed)
        let telegramSent = false;
        if (categoryAllowed) {
          const tgChatId = await getTelegramChatId(serviceClient, ctx.recipientPersonId);
          if (tgChatId) {
            if (eventType === 'MESSAGE.SENT') {
              const eid = (payload.engagement_id as string) ?? '';
              const cooldownKey = `tg:${ctx.recipientPersonId}:${eid}`;
              const lastSent = telegramCooldowns.get(cooldownKey) ?? 0;
              if (Date.now() - lastSent >= 5 * 60 * 1000) {
                telegramSent = await sendTelegramForEvent(
                  serviceClient,
                  eventType,
                  payload,
                  ctx,
                  tgChatId,
                );
                if (telegramSent) {
                  telegramCooldowns.set(cooldownKey, Date.now());
                }
              }
            } else {
              telegramSent = await sendTelegramForEvent(
                serviceClient,
                eventType,
                payload,
                ctx,
                tgChatId,
              );
            }
          }
        }

        // If Telegram delivered, skip other external channels.
        if (telegramSent) continue;

        // 3b. Try WhatsApp (if connected + enabled + category allowed)
        let whatsAppSent = false;
        if (categoryAllowed) {
          const phoneEncrypted = await getWhatsAppChannel(serviceClient, ctx.recipientPersonId);
          if (phoneEncrypted) {
            // 5-minute cooldown for MESSAGE.SENT per conversation
            if (eventType === 'MESSAGE.SENT') {
              const eid = (payload.engagement_id as string) ?? '';
              const cooldownKey = `wa:${ctx.recipientPersonId}:${eid}`;
              const lastSent = whatsappCooldowns.get(cooldownKey) ?? 0;
              if (Date.now() - lastSent < 5 * 60 * 1000) {
                // Skip WhatsApp — within cooldown, fall through to push
              } else {
                whatsAppSent = await sendWhatsAppForEvent(
                  serviceClient,
                  eventType,
                  payload,
                  ctx,
                  phoneEncrypted,
                );
                if (whatsAppSent) {
                  whatsappCooldowns.set(cooldownKey, Date.now());
                }
              }
            } else {
              whatsAppSent = await sendWhatsAppForEvent(
                serviceClient,
                eventType,
                payload,
                ctx,
                phoneEncrypted,
              );
            }
          }
        }

        // 4. If WhatsApp succeeded, skip push + email for this recipient
        if (whatsAppSent) continue;

        // 5. Push notification (if category allows)
        if (categoryAllowed) {
          sendPushToUser(serviceClient, ctx.recipientPersonId, ctx.notification).catch(() => {});
        }

        // 6. Email notification (fire-and-forget, email-dispatcher checks hasPushTokens internally)
        sendEmailForEvent(serviceClient, eventType, payload, ctx).catch(() => {});
      }
    })
    .catch(() => {
      // swallow — resolution errors are non-fatal
    });
}
