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
import { applicationAcceptedEmail, permanentSelectedEmail } from '../email/templates';

/**
 * Send email for critical events ONLY when the user has no push tokens.
 * Only 3 event types warrant email:
 * - DAYWORK.ACCEPTED ("you got the job")
 * - PERMANENT.SELECTED ("you've been selected")
 * - Engagement starts tomorrow (handled by cron, not here)
 */
export async function sendEmailForEvent(
  sc: SupabaseClient,
  eventType: string,
  payload: Record<string, unknown>,
  ctx: NotifyContext,
): Promise<void> {
  // Only send email for the 2 critical event types handled here
  if (eventType !== 'DAYWORK.ACCEPTED' && eventType !== 'PERMANENT.SELECTED') return;

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
  }
}
