import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser, type PushNotification } from './push-delivery';
import { sendEmail } from './email/send';
import {
  applicationAcceptedEmail,
  applicationReceivedEmail,
  newMessageEmail,
  permanentShortlistedEmail,
  permanentSelectedEmail,
  permanentPlacementConfirmedEmail,
} from './email/templates';

interface NotifyContext {
  recipientPersonId: string;
  notification: PushNotification;
  roleContext: 'crew' | 'employer';
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

function mapEventToNotificationType(eventType: string): string | null {
  const map: Record<string, string> = {
    'DAYWORK.APPLIED': 'application_received',
    'DAYWORK.ACCEPTED': 'application_accepted',
    'DAYWORK.REJECTED': 'application_rejected',
    'DAYWORK.INVITED': 'invitation_received',
    'DAYWORK.SHORTLISTED': 'application_shortlisted',
    'DAYWORK.INVITATION_ACCEPTED': 'invitation_accepted',
    'DAYWORK.POSTED': 'new_job_posted',
    'MESSAGE.SENT': 'message_received',
    'DAYWORK.COMPLETED': 'job_completed',
    'ENGAGEMENT.CANCELLED_BY_CREW': 'engagement_cancelled',
    'ENGAGEMENT.CANCELLED_BY_EMPLOYER': 'engagement_cancelled',
    'ENGAGEMENT.WORK_STARTED': 'work_started',
    'ENGAGEMENT.WORK_STARTED_CONFIRMED': 'work_started_confirmed',
    'ENGAGEMENT.POSTPONEMENT_PROPOSED': 'postponement_proposed',
    'CHECKLIST.SET': 'checklist_updated',
    'PERMANENT.APPLIED': 'permanent_application_received',
    'PERMANENT.SHORTLISTED': 'permanent_shortlisted',
    'PERMANENT.SELECTED': 'permanent_selected',
    'PERMANENT.REJECTED': 'permanent_rejected',
    'PERMANENT.PLACEMENT_CONFIRMED': 'permanent_placed',
    'PERMANENT.SELECTION_REVERTED': 'permanent_selection_reverted',
    'PERMANENT.CANCELLED_BY_EMPLOYER': 'permanent_posting_cancelled',
    'PERMANENT.ENGAGEMENT_CLOSED': 'permanent_conversation_closed',
  };
  return map[eventType] ?? null;
}

function resolveDeepLink(eventType: string, payload: Record<string, unknown>): string | null {
  switch (eventType) {
    case 'DAYWORK.APPLIED':
      return payload.daywork_id ? `/daywork/${payload.daywork_id}/review` : null;
    case 'DAYWORK.ACCEPTED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'DAYWORK.INVITED':
      return '/daywork/invitations';
    case 'DAYWORK.INVITATION_ACCEPTED':
      return payload.daywork_id ? `/daywork/${payload.daywork_id}/review` : null;
    case 'MESSAGE.SENT':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'DAYWORK.POSTED':
      return '/discover';
    case 'DAYWORK.COMPLETED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.CANCELLED_BY_CREW':
    case 'ENGAGEMENT.CANCELLED_BY_EMPLOYER':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.POSTPONEMENT_PROPOSED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'CHECKLIST.SET':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'ENGAGEMENT.WORK_STARTED_CONFIRMED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'PERMANENT.APPLIED':
      return payload.permanent_posting_id
        ? `/permanent/${payload.permanent_posting_id}/review`
        : null;
    case 'PERMANENT.SELECTED':
      return payload.engagement_id ? `/messages/${payload.engagement_id}` : null;
    case 'PERMANENT.SHORTLISTED':
    case 'PERMANENT.REJECTED':
    case 'PERMANENT.PLACEMENT_CONFIRMED':
    case 'PERMANENT.SELECTION_REVERTED':
    case 'PERMANENT.CANCELLED_BY_EMPLOYER':
      return '/discover';
    case 'PERMANENT.ENGAGEMENT_CLOSED':
      return null;
    default:
      return null;
  }
}

async function resolveNotification(
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

    default:
      return [];
  }
}

