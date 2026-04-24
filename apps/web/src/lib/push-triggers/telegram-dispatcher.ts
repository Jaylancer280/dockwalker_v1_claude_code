import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import { decryptPhone, bufferFromBytea } from '../crypto';
import * as Sentry from '@sentry/nextjs';
import { sendTelegramMessage } from '../telegram';
import { getJobNumber, getDisplayName, getPermanentPostingInfo } from './loaders';
import { currencySymbol } from '@dockwalker/shared';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cta(url: string, label = 'Open in DockWalker'): string {
  return `\n\n<a href="${url}">${label}</a>`;
}

interface TelegramBody {
  text: string;
}

/**
 * Resolve the Telegram message body for a given event.
 * Returns null if the event type has no Telegram template.
 */
async function resolveBody(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
): Promise<TelegramBody | null> {
  const dayworkId = payload.daywork_id as string | undefined;
  const engagementId = payload.engagement_id as string | undefined;
  const postingId = payload.permanent_posting_id as string | undefined;

  switch (eventType) {
    case 'DAYWORK.APPLIED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select('yacht_roles:role_id(name)')
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      const { count } = await sc
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('daywork_id', dayworkId);
      const applicants = count ?? 0;
      return {
        text:
          `📥 <b>New applicant — ${escapeHtml(roleName)}</b>\n` +
          `${escapeHtml(jobNumber)} · ${applicants} applicant${applicants === 1 ? '' : 's'}` +
          cta(`${SITE_URL}/daywork/${dayworkId}/review`, 'Review applicants'),
      };
    }

    case 'DAYWORK.ACCEPTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select(
          'start_date, end_date, day_rate, currency, yacht_roles:role_id(name), vessels:vessel_id(name, nda_flag), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag ? 'NDA Vessel' : (d?.vessels?.name ?? 'a vessel');
      const portName = d?.ports?.name ?? 'port TBC';
      const dates =
        d?.start_date && d?.end_date
          ? `${formatDate(d.start_date)} – ${formatDate(d.end_date)}`
          : 'dates TBC';
      const rate = d?.day_rate ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day` : '';
      return {
        text:
          `🎉 <b>You're in — ${escapeHtml(roleName)}</b>\n` +
          `${escapeHtml(vesselName)} · ${escapeHtml(portName)}\n` +
          `${dates}${rate ? ` · ${escapeHtml(rate)}` : ''}\n` +
          `Ref: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'DAYWORK.REJECTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select('yacht_roles:role_id(name)')
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      return {
        text:
          `❌ <b>Application not selected</b>\n` +
          `${escapeHtml(roleName)} · ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/discover`, 'Browse more daywork'),
      };
    }

    case 'DAYWORK.SHORTLISTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select('yacht_roles:role_id(name), ports:location_port_id(name)')
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      return {
        text:
          `⭐ <b>You've been shortlisted</b>\n` +
          `${escapeHtml(d?.yacht_roles?.name ?? 'a role')} · ${escapeHtml(d?.ports?.name ?? 'a port')}\n` +
          `Ref: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/discover`),
      };
    }

    case 'DAYWORK.INVITED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select(
          'start_date, end_date, day_rate, currency, yacht_roles:role_id(name), vessels:vessel_id(name, nda_flag), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const vesselName = d?.vessels?.nda_flag ? 'NDA Vessel' : (d?.vessels?.name ?? 'a vessel');
      const rate = d?.day_rate
        ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day`
        : 'rate TBC';
      const dates =
        d?.start_date && d?.end_date
          ? `${formatDate(d.start_date)} – ${formatDate(d.end_date)}`
          : 'dates TBC';
      return {
        text:
          `📨 <b>Daywork invitation</b>\n` +
          `${escapeHtml(d?.yacht_roles?.name ?? 'a role')} · ${escapeHtml(vesselName)}\n` +
          `${escapeHtml(d?.ports?.name ?? 'a port')} · ${dates} · ${escapeHtml(rate)}\n` +
          `Ref: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/discover`, 'Respond'),
      };
    }

    case 'DAYWORK.INVITATION_ACCEPTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      return {
        text:
          `✅ <b>Invitation accepted</b>\n` +
          `Your crew member accepted — ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'DAYWORK.COMPLETED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      return {
        text:
          `🏁 <b>Daywork complete</b>\n` +
          `${escapeHtml(jobNumber)} — time to rate each other.` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Leave rating'),
      };
    }

    case 'PERMANENT.APPLIED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      const crewName = await getDisplayName(sc, payload.crew_person_id as string);
      return {
        text:
          `📥 <b>New permanent applicant</b>\n` +
          `${escapeHtml(crewName)} applied for ${escapeHtml(info.role_name)}\n` +
          `Ref: ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/permanent/${postingId}/review`, 'Review'),
      };
    }

    case 'PERMANENT.SHORTLISTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        text:
          `⭐ <b>Shortlisted for a permanent role</b>\n` +
          `${escapeHtml(info.role_name)} · ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/discover`),
      };
    }

    case 'PERMANENT.SELECTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        text:
          `🎉 <b>Selected — ${escapeHtml(info.role_name)}</b>\n` +
          `Ref: ${escapeHtml(info.job_number)}\n` +
          `Message the employer to finalise details.` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'PERMANENT.REJECTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        text:
          `❌ <b>Permanent application not selected</b>\n` +
          `${escapeHtml(info.role_name)} · ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/discover`),
      };
    }

    case 'PERMANENT.PLACEMENT_CONFIRMED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      if (ctx.notification.title === 'Position Filled') {
        return {
          text:
            `ℹ️ <b>Position filled</b>\n` +
            `${escapeHtml(info.role_name)} · ${escapeHtml(info.job_number)}` +
            cta(`${SITE_URL}/discover`),
        };
      }
      return {
        text:
          `✅ <b>Placement confirmed</b>\n` +
          `${escapeHtml(info.role_name)} · ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'PERMANENT.CANCELLED_BY_EMPLOYER': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        text:
          `🛑 <b>Permanent posting cancelled</b>\n` +
          `${escapeHtml(info.role_name)} · ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/discover`),
      };
    }

    case 'MESSAGE.SENT': {
      const eid = engagementId ?? (payload.engagement_id as string);
      if (!eid) return null;
      const { data: eng } = await sc
        .from('active_engagements')
        .select('daywork_id, permanent_posting_id')
        .eq('id', eid)
        .single();
      if (!eng) return null;
      let roleName = 'a role';
      let jobNumber = 'a job';
      if (eng.daywork_id) {
        jobNumber = await getJobNumber(sc, eng.daywork_id);
        const { data: dw } = await sc
          .from('dayworks')
          .select('yacht_roles:role_id(name)')
          .eq('id', eng.daywork_id)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        roleName = (dw as any)?.yacht_roles?.name ?? 'a role';
      } else if (eng.permanent_posting_id) {
        const info = await getPermanentPostingInfo(sc, eng.permanent_posting_id);
        if (info) {
          roleName = info.role_name;
          jobNumber = info.job_number;
        }
      }
      if (payload.message_type === 'documents') {
        const uploaderName = await getDisplayName(sc, payload.sender_person_id as string);
        const docCount = Number(payload.document_count ?? 1);
        return {
          text:
            `📎 <b>${escapeHtml(uploaderName)} shared ${docCount} document${docCount === 1 ? '' : 's'}</b>\n` +
            `${escapeHtml(roleName)} · ${escapeHtml(jobNumber)}` +
            cta(`${SITE_URL}/messages/${eid}`, 'Open chat'),
        };
      }
      return {
        text:
          `💬 <b>New message</b>\n` +
          `${escapeHtml(roleName)} · ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/messages/${eid}`, 'Open chat'),
      };
    }

    case 'ENGAGEMENT.WORK_STARTED':
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
    case 'ENGAGEMENT.CANCELLED_BY_CREW':
    case 'ENGAGEMENT.CANCELLED_BY_EMPLOYER':
    case 'ENGAGEMENT.POSTPONEMENT_PROPOSED':
    case 'ENGAGEMENT.COMPLETION_CONFIRMED':
    case 'CHECKLIST.SET': {
      const eid = engagementId ?? (payload.engagement_id as string);
      if (!eid) return null;
      const titleMap: Record<string, string> = {
        'ENGAGEMENT.WORK_STARTED': '▶️ Work started',
        'ENGAGEMENT.WORK_STARTED_CONFIRMED': '✅ Work start confirmed',
        'ENGAGEMENT.CANCELLED_BY_CREW': '🛑 Engagement cancelled by crew',
        'ENGAGEMENT.CANCELLED_BY_EMPLOYER': '🛑 Engagement cancelled by employer',
        'ENGAGEMENT.POSTPONEMENT_PROPOSED': '📅 Postponement proposed',
        'ENGAGEMENT.COMPLETION_CONFIRMED': '🏁 Engagement complete',
        'CHECKLIST.SET': '📋 Pre-arrival checklist updated',
      };
      const title = titleMap[eventType] ?? 'Engagement update';
      return {
        text:
          `<b>${escapeHtml(title)}</b>\n` +
          `${escapeHtml(ctx.notification.body)}` +
          cta(`${SITE_URL}/messages/${eid}`, 'Open chat'),
      };
    }

    default:
      return null;
  }
}

/**
 * Resolve the Telegram chat_id for a recipient if they have a verified
 * channel AND `telegram_enabled = true`. Returns plaintext chat_id (string)
 * or null.
 */
export async function getTelegramChatId(
  sc: SupabaseClient,
  recipientPersonId: string,
): Promise<string | null> {
  const { data: channel, error: channelError } = await sc
    .from('notification_channels')
    .select('channel_value_encrypted, verified')
    .eq('person_id', recipientPersonId)
    .eq('channel_type', 'telegram')
    .eq('verified', true)
    .maybeSingle();

  if (channelError) {
    Sentry.captureException(new Error(`Telegram channel lookup failed: ${channelError.message}`), {
      extra: { recipientPersonId },
    });
    return null;
  }
  if (!channel) return null;

  const { data: prefs, error: prefsError } = await sc
    .from('user_preferences')
    .select('telegram_enabled')
    .eq('person_id', recipientPersonId)
    .maybeSingle();

  if (prefsError) {
    Sentry.captureException(new Error(`Telegram preference lookup failed: ${prefsError.message}`), {
      extra: { recipientPersonId },
    });
    return null;
  }
  if (prefs && prefs.telegram_enabled === false) return null;

  try {
    const chatId = decryptPhone(bufferFromBytea(channel.channel_value_encrypted));
    if (!chatId) {
      Sentry.captureMessage('Telegram chat_id decoded to empty string', {
        extra: { recipientPersonId },
      });
      return null;
    }
    return chatId;
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        context: 'getTelegramChatId decrypt',
        recipientPersonId,
        ciphertextType: typeof channel.channel_value_encrypted,
        ciphertextSample:
          typeof channel.channel_value_encrypted === 'string'
            ? String(channel.channel_value_encrypted).slice(0, 20)
            : '(non-string)',
      },
    });
    return null;
  }
}

/**
 * Send a Telegram notification for the given event. Returns true on success.
 */
export async function sendTelegramForEvent(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
  chatId: string,
): Promise<boolean> {
  const body = await resolveBody(sc, eventType, payload, ctx);
  if (!body) {
    Sentry.captureMessage(`Telegram: no template body for event ${eventType}`, {
      extra: { eventType, recipientPersonId: ctx.recipientPersonId },
    });
    return false;
  }
  const sent = await sendTelegramMessage(chatId, body.text);
  if (!sent) {
    Sentry.captureMessage(`Telegram send returned false for ${eventType}`, {
      extra: { eventType, recipientPersonId: ctx.recipientPersonId },
    });
  }
  return sent;
}
