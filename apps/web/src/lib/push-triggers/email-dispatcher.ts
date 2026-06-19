import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import {
  getDisplayName,
  getRecipientEmail,
  hasPushTokens,
  getDayworkContext,
  getPermanentPostingContext,
  getApplicantProfileSummary,
  getEngagementRoleName,
  getActiveEngagementIdByPermanentPosting,
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
  referenceAcceptedEmail,
  referenceCommentUpdatedEmail,
  supportMessageEmail,
  formatVesselName,
  formatEmailDate,
} from '../email/templates';

/**
 * Reference snapshots routinely span multiple years. Render with year on
 * both ends so "17 Jul – 30 Sep" can't be misread as same-year.
 */
function formatReferenceDateRange(start: string, end: string | null): string {
  const startStr = formatEmailDate(start);
  const endStr = end ? formatEmailDate(end) : 'present';
  return `${startStr} – ${endStr}`;
}

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
    'SUPPORT.THREAD_OPENED',
    'SUPPORT.MESSAGE_SENT',
    'REFERENCE.ACCEPTED',
    'REFERENCE.COMMENT_UPDATED',
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
    const dwCtx = await getDayworkContext(sc, dayworkId);
    if (!dwCtx) return;
    const engagementId = payload.engagement_id as string | undefined;
    const deepLink = engagementId ? `${siteUrl}/messages/${engagementId}` : siteUrl;
    const tpl = applicationAcceptedEmail({
      crewName: recipientName,
      roleName: dwCtx.roleName,
      vesselLabel: formatVesselName(dwCtx.vesselName, dwCtx.vesselType),
      jobNumber: dwCtx.jobNumber,
      startDateFormatted: formatEmailDate(dwCtx.startDate),
      deepLink,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.SELECTED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const ppCtx = await getPermanentPostingContext(sc, postingId);
    if (!ppCtx) return;
    const engagementId = payload.engagement_id as string;
    const tpl = permanentSelectedEmail({
      recipientName,
      roleName: ppCtx.roleName,
      vesselLabel: formatVesselName(ppCtx.vesselName, ppCtx.vesselType),
      jobNumber: ppCtx.jobNumber,
      engagementId,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'DAYWORK.APPLIED') {
    const dayworkId = payload.daywork_id as string;
    if (!(await canSendEmail(ctx.recipientPersonId, 'applied', dayworkId))) return;
    const employerName = await getDisplayName(sc, ctx.recipientPersonId);
    const dwCtx = await getDayworkContext(sc, dayworkId);
    if (!dwCtx) return;
    const applicantSummary = await getApplicantProfileSummary(sc, payload.crew_person_id as string);
    const deepLink = `${siteUrl}/daywork/${dayworkId}/review`;
    const tpl = applicationReceivedEmail({
      employerName,
      crewName: applicantSummary.displayName,
      roleName: dwCtx.roleName,
      vesselLabel: formatVesselName(dwCtx.vesselName, dwCtx.vesselType),
      jobNumber: dwCtx.jobNumber,
      experienceBracketLabel: applicantSummary.experienceBracketLabel,
      cityLabel: applicantSummary.cityLabel,
      deepLink,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'MESSAGE.SENT') {
    if (payload.is_system) return;
    const engagementId = payload.engagement_id as string;
    if (!(await canSendEmail(ctx.recipientPersonId, 'message', engagementId))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const senderName = await getDisplayName(sc, payload.sender_person_id as string);
    const content = typeof payload.content === 'string' ? payload.content : '';
    const preview = content.length > 100 ? content.slice(0, 100).trimEnd() + '…' : content;
    const roleName = await getEngagementRoleName(sc, engagementId);
    const deepLink = `${siteUrl}/messages/${engagementId}`;
    const tpl = newMessageEmail({ recipientName, senderName, roleName, preview, deepLink });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.SHORTLISTED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const ppCtx = await getPermanentPostingContext(sc, postingId);
    if (!ppCtx) return;
    const tpl = permanentShortlistedEmail({
      recipientName,
      roleName: ppCtx.roleName,
      jobNumber: ppCtx.jobNumber,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'PERMANENT.PLACEMENT_CONFIRMED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const postingId = payload.permanent_posting_id as string;
    const ppCtx = await getPermanentPostingContext(sc, postingId);
    if (!ppCtx) return;
    // Event payload does not carry engagement_id; resolve via the posting so
    // the CTA links to the specific conversation rather than the messages list.
    const engagementId = await getActiveEngagementIdByPermanentPosting(sc, postingId);
    const tpl = permanentPlacementConfirmedEmail({
      recipientName,
      roleName: ppCtx.roleName,
      vesselLabel: formatVesselName(ppCtx.vesselName, ppCtx.vesselType),
      jobNumber: ppCtx.jobNumber,
      engagementId,
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'SUPPORT.THREAD_OPENED' || eventType === 'SUPPORT.MESSAGE_SENT') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const threadId = payload.thread_id as string;
    if (!threadId) return;
    const tpl = supportMessageEmail({
      recipientName,
      preview: ctx.notification.body,
      threadId,
      isNewThread: eventType === 'SUPPORT.THREAD_OPENED',
    });
    await sendEmail({ to: email, ...tpl });
  } else if (eventType === 'REFERENCE.ACCEPTED' || eventType === 'REFERENCE.COMMENT_UPDATED') {
    if (!(await canSendEmail(ctx.recipientPersonId, 'other'))) return;
    const recipientName = await getDisplayName(sc, ctx.recipientPersonId);
    const referenceId = payload.reference_id as string | undefined;
    if (!referenceId) return;
    const { data: ref } = await sc
      .from('references')
      .select(
        'referee_person_id, claimed_referee_role, claimed_referee_name, snapshot_vessel_name, snapshot_start_date, snapshot_end_date, comment',
      )
      .eq('id', referenceId)
      .single();
    if (!ref) return;
    const r = ref as {
      referee_person_id: string | null;
      claimed_referee_role: string;
      claimed_referee_name: string;
      snapshot_vessel_name: string;
      snapshot_start_date: string;
      snapshot_end_date: string | null;
      comment: string | null;
    };
    const refereeName = r.referee_person_id
      ? await getDisplayName(sc, r.referee_person_id)
      : r.claimed_referee_name;
    // Reference snapshots predate the multi-vessel-type column, so we
    // render M/Y by default — the snapshot vessel name is already what
    // both parties confirmed at request time.
    const vesselLabel = formatVesselName(r.snapshot_vessel_name, 'motor');
    const dateRange = formatReferenceDateRange(r.snapshot_start_date, r.snapshot_end_date);
    if (eventType === 'REFERENCE.ACCEPTED') {
      const tpl = referenceAcceptedEmail({
        recipientName,
        refereeName,
        refereeRole: r.claimed_referee_role,
        vesselLabel,
        dateRange,
        comment: r.comment,
      });
      await sendEmail({ to: email, ...tpl });
    } else {
      const cleared = payload.cleared === true;
      const tpl = referenceCommentUpdatedEmail({
        recipientName,
        refereeName,
        refereeRole: r.claimed_referee_role,
        vesselLabel,
        dateRange,
        newComment: cleared ? null : r.comment,
        cleared,
      });
      await sendEmail({ to: email, ...tpl });
    }
  }
}