// ---- Helpers ----

async function getJobNumber(sc: SupabaseClient, dayworkId: string): Promise<string> {
  const { data } = await sc.from('dayworks').select('job_number').eq('id', dayworkId).single();
  return data?.job_number ? `DW-${String(data.job_number).padStart(5, '0')}` : 'a daywork';
}

async function getDisplayName(sc: SupabaseClient, personId: string): Promise<string> {
  const { data } = await sc
    .from('profiles')
    .select('display_name')
    .eq('person_id', personId)
    .single();
  return data?.display_name ?? 'Someone';
}

async function getEngagementParties(
  sc: SupabaseClient,
  engagementId: string,
): Promise<{
  crew_person_id: string;
  employer_person_id: string;
  daywork_id: string;
  permanent_posting_id: string | null;
} | null> {
  const { data } = await sc
    .from('active_engagements')
    .select('crew_person_id, employer_person_id, daywork_id, permanent_posting_id')
    .eq('id', engagementId)
    .single();
  return data;
}

async function getPermanentPostingInfo(
  sc: SupabaseClient,
  postingId: string,
): Promise<{ employer_person_id: string; role_name: string; job_number: string } | null> {
  const { data } = await sc
    .from('permanent_postings')
    .select('employer_person_id, job_number, yacht_roles(name)')
    .eq('id', postingId)
    .single();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleName = (data as any).yacht_roles?.name ?? 'Permanent role';
  return {
    employer_person_id: data.employer_person_id,
    role_name: roleName,
    job_number: `PM-${String(data.job_number).padStart(5, '0')}`,
  };
}

async function getDayworkPoster(sc: SupabaseClient, dayworkId: string): Promise<string | null> {
  const { data } = await sc
    .from('dayworks')
    .select('poster_person_id')
    .eq('id', dayworkId)
    .single();
  return data?.poster_person_id ?? null;
}

// ---- Handlers ----

async function handleDayworkApplied(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const dayworkId = payload.daywork_id as string;
  const [jobNumber, posterId] = await Promise.all([
    getJobNumber(sc, dayworkId),
    getDayworkPoster(sc, dayworkId),
  ]);
  if (!posterId) return [];
  return [
    {
      recipientPersonId: posterId,
      roleContext: 'employer',
      notification: {
        title: 'New Applicant',
        body: `New applicant for ${jobNumber}`,
        data: { screen: 'review', dayworkId },
      },
    },
  ];
}

async function handleDayworkAccepted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const dayworkId = payload.daywork_id as string;
  const engagementId = payload.engagement_id as string | undefined;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Application Accepted',
        body: `You've been accepted for ${jobNumber}!`,
        data: { screen: 'chat', ...(engagementId ? { engagementId } : {}) },
      },
    },
  ];
}

async function handleDayworkRejected(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Application Update',
        body: `Update on your application for ${jobNumber}`,
        data: { screen: 'discover' },
      },
    },
  ];
}

async function handleDayworkShortlisted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Shortlisted',
        body: `You've been shortlisted for ${jobNumber}`,
        data: { screen: 'discover' },
      },
    },
  ];
}

async function handleDayworkInvited(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'New Invitation',
        body: `You've been invited to ${jobNumber}`,
        data: { screen: 'discover', type: 'invitation' },
      },
    },
  ];
}

async function handleInvitationAccepted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const dayworkId = payload.daywork_id as string;
  const [jobNumber, posterId] = await Promise.all([
    getJobNumber(sc, dayworkId),
    getDayworkPoster(sc, dayworkId),
  ]);
  if (!posterId) return [];

  const { data: dw } = await sc.from('dayworks').select('role_id').eq('id', dayworkId).single();
  let roleName = 'daywork';
  if (dw?.role_id) {
    const { data: role } = await sc
      .from('yacht_roles')
      .select('name')
      .eq('id', dw.role_id)
      .single();
    if (role?.name) roleName = role.name;
  }

  return [
    {
      recipientPersonId: posterId,
      roleContext: 'employer',
      notification: {
        title: 'Invitation Accepted',
        body: `Invitation accepted for ${roleName} — ${jobNumber}`,
        data: { screen: 'review', dayworkId },
      },
    },
  ];
}

