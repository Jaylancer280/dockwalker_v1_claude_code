import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import {
  getDisplayName,
  getJobNumber,
  getRecipientEmail,
  getPermanentPostingInfo,
  hasPushTokens,
} from './loaders';
import { sendEmail } from '../email/send';
import { canSendEmail } from '../email/cooldown';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  newMessageEmail,
  permanentSelectedEmail,
  permanentShortlistedEmail,
  permanentPlacementConfirmedEmail,
} from '../email/templates';

/**
 * Send email for important events ONLY when the user has no push tokens.
 * Handled event types:
 * - DAYWORK.ACCEPTED, DAYWORK.APPLIED
 * - MESSAGE.SENT (non-system)
 * - PERMANENT.SELECTED, PERMANENT.SHORTLISTED, PERMANENT.PLACEMENT_CONFIRMED
 * - Engagement starts tomorrow (handled by cron, not here)
 *
 * Cooldowns (see `src/lib/email/cooldown.ts`):
 * - MESSAGE.SENT     — 15 min per (recipient × engagement)
 * - DAYWORK.APPLIED  — 60 min per (poster × daywork)
 * - all events       — 20 emails / 24h per recipient (safety cap)
 */
export async function sendEmailForEvent(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
): Promise<void> {
  const EMAIL_EVENT_TYPES = [
    'DAYWORK.ACCEPTED',
    'DAYWORK.APPLIED',
    'MESSAGE.SENT',
    'PERMANENT.SELECTED',
    'PERMANENT.SHORTLISTED',
    'PERMANENT.PLACEMENT_CONFIRMED',
  ];
  if (!EMAIL_EVENT_TYPES.includes(eventType)) return;

  // Check email preference
  const { data: prefs } = await sc
    .from('user_preferences')
    .select('email_enabled')
    .eq('person_id', ctx.recipientPersonId)
    .single();
  if (prefs && prefs.email_enabled === false) return;

  // If user has push tokens, skip email — they'll get push + in-app
  if (await hasPushTokens(sc, ctx.recipientPersonId)) return;

  const email = await getRecipientEmail(sc, ctx.recipientPersonId);
  if (!email) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';

  if (eventType === 'DAYWORK.ACCEPTED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
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
  } else if (eventType === 'PERMANENT.SELECTED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
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
  } else if (eventType === 'DAYWORK.APPLIED') {
    const dayworkId = payload.daywork_id as string;
    if (!(await canSendEmail(ctx.recipientPersonId, 'applied', dayworkId))) return;
    const employerName = await getDisplayName(sc, ctx.recipientPersonId);
    const crewName = await getDisplayName(sc, payload.crew_person_id as string);
    const jobNumber = await getJobNumber(sc, dayworkId);
    const deepLink = `${siteUrl}/daywork/${dayworkId}/review`;
    const tpl = applicationReceivedEmail({ employerName, crewName, jobTitle: jobNumber, deepLink });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'MESSAGE.SENT') {
    if (payload.is_system) return;
    const engagementId = payload.engagement_id as string;
    if (!(await canSendEmail(ctx.recipientPersonId, 'message', engagementId))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const senderName = await getDisplayName(sc, payload.sender_person_id as string);
    const preview = typeof payload.content === 'string' ? payload.content.slice(0, 100) : '';
    const deepLink = `${siteUrl}/messages/${engagementId}`;
    const tpl = newMessageEmail({ recipientName, senderName, preview, deepLink });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.SHORTLISTED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
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
  } else if (eventType === 'PERMANENT.PLACEMENT_CONFIRMED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
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
