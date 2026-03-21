import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import {
  getDisplayName,
  getJobNumber,
  getRecipientEmail,
  getPermanentPostingInfo,
} from './loaders';
import { sendEmail } from '../email/send';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  newMessageEmail,
  permanentShortlistedEmail,
  permanentSelectedEmail,
  permanentPlacementConfirmedEmail,
} from '../email/templates';

// ---- Email rate limiting for messages ----

const messageEmailTimestamps = new Map<string, number>();
const MESSAGE_EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function shouldSendMessageEmail(engagementId: string): boolean {
  const last = messageEmailTimestamps.get(engagementId);
  const now = Date.now();
  if (last && now - last < MESSAGE_EMAIL_COOLDOWN_MS) return false;
  messageEmailTimestamps.set(engagementId, now);
  return true;
}

export async function sendEmailForEvent(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
): Promise<void> {
  const email = await getRecipientEmail(sc, ctx.recipientPersonId);
  if (!email) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dockwalker.com';

  if (eventType === 'DAYWORK.ACCEPTED') {
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const dayworkId = payload.daywork_id as string;
    const jobNumber = await getJobNumber(sc, dayworkId);
    const { data: dw } = await sc
      .from('dayworks')
      .select('start_date')
      .eq('id', dayworkId)
      .single();
    const engagementId = payload.engagement_id as string | undefined;
    const deepLink = engagementId ? `${siteUrl}/messages/${engagementId}` : siteUrl;
    const tpl = applicationAcceptedEmail({
      crewName: recipientName,
      jobTitle: jobNumber,
      startDate: dw?.start_date ?? 'soon',
      deepLink,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'DAYWORK.APPLIED') {
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const dayworkId = payload.daywork_id as string;
    const jobNumber = await getJobNumber(sc, dayworkId);
    const crewName = await getDisplayName(sc, (payload.crew_person_id as string) ?? '');
    const deepLink = `${siteUrl}/daywork/${dayworkId}/review`;
    const tpl = applicationReceivedEmail({
      employerName: recipientName,
      crewName,
      jobTitle: jobNumber,
      deepLink,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'MESSAGE.SENT' && !payload.is_system) {
    const engagementId = payload.engagement_id as string;
    if (!shouldSendMessageEmail(engagementId)) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const content = payload.content as string;
    const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;
    const deepLink = `${siteUrl}/messages/${engagementId}`;
    const tpl = newMessageEmail({
      recipientName,
      senderName: ctx.notification.title,
      preview,
      deepLink,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.SHORTLISTED') {
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const info = await getPermanentPostingInfo(sc, postingId);
    if (!info) return;
    const tpl = permanentShortlistedEmail({
      recipientName,
      roleName: info.role_name,
      jobNumber: info.job_number,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.SELECTED') {
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const info = await getPermanentPostingInfo(sc, postingId);
    if (!info) return;
    const engagementId = payload.engagement_id as string;
    const tpl = permanentSelectedEmail({
      recipientName,
      roleName: info.role_name,
      jobNumber: info.job_number,
      engagementId,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.PLACEMENT_CONFIRMED') {
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const info = await getPermanentPostingInfo(sc, postingId);
    if (!info) return;
    const tpl = permanentPlacementConfirmedEmail({
      recipientName,
      roleName: info.role_name,
      jobNumber: info.job_number,
    });
    await sendEmail({ to: email, ...tpl });
  }
}