async function handleMessageSent(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  if (payload.is_system) return [];

  const engagementId = payload.engagement_id as string;
  const content = payload.content as string;
  const engagement = await getEngagementParties(sc, engagementId);
  if (!engagement) return [];

  const isSenderCrew = engagement.crew_person_id === actorPersonId;
  const recipientId = isSenderCrew ? engagement.employer_person_id : engagement.crew_person_id;
  const recipientHat: 'crew' | 'employer' = isSenderCrew ? 'employer' : 'crew';

  const senderName = await getDisplayName(sc, actorPersonId);
  const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;

  return [
    {
      recipientPersonId: recipientId,
      roleContext: recipientHat,
      notification: {
        title: senderName,
        body: preview,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

async function handleWorkStarted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
  eventType: string,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string;
  const engagement = await getEngagementParties(sc, engagementId);
  if (!engagement) return [];

  const isSenderCrew = engagement.crew_person_id === actorPersonId;
  const recipientId = isSenderCrew ? engagement.employer_person_id : engagement.crew_person_id;
  const recipientHat: 'crew' | 'employer' = isSenderCrew ? 'employer' : 'crew';

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  const isConfirm = eventType === 'ENGAGEMENT.WORK_STARTED_CONFIRMED';

  return [
    {
      recipientPersonId: recipientId,
      roleContext: recipientHat,
      notification: {
        title: isConfirm ? 'Work Started' : 'Confirmation Needed',
        body: isConfirm
          ? `Work started confirmed for ${jobNumber}`
          : `Work started confirmation requested for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

async function handleCancelledByCrew(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string;
  const dayworkId = payload.daywork_id as string;
  const engagement = await getEngagementParties(sc, engagementId);
  if (!engagement) return [];

  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: engagement.employer_person_id,
      roleContext: 'employer',
      notification: {
        title: 'Engagement Cancelled',
        body: `Crew cancelled engagement for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

async function handleCancelledByEmployer(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const engagementId = payload.engagement_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Engagement Cancelled',
        body: `Engagement cancelled for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

async function handleDayworkCompleted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);

  // Look up all engagements to find crew members (multi-crew support)
  const { data: engagements } = await sc
    .from('active_engagements')
    .select('id, crew_person_id')
    .eq('daywork_id', dayworkId)
    .in('status', ['active', 'completed']);

  if (!engagements || engagements.length === 0) return [];

  return engagements.map((engagement) => ({
    recipientPersonId: engagement.crew_person_id,
    roleContext: 'crew' as const,
    notification: {
      title: 'Job Completed',
      body: `${jobNumber} marked complete — please confirm`,
      data: { screen: 'chat', engagementId: engagement.id },
    },
  }));
}

async function handlePostponement(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const engagementId = payload.engagement_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Date Change Proposed',
        body: `Date change proposed for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

async function handleChecklist(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string;
  const engagement = await getEngagementParties(sc, engagementId);
  if (!engagement) return [];

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  return [
    {
      recipientPersonId: engagement.crew_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Checklist Updated',
        body: `Pre-arrival checklist updated for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}

// ---- Permanent handlers ----

async function handlePermanentApplied(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  const crewName = await getDisplayName(sc, actorPersonId);
  return [
    {
      recipientPersonId: info.employer_person_id,
      roleContext: 'employer',
      notification: {
        title: `New application for ${info.role_name}`,
        body: `${crewName} applied to ${info.job_number}`,
        data: { screen: 'review', permanentPostingId: postingId },
      },
    },
  ];
}

async function handlePermanentShortlisted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const crewId = payload.crew_person_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: `You've been shortlisted`,
        body: `You've been shortlisted for ${info.role_name} — ${info.job_number}`,
        data: { screen: 'discover' },
      },
    },
  ];
}

async function handlePermanentSelected(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const crewId = payload.crew_person_id as string;
  const engagementId = payload.engagement_id as string | undefined;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: `You've been selected`,
        body: `You've been selected for ${info.role_name} — check your messages`,
        data: { screen: 'chat', ...(engagementId ? { engagementId } : {}) },
      },
    },
  ];
}

async function handlePermanentRejected(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const crewId = payload.crew_person_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Application Update',
        body: `Update on your ${info.role_name} application`,
        data: { screen: 'discover' },
      },
    },
  ];
}

async function handlePermanentPlacementConfirmed(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  const results: NotifyContext[] = [];

  // Notify placed crew (from active engagement)
  const { data: eng } = await sc
    .from('active_engagements')
    .select('crew_person_id')
    .eq('permanent_posting_id', postingId)
    .eq('status', 'active')
    .single();
  if (eng) {
    results.push({
      recipientPersonId: eng.crew_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Placement Confirmed',
        body: `Your placement as ${info.role_name} is confirmed`,
        data: { screen: 'discover' },
      },
    });
  }

  // Notify remaining not-selected
  const { data: notSelected } = await sc
    .from('applications')
    .select('crew_person_id')
    .eq('permanent_posting_id', postingId)
    .eq('status', 'not_selected');
  for (const app of notSelected ?? []) {
    if (app.crew_person_id !== eng?.crew_person_id) {
      results.push({
        recipientPersonId: app.crew_person_id,
        roleContext: 'crew',
        notification: {
          title: 'Position Filled',
          body: `The ${info.role_name} position has been filled`,
          data: { screen: 'discover' },
        },
      });
    }
  }

  return results;
}

