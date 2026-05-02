import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import { decryptPhone, bufferFromBytea } from '../crypto';
import * as Sentry from '@sentry/nextjs';
import { sendTelegramMessage } from '../telegram';
import {
  getJobNumber,
  getDisplayName,
  getPermanentPostingInfo,
  getApplicantProfileSummary,
} from './loaders';
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

function previewText(s: string, max = 180): string {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max - 1).trimEnd() + '…';
}

function vesselLabel(type: string | null | undefined, name: string): string {
  const prefix = type === 'sail' ? 'S/Y ' : type === 'motor' ? 'M/Y ' : '';
  return `${prefix}${name}`;
}

function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return formatDate(start);
  return 'dates TBC';
}

/**
 * Date range that always carries the year — used for historical
 * reference snapshots, which routinely span multi-year tenures.
 * Collapses repeat year ("17 Jul 2024 – 30 Sept 2024" → "17 Jul – 30 Sept 2024")
 * but keeps both years when the range crosses calendar years.
 */
function formatDateRangeWithYear(start?: string, end?: string): string {
  const yr = (iso: string): string => new Date(iso + 'T00:00:00').getFullYear().toString();
  const dm = (iso: string): string =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dmy = (iso: string): string =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  if (start && end) {
    if (yr(start) === yr(end)) return `${dm(start)} – ${dmy(end)}`;
    return `${dmy(start)} – ${dmy(end)}`;
  }
  if (start) return `${dmy(start)} – present`;
  return 'dates TBC';
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
      const crewId = payload.crew_person_id as string | undefined;
      const [jobNumber, dwResult, applicantCountResult, applicantSummary] = await Promise.all([
        getJobNumber(sc, dayworkId),
        sc
          .from('dayworks')
          .select(
            'start_date, end_date, working_days, day_rate, currency, yacht_roles:role_id(name), vessels:vessel_id(name, vessel_type, nda_flag), ports:location_port_id(name)',
          )
          .eq('id', dayworkId)
          .single(),
        sc
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('daywork_id', dayworkId),
        crewId ? getApplicantProfileSummary(sc, crewId) : Promise.resolve(null),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dwResult.data as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(d?.vessels?.vessel_type, d?.vessels?.name ?? 'Vessel');
      const portName = d?.ports?.name ?? 'Port TBC';
      const dates = formatDateRange(d?.start_date, d?.end_date);
      const days = d?.working_days ?? '?';
      const rate = d?.day_rate
        ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day`
        : 'rate TBC';
      const applicants = applicantCountResult.count ?? 0;
      const applicantLine = applicantSummary
        ? `<b>${escapeHtml(applicantSummary.displayName)}</b>` +
          (applicantSummary.experienceBracketLabel
            ? ` · ${escapeHtml(applicantSummary.experienceBracketLabel)}`
            : '') +
          (applicantSummary.cityLabel ? ` · ${escapeHtml(applicantSummary.cityLabel)}` : '')
        : '<b>A crew member</b>';
      return {
        text:
          `📥 <b>New daywork applicant</b>\n\n` +
          `${applicantLine}\n` +
          `applied for <b>${escapeHtml(roleName)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}\n` +
          `📅 ${dates} · ${days} day${days === 1 ? '' : 's'}\n` +
          `💶 ${escapeHtml(rate)}\n\n` +
          `${applicants} total applicant${applicants === 1 ? '' : 's'}\n` +
          `Ref: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/daywork/${dayworkId}/review`, 'Review applicants'),
      };
    }

    case 'DAYWORK.ACCEPTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select(
          'start_date, end_date, working_days, day_rate, currency, meals, yacht_roles:role_id(name), vessels:vessel_id(name, vessel_type, nda_flag), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(d?.vessels?.vessel_type, d?.vessels?.name ?? 'Vessel');
      const portName = d?.ports?.name ?? 'Port TBC';
      const dates = formatDateRange(d?.start_date, d?.end_date);
      const days = d?.working_days;
      const rate = d?.day_rate
        ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day`
        : 'rate TBC';
      const mealsList: string[] = Array.isArray(d?.meals) ? d.meals : [];
      return {
        text:
          `🎉 <b>You're in — ${escapeHtml(roleName)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}\n` +
          `📅 ${dates}${days ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}\n` +
          `💶 ${escapeHtml(rate)}\n` +
          (mealsList.length ? `🍽 ${escapeHtml(mealsList.join(', '))}\n` : '') +
          `\nRef: ${escapeHtml(jobNumber)}` +
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
      // B-002: warmer copy. Avoids the red ❌ + "rejected" framing that
      // landed harshly on green crew. Matches the celebratory positive
      // templates in tone (emoji + bold header — role name) and pushes
      // forward to the next opportunity rather than dwelling on closure.
      return {
        text:
          `📈 <b>On to the next — ${escapeHtml(roleName)}</b>\n` +
          `${escapeHtml(jobNumber)} found a different fit. Plenty of new daywork live today.` +
          cta(`${SITE_URL}/discover`, 'Browse more daywork'),
      };
    }

    case 'DAYWORK.SHORTLISTED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select(
          'start_date, end_date, day_rate, currency, yacht_roles:role_id(name), vessels:vessel_id(name, vessel_type, nda_flag), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(d?.vessels?.vessel_type, d?.vessels?.name ?? 'Vessel');
      const portName = d?.ports?.name ?? 'Port TBC';
      const dates = formatDateRange(d?.start_date, d?.end_date);
      const rate = d?.day_rate ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day` : '';
      return {
        text:
          `⭐ <b>You've been shortlisted — ${escapeHtml(roleName)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}\n` +
          `📅 ${dates}` +
          (rate ? `\n💶 ${escapeHtml(rate)}` : '') +
          `\n\nRef: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/discover`, 'View posting'),
      };
    }

    case 'DAYWORK.INVITED': {
      if (!dayworkId) return null;
      const jobNumber = await getJobNumber(sc, dayworkId);
      const { data: dw } = await sc
        .from('dayworks')
        .select(
          'start_date, end_date, working_days, day_rate, currency, meals, notes, yacht_roles:role_id(name), vessels:vessel_id(name, vessel_type, nda_flag), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = dw as any;
      const roleName = d?.yacht_roles?.name ?? 'a role';
      const vesselName = d?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(d?.vessels?.vessel_type, d?.vessels?.name ?? 'Vessel');
      const portName = d?.ports?.name ?? 'Port TBC';
      const dates = formatDateRange(d?.start_date, d?.end_date);
      const days = d?.working_days;
      const rate = d?.day_rate
        ? `${currencySymbol(d.currency ?? 'EUR')}${d.day_rate}/day`
        : 'rate TBC';
      const mealsList: string[] = Array.isArray(d?.meals) ? d.meals : [];
      const notes = typeof d?.notes === 'string' && d.notes.trim() ? previewText(d.notes, 140) : '';
      return {
        text:
          `📨 <b>Daywork invitation — ${escapeHtml(roleName)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}\n` +
          `📅 ${dates}${days ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}\n` +
          `💶 ${escapeHtml(rate)}\n` +
          (mealsList.length ? `🍽 ${escapeHtml(mealsList.join(', '))}\n` : '') +
          (notes ? `\n<i>"${escapeHtml(notes)}"</i>\n` : '') +
          `\nRef: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/discover`, 'Respond'),
      };
    }

    case 'DAYWORK.INVITATION_ACCEPTED': {
      if (!dayworkId) return null;
      const crewId = payload.crew_person_id as string | undefined;
      const [jobNumber, dwResult, crewName] = await Promise.all([
        getJobNumber(sc, dayworkId),
        sc.from('dayworks').select('yacht_roles:role_id(name)').eq('id', dayworkId).single(),
        crewId ? getDisplayName(sc, crewId) : Promise.resolve(null),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roleName = (dwResult.data as any)?.yacht_roles?.name ?? 'a role';
      return {
        text:
          `✅ <b>Invitation accepted</b>\n\n` +
          `${crewName ? `<b>${escapeHtml(crewName)}</b>` : 'Your crew member'} accepted your invitation for <b>${escapeHtml(roleName)}</b>.\n` +
          `Ref: ${escapeHtml(jobNumber)}` +
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
      const crewId = payload.crew_person_id as string;
      const [info, ppResult, applicantSummary] = await Promise.all([
        getPermanentPostingInfo(sc, postingId),
        sc
          .from('permanent_postings')
          .select(
            'salary_min, salary_max, salary_currency, salary_period, live_aboard, start_date, vessels:vessel_id(name, vessel_type, nda_flag), ports:port_id(name)',
          )
          .eq('id', postingId)
          .single(),
        getApplicantProfileSummary(sc, crewId),
      ]);
      if (!info) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pp = ppResult.data as any;
      const vesselName = pp?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(pp?.vessels?.vessel_type, pp?.vessels?.name ?? 'Vessel');
      const portName = pp?.ports?.name ?? 'Port TBC';
      const sym = currencySymbol(pp?.salary_currency ?? 'EUR');
      const salary =
        pp?.salary_min && pp?.salary_max
          ? pp.salary_min === pp.salary_max
            ? `${sym}${pp.salary_min}/${pp.salary_period ?? 'month'}`
            : `${sym}${pp.salary_min}–${sym}${pp.salary_max}/${pp.salary_period ?? 'month'}`
          : 'Salary TBC';
      const messageText = typeof payload.message === 'string' ? payload.message.trim() : '';
      const messageLine = messageText
        ? `\n<i>"${escapeHtml(previewText(messageText, 160))}"</i>\n`
        : '';
      const applicantLine =
        `<b>${escapeHtml(applicantSummary.displayName)}</b>` +
        (applicantSummary.experienceBracketLabel
          ? ` · ${escapeHtml(applicantSummary.experienceBracketLabel)}`
          : '') +
        (applicantSummary.cityLabel ? ` · ${escapeHtml(applicantSummary.cityLabel)}` : '');
      return {
        text:
          `📥 <b>New permanent applicant</b>\n\n` +
          `${applicantLine}\n` +
          `applied for <b>${escapeHtml(info.role_name)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}\n` +
          `💶 ${escapeHtml(salary)}\n` +
          `🏠 ${pp?.live_aboard ? 'Live aboard' : 'Shore-based'}\n` +
          messageLine +
          `\nRef: ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/permanent/${postingId}/review`, 'Review applicants'),
      };
    }

    case 'PERMANENT.SHORTLISTED': {
      if (!postingId) return null;
      const [info, ppResult] = await Promise.all([
        getPermanentPostingInfo(sc, postingId),
        sc
          .from('permanent_postings')
          .select(
            'salary_min, salary_max, salary_currency, salary_period, vessels:vessel_id(name, vessel_type, nda_flag), ports:port_id(name)',
          )
          .eq('id', postingId)
          .single(),
      ]);
      if (!info) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pp = ppResult.data as any;
      const vesselName = pp?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(pp?.vessels?.vessel_type, pp?.vessels?.name ?? 'Vessel');
      const portName = pp?.ports?.name ?? 'Port TBC';
      const sym = currencySymbol(pp?.salary_currency ?? 'EUR');
      const salary =
        pp?.salary_min && pp?.salary_max
          ? `${sym}${pp.salary_min}–${sym}${pp.salary_max}/${pp.salary_period ?? 'month'}`
          : null;
      return {
        text:
          `⭐ <b>Shortlisted — ${escapeHtml(info.role_name)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}` +
          (salary ? `\n💶 ${escapeHtml(salary)}` : '') +
          `\n\nRef: ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/discover`, 'View posting'),
      };
    }

    case 'PERMANENT.SELECTED': {
      if (!postingId) return null;
      const [info, ppResult] = await Promise.all([
        getPermanentPostingInfo(sc, postingId),
        sc
          .from('permanent_postings')
          .select(
            'salary_min, salary_max, salary_currency, salary_period, live_aboard, vessels:vessel_id(name, vessel_type, nda_flag), ports:port_id(name)',
          )
          .eq('id', postingId)
          .single(),
      ]);
      if (!info) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pp = ppResult.data as any;
      const vesselName = pp?.vessels?.nda_flag
        ? 'NDA Vessel'
        : vesselLabel(pp?.vessels?.vessel_type, pp?.vessels?.name ?? 'Vessel');
      const portName = pp?.ports?.name ?? 'Port TBC';
      const sym = currencySymbol(pp?.salary_currency ?? 'EUR');
      const salary =
        pp?.salary_min && pp?.salary_max
          ? `${sym}${pp.salary_min}–${sym}${pp.salary_max}/${pp.salary_period ?? 'month'}`
          : null;
      return {
        text:
          `🎉 <b>You've been selected — ${escapeHtml(info.role_name)}</b>\n\n` +
          `⚓ ${escapeHtml(vesselName)}\n` +
          `📍 ${escapeHtml(portName)}` +
          (salary ? `\n💶 ${escapeHtml(salary)}` : '') +
          `\n🏠 ${pp?.live_aboard ? 'Live aboard' : 'Shore-based'}\n\n` +
          `Message the employer to finalise details.\n` +
          `Ref: ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'PERMANENT.SHORTLIST_CHAT_OPENED': {
      // B-011: pre-selection chat opt-in. Body stays neutral — chat is a
      // vetting conversation, not a placement signal — but encouraging
      // enough to prompt a reply.
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      return {
        text:
          `💬 <b>Captain wants to chat — ${escapeHtml(info.role_name)}</b>\n\n` +
          `The captain hiring for this role would like to ask a few questions before deciding.\n\n` +
          `Ref: ${escapeHtml(info.job_number)}` +
          cta(`${SITE_URL}/messages/${engagementId ?? ''}`, 'Open chat'),
      };
    }

    case 'PERMANENT.REJECTED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      // B-002: warmer copy — same forward-looking treatment as DAYWORK.REJECTED.
      return {
        text:
          `🔍 <b>Keep exploring — ${escapeHtml(info.role_name)}</b>\n` +
          `${escapeHtml(info.job_number)} closed for now. Fresh permanent postings match your profile every week.` +
          cta(`${SITE_URL}/discover`, 'Browse permanent roles'),
      };
    }

    case 'PERMANENT.PLACEMENT_CONFIRMED': {
      if (!postingId) return null;
      const info = await getPermanentPostingInfo(sc, postingId);
      if (!info) return null;
      if (ctx.notification.title === 'Position Filled') {
        // B-002: same audience as PERMANENT.REJECTED (rejected applicants).
        // Reframe from "Position filled" closure to a forward-looking nudge.
        return {
          text:
            `🌟 <b>Role filled — ${escapeHtml(info.role_name)}</b>\n` +
            `${escapeHtml(info.job_number)} went to another crew. New permanent postings live this week — keep applying.` +
            cta(`${SITE_URL}/discover`, 'Browse permanent roles'),
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
      const senderId = payload.sender_person_id as string | undefined;
      const [engResult, senderName] = await Promise.all([
        sc
          .from('active_engagements')
          .select('daywork_id, permanent_posting_id')
          .eq('id', eid)
          .single(),
        senderId ? getDisplayName(sc, senderId) : Promise.resolve('Someone'),
      ]);
      const eng = engResult.data;
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
        const docCount = Number(payload.document_count ?? 1);
        return {
          text:
            `📎 <b>${escapeHtml(senderName)} shared ${docCount} document${docCount === 1 ? '' : 's'}</b>\n` +
            `${escapeHtml(roleName)} · ${escapeHtml(jobNumber)}` +
            cta(`${SITE_URL}/messages/${eid}`, 'Open chat'),
        };
      }
      const messageContent =
        typeof payload.content === 'string' ? previewText(payload.content, 220) : '';
      return {
        text:
          `💬 <b>${escapeHtml(senderName)}</b> · ${escapeHtml(roleName)}\n` +
          (messageContent ? `<i>"${escapeHtml(messageContent)}"</i>\n` : '') +
          `Ref: ${escapeHtml(jobNumber)}` +
          cta(`${SITE_URL}/messages/${eid}`, 'Reply'),
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

    case 'SUPPORT.THREAD_OPENED':
    case 'SUPPORT.MESSAGE_SENT': {
      const threadId = payload.thread_id as string | undefined;
      if (!threadId) return null;
      const heading =
        eventType === 'SUPPORT.THREAD_OPENED'
          ? '💬 Message from DockWalker'
          : '💬 New reply from DockWalker';
      return {
        text:
          `<b>${heading}</b>\n` +
          `${escapeHtml(previewText(ctx.notification.body, 180))}` +
          cta(`${SITE_URL}/support/${threadId}`, 'Open thread'),
      };
    }

    case 'REFERENCE.REQUESTED': {
      const referenceId = payload.reference_id as string | undefined;
      const token = payload.token as string | undefined;
      const vesselFallback =
        (payload.snapshot_vessel_name as string | undefined) ?? 'a past vessel';
      if (!referenceId) {
        return {
          text:
            `📝 <b>Reference request</b>\n\n` +
            `Someone you worked with on <b>${escapeHtml(vesselFallback)}</b> has asked you to be a reference.` +
            (token ? cta(`${SITE_URL}/ref/${token}`, 'Review request') : ''),
        };
      }
      const { data: ref } = await sc
        .from('references')
        .select(
          'requester_person_id, requester_role_at_time, claimed_referee_role, snapshot_vessel_name, snapshot_vessel_imo, snapshot_start_date, snapshot_end_date, pending_expires_at',
        )
        .eq('id', referenceId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = ref as any;
      const requesterName = r?.requester_person_id
        ? await getDisplayName(sc, r.requester_person_id)
        : 'A crew member';
      const vessel = vesselLabel('motor', r?.snapshot_vessel_name ?? vesselFallback);
      const dates = formatDateRangeWithYear(
        r?.snapshot_start_date,
        r?.snapshot_end_date ?? undefined,
      );
      const requesterRole = r?.requester_role_at_time ?? 'Crew';
      const refereeRole = r?.claimed_referee_role ?? 'a colleague';
      const expiry = r?.pending_expires_at
        ? new Date(r.pending_expires_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })
        : null;
      const imoLine = r?.snapshot_vessel_imo ? `\n🆔 IMO ${escapeHtml(r.snapshot_vessel_imo)}` : '';
      const expiryLine = expiry ? `\n⏳ Expires <b>${escapeHtml(expiry)}</b>` : '';
      return {
        text:
          `📝 <b>Reference request</b>\n\n` +
          `<b>${escapeHtml(requesterName)}</b> (${escapeHtml(requesterRole)}) is asking you to confirm you worked together as <b>${escapeHtml(refereeRole)}</b>.\n\n` +
          `⚓ ${escapeHtml(vessel)}` +
          imoLine +
          `\n📅 ${dates}` +
          expiryLine +
          (token ? cta(`${SITE_URL}/ref/${token}`, 'Review & respond') : ''),
      };
    }

    case 'REFERENCE.ACCEPTED': {
      const referenceId = payload.reference_id as string | undefined;
      const vesselFallback =
        (payload.snapshot_vessel_name as string | undefined) ?? 'your past vessel';
      if (!referenceId) {
        return {
          text:
            `✅ <b>Reference accepted</b>\n\n` +
            `Your reference for <b>${escapeHtml(vesselFallback)}</b> is now live on your profile.` +
            cta(`${SITE_URL}/settings/references`, 'View references'),
        };
      }
      const { data: ref } = await sc
        .from('references')
        .select(
          'referee_person_id, claimed_referee_role, claimed_referee_name, snapshot_vessel_name, snapshot_start_date, snapshot_end_date, comment',
        )
        .eq('id', referenceId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = ref as any;
      const refereeName = r?.referee_person_id
        ? await getDisplayName(sc, r.referee_person_id)
        : (r?.claimed_referee_name ?? 'Your referee');
      const refereeRole = r?.claimed_referee_role ?? 'colleague';
      const vessel = vesselLabel('motor', r?.snapshot_vessel_name ?? vesselFallback);
      const dates = formatDateRangeWithYear(
        r?.snapshot_start_date,
        r?.snapshot_end_date ?? undefined,
      );
      const comment = (r?.comment as string | null) ?? null;
      const commentLine = comment
        ? `\n\n💬 "${escapeHtml(previewText(comment, 220))}"`
        : '\n\n<i>(no comment provided)</i>';
      return {
        text:
          `✅ <b>Reference accepted</b>\n\n` +
          `<b>${escapeHtml(refereeName)}</b> (${escapeHtml(refereeRole)}) confirmed your reference.\n\n` +
          `⚓ ${escapeHtml(vessel)}\n` +
          `📅 ${dates}` +
          commentLine +
          cta(`${SITE_URL}/settings/references`, 'View references'),
      };
    }

    case 'REFERENCE.COMMENT_UPDATED': {
      const referenceId = payload.reference_id as string | undefined;
      const vesselFallback =
        (payload.snapshot_vessel_name as string | undefined) ?? 'your past vessel';
      const cleared = payload.cleared === true;
      if (!referenceId) {
        const action = cleared ? 'removed their comment' : 'updated their comment';
        return {
          text:
            `✏️ <b>Reference comment updated</b>\n\n` +
            `Your referee ${action} on the <b>${escapeHtml(vesselFallback)}</b> reference.` +
            cta(`${SITE_URL}/settings/references`, 'View references'),
        };
      }
      const { data: ref } = await sc
        .from('references')
        .select(
          'referee_person_id, claimed_referee_role, claimed_referee_name, snapshot_vessel_name, snapshot_start_date, snapshot_end_date, comment',
        )
        .eq('id', referenceId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = ref as any;
      const refereeName = r?.referee_person_id
        ? await getDisplayName(sc, r.referee_person_id)
        : (r?.claimed_referee_name ?? 'Your referee');
      const refereeRole = r?.claimed_referee_role ?? 'colleague';
      const vessel = vesselLabel('motor', r?.snapshot_vessel_name ?? vesselFallback);
      const dates = formatDateRangeWithYear(
        r?.snapshot_start_date,
        r?.snapshot_end_date ?? undefined,
      );
      const heading = cleared
        ? '✏️ <b>Reference comment removed</b>'
        : '✏️ <b>Reference comment updated</b>';
      const action = cleared ? 'removed their comment' : 'updated their comment';
      const newComment = !cleared && r?.comment ? r.comment : null;
      const commentLine = newComment
        ? `\n\n💬 New comment:\n"${escapeHtml(previewText(newComment, 220))}"`
        : cleared
          ? '\n\n<i>(comment cleared — no longer visible on your profile)</i>'
          : '';
      return {
        text:
          `${heading}\n\n` +
          `<b>${escapeHtml(refereeName)}</b> (${escapeHtml(refereeRole)}) ${action} on your reference.\n\n` +
          `⚓ ${escapeHtml(vessel)}\n` +
          `📅 ${dates}` +
          commentLine +
          cta(`${SITE_URL}/settings/references`, 'Review change'),
      };
    }

    case 'REFERENCE.CONTACT_REQUESTED': {
      const contactId = payload.contact_id as string | undefined;
      const referenceId = payload.reference_id as string | undefined;
      const question = (payload.question as string | undefined)?.trim();
      const vesselFallback =
        (payload.snapshot_vessel_name as string | undefined) ?? 'a past engagement';
      if (!contactId || !referenceId) {
        const questionLine = question ? `\n\n💬 "${escapeHtml(previewText(question, 180))}"` : '';
        return {
          text:
            `🤝 <b>Contact request</b>\n\n` +
            `An employer would like to chat about your reference for <b>${escapeHtml(vesselFallback)}</b>.` +
            questionLine +
            cta(`${SITE_URL}/messages`, 'Review request'),
        };
      }
      const [{ data: contact }, { data: ref }] = await Promise.all([
        sc.from('reference_contacts').select('employer_person_id').eq('id', contactId).single(),
        sc
          .from('references')
          .select(
            'requester_person_id, claimed_referee_role, snapshot_vessel_name, snapshot_start_date, snapshot_end_date',
          )
          .eq('id', referenceId)
          .single(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = contact as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = ref as any;
      const employerName = c?.employer_person_id
        ? await getDisplayName(sc, c.employer_person_id)
        : 'An employer';
      const requesterName = r?.requester_person_id
        ? await getDisplayName(sc, r.requester_person_id)
        : 'a crew member';
      const refereeRole = r?.claimed_referee_role ?? 'their colleague';
      const vessel = vesselLabel('motor', r?.snapshot_vessel_name ?? vesselFallback);
      const dates = formatDateRangeWithYear(
        r?.snapshot_start_date,
        r?.snapshot_end_date ?? undefined,
      );
      const questionLine = question
        ? `\n\n💬 They asked:\n"${escapeHtml(previewText(question, 220))}"`
        : '\n\n<i>(no question included)</i>';
      return {
        text:
          `🤝 <b>Reference contact request</b>\n\n` +
          `<b>${escapeHtml(employerName)}</b> would like to chat about <b>${escapeHtml(requesterName)}</b>'s reference (you confirmed as ${escapeHtml(refereeRole)}).\n\n` +
          `⚓ ${escapeHtml(vessel)}\n` +
          `📅 ${dates}` +
          questionLine +
          cta(`${SITE_URL}/messages`, 'Accept or decline'),
      };
    }

    case 'REFERENCE.CONTACT_ACCEPTED': {
      const contactId = payload.contact_id as string | undefined;
      const eid = payload.engagement_id as string | undefined;
      const ctaUrl = eid ? `${SITE_URL}/messages/${eid}` : `${SITE_URL}/messages`;
      if (!contactId) {
        return {
          text:
            `✅ <b>Reference contact accepted</b>\n\n` +
            `A reference accepted your contact request — chat thread opened.` +
            cta(ctaUrl, 'Open chat'),
        };
      }
      const { data: contact } = await sc
        .from('reference_contacts')
        .select('reference_id')
        .eq('id', contactId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = contact as any;
      let refereeName = 'Your reference';
      let vessel = 'a past engagement';
      let dates = '';
      if (c?.reference_id) {
        const { data: ref } = await sc
          .from('references')
          .select(
            'referee_person_id, claimed_referee_name, claimed_referee_role, snapshot_vessel_name, snapshot_start_date, snapshot_end_date',
          )
          .eq('id', c.reference_id)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = ref as any;
        refereeName = r?.referee_person_id
          ? await getDisplayName(sc, r.referee_person_id)
          : (r?.claimed_referee_name ?? refereeName);
        if (r?.claimed_referee_role) refereeName = `${refereeName} (${r.claimed_referee_role})`;
        if (r?.snapshot_vessel_name) vessel = vesselLabel('motor', r.snapshot_vessel_name);
        dates = formatDateRangeWithYear(r?.snapshot_start_date, r?.snapshot_end_date ?? undefined);
      }
      return {
        text:
          `✅ <b>Reference contact accepted</b>\n\n` +
          `<b>${escapeHtml(refereeName)}</b> accepted your request — chat is open.\n\n` +
          `⚓ ${escapeHtml(vessel)}` +
          (dates ? `\n📅 ${dates}` : '') +
          cta(ctaUrl, 'Open chat'),
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
    // Self-heal: this row's ciphertext can never decrypt (wrong wire format
    // from an older deploy, or a key rotation). Nuke the channel row + pref
    // so the user sees "Not connected" on their next visit instead of the
    // system silently trying forever.
    Sentry.captureException(err, {
      extra: {
        context: 'getTelegramChatId decrypt — auto-healing row',
        recipientPersonId,
        ciphertextType: typeof channel.channel_value_encrypted,
        ciphertextSample:
          typeof channel.channel_value_encrypted === 'string'
            ? String(channel.channel_value_encrypted).slice(0, 30)
            : '(non-string)',
      },
    });
    try {
      await sc
        .from('notification_channels')
        .delete()
        .eq('person_id', recipientPersonId)
        .eq('channel_type', 'telegram');
      await sc
        .from('user_preferences')
        .update({ telegram_enabled: false })
        .eq('person_id', recipientPersonId);
    } catch {
      // best-effort; don't mask the original decrypt error
    }
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