async function handlePermanentSelectionReverted(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const engagementId = payload.engagement_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  const parties = await getEngagementParties(sc, engagementId);
  if (!parties) return [];
  return [
    {
      recipientPersonId: parties.crew_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Selection Update',
        body: `The employer is reviewing other candidates for ${info.role_name}`,
        data: { screen: 'discover' },
      },
    },
  ];
}

async function handlePermanentCancelled(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const postingId = payload.permanent_posting_id as string;
  const info = await getPermanentPostingInfo(sc, postingId);
  if (!info) return [];
  const { data: apps } = await sc
    .from('applications')
    .select('crew_person_id')
    .eq('permanent_posting_id', postingId)
    .neq('status', 'withdrawn');
  const crewIds = [...new Set((apps ?? []).map((a) => a.crew_person_id as string))];
  return crewIds.map((crewId) => ({
    recipientPersonId: crewId,
    roleContext: 'crew' as const,
    notification: {
      title: 'Posting Closed',
      body: `${info.role_name} posting has been closed`,
      data: { screen: 'discover' },
    },
  }));
}

async function handlePermanentEngagementClosed(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string;
  const parties = await getEngagementParties(sc, engagementId);
  if (!parties) return [];
  const recipientId =
    parties.crew_person_id === actorPersonId ? parties.employer_person_id : parties.crew_person_id;
  const recipientHat: 'crew' | 'employer' =
    parties.crew_person_id === actorPersonId ? 'employer' : 'crew';
  return [
    {
      recipientPersonId: recipientId,
      roleContext: recipientHat,
      notification: { title: 'Conversation Closed', body: 'Conversation closed', data: {} },
    },
  ];
}

// ---- Email notification delivery ----

async function sendEmailForEvent(
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

// ---- Email rate limiting for messages ----

const messageEmailTimestamps = new Map<string, number>();
const MESSAGE_EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function shouldSendMessageEmail(engagementId: string): boolean {
  const last = messageEmailTimestamps.get(engagementId);
  const now = Date.now();
  if (last && now - last < MESSAGE_EMAIL_COOLDOWN_MS) return false;
  messageEmailTimestamps.set(engagementId, now);
  return true;
}

export async function getRecipientEmail(
  sc: SupabaseClient,
  personId: string,
): Promise<string | null> {
  const { data } = await sc.auth.admin.getUserById(personId);
  return data?.user?.email ?? null;
}

// ---- Broadcast: DAYWORK.POSTED ----

const BROADCAST_WINDOW_MS = 60_000;

interface BroadcastEntry {
  timer: ReturnType<typeof setTimeout>;
  dayworkIds: string[];
  sc: SupabaseClient;
  posterPersonId: string;
}

// Exported for testing
export const broadcastQueue = new Map<string, BroadcastEntry>();

function enqueueBroadcast(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  posterPersonId: string,
): void {
  const dayworkId = payload.id as string;
  const portId = payload.location_port_id as string;

  // Resolve port → city, then enqueue
  resolveCityForPort(sc, portId)
    .then((cityId) => {
      if (!cityId) return;

      const existing = broadcastQueue.get(cityId);
      if (existing) {
        existing.dayworkIds.push(dayworkId);
        return;
      }

      const entry: BroadcastEntry = {
        timer: setTimeout(() => {
          broadcastQueue.delete(cityId);
          fireBroadcast(entry.sc, cityId, entry.dayworkIds, entry.posterPersonId).catch(() => {});
        }, BROADCAST_WINDOW_MS),
        dayworkIds: [dayworkId],
        sc,
        posterPersonId,
      };
      broadcastQueue.set(cityId, entry);
    })
    .catch(() => {});
}

async function resolveCityForPort(sc: SupabaseClient, portId: string): Promise<string | null> {
  const { data } = await sc.from('ports').select('city_id').eq('id', portId).single();
  return data?.city_id ?? null;
}

async function fireBroadcast(
  sc: SupabaseClient,
  cityId: string,
  dayworkIds: string[],
  posterPersonId: string,
): Promise<void> {
  // Find crew with active availability in this city
  const { data: windows } = await sc
    .from('availability_windows')
    .select('person_id')
    .eq('city_id', cityId)
    .eq('not_available', false)
    .gt('expires_at', new Date().toISOString());

  if (!windows || windows.length === 0) return;

  // Deduplicate and exclude the poster
  const recipientIds = [...new Set(windows.map((w) => w.person_id as string))].filter(
    (id) => id !== posterPersonId,
  );

  if (recipientIds.length === 0) return;

  let notification: PushNotification;

  if (dayworkIds.length === 1) {
    // Single posting — include specific details
    const jobNumber = await getJobNumber(sc, dayworkIds[0]);
    const { data: dw } = await sc
      .from('dayworks')
      .select('role_id')
      .eq('id', dayworkIds[0])
      .single();
    let roleName = 'daywork';
    if (dw?.role_id) {
      const { data: role } = await sc
        .from('yacht_roles')
        .select('name')
        .eq('id', dw.role_id)
        .single();
      if (role?.name) roleName = role.name;
    }
    const { data: city } = await sc.from('cities').select('name').eq('id', cityId).single();
    const cityName = city?.name ?? 'your area';

    notification = {
      title: 'New Daywork',
      body: `New ${roleName} daywork in ${cityName} — ${jobNumber}`,
      data: { screen: 'discover', dayworkId: dayworkIds[0] },
    };
  } else {
    // Collapsed — multiple postings
    const { data: city } = await sc.from('cities').select('name').eq('id', cityId).single();
    const cityName = city?.name ?? 'your area';

    notification = {
      title: 'New Daywork',
      body: `${dayworkIds.length} new daywork opportunities in ${cityName}`,
      data: { screen: 'discover' },
    };
  }

  for (const recipientId of recipientIds) {
    sendPushToUser(sc, recipientId, notification).catch(() => {});
  }
}
