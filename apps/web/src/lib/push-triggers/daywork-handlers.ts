import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import { getJobNumber, getDisplayName, getEngagementParties, getDayworkPoster } from './loaders';

export async function handleDayworkApplied(
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

export async function handleDayworkAccepted(
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

export async function handleDayworkRejected(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const crewId = payload.crew_person_id as string;
  const dayworkId = payload.daywork_id as string;
  const jobNumber = await getJobNumber(sc, dayworkId);
  // B-002: title stays neutral ("Application Update") so the badge doesn't
  // pre-load a negative emotion. Body leans forward toward the next role
  // rather than dwelling on closure. Telegram + WhatsApp surfaces have
  // their own warmer copy in their respective dispatchers.
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Application Update',
        body: `${jobNumber} went a different way — see what's open in your area`,
        data: { screen: 'discover' },
      },
    },
  ];
}

export async function handleDayworkShortlisted(
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

export async function handleDayworkInvited(
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

export async function handleInvitationAccepted(
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

  const engagementId = payload.engagement_id as string | undefined;

  return [
    {
      recipientPersonId: posterId,
      roleContext: 'employer',
      notification: {
        title: 'Invitation Accepted',
        body: `Invitation accepted for ${roleName} — ${jobNumber}. Chat is now open.`,
        data: engagementId ? { screen: 'messages', engagementId } : { screen: 'review', dayworkId },
      },
    },
  ];
}

export async function handleMessageSent(
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

export async function handleWorkStarted(
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

export async function handleCancelledByCrew(
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

export async function handleCancelledByEmployer(
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

export async function handleDayworkCompleted(
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

export async function handlePostponement(
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

export async function handleChecklist(
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

/**
 * ENGAGEMENT.COMPLETION_CONFIRMED — crew confirms the employer's "mark
 * complete". Notify the employer so they know the engagement closed
 * cleanly. Without this case the event was falling through to the
 * router default and producing zero notifications across every channel.
 */
export async function handleCompletionConfirmed(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string | undefined;
  // The aggregate_id for COMPLETION_CONFIRMED is the engagement_id when
  // payload omits it (older shape). Fall back to that.
  const eid = engagementId ?? (payload.aggregate_id as string | undefined);
  if (!eid) return [];
  const engagement = await getEngagementParties(sc, eid);
  if (!engagement) return [];

  // Notify the OTHER party — the actor is the confirmer (crew), so
  // ping the employer. Mirror logic for any future symmetric flow by
  // checking who the actor is.
  const isActorCrew = engagement.crew_person_id === actorPersonId;
  const recipientId = isActorCrew ? engagement.employer_person_id : engagement.crew_person_id;
  const recipientHat: 'crew' | 'employer' = isActorCrew ? 'employer' : 'crew';

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  return [
    {
      recipientPersonId: recipientId,
      roleContext: recipientHat,
      notification: {
        title: 'Completion confirmed',
        body: `Both sides have confirmed completion for ${jobNumber}.`,
        data: { screen: 'chat', engagementId: eid },
      },
    },
  ];
}

/**
 * ENGAGEMENT.COMPLETION_DISPUTED — crew disputes the employer's
 * "mark complete". Notify the employer so they can resolve.
 */
export async function handleCompletionDisputed(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string | undefined;
  const eid = engagementId ?? (payload.aggregate_id as string | undefined);
  if (!eid) return [];
  const engagement = await getEngagementParties(sc, eid);
  if (!engagement) return [];

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  return [
    {
      recipientPersonId: engagement.employer_person_id,
      roleContext: 'employer',
      notification: {
        title: 'Completion disputed',
        body: `The crew disputed the completion of ${jobNumber}. Open the chat to resolve.`,
        data: { screen: 'chat', engagementId: eid },
      },
    },
  ];
}

/**
 * ENGAGEMENT.POSTPONEMENT_ACCEPTED / POSTPONEMENT_REJECTED — the OTHER
 * party (typically the crew) responds to the employer's proposed date
 * change. Notify the employer (the proposer) so they know the new dates
 * stuck or the engagement just got cancelled. Body copy diverges per
 * eventType — passed in so one handler covers both.
 */
export async function handlePostponementResolved(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  eventType: string,
): Promise<NotifyContext[]> {
  const engagementId = payload.engagement_id as string | undefined;
  if (!engagementId) return [];
  const engagement = await getEngagementParties(sc, engagementId);
  if (!engagement) return [];

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  const accepted = eventType === 'ENGAGEMENT.POSTPONEMENT_ACCEPTED';
  return [
    {
      recipientPersonId: engagement.employer_person_id,
      roleContext: 'employer',
      notification: {
        title: accepted ? 'Date change accepted' : 'Date change rejected',
        body: accepted
          ? `Crew accepted your proposed date change for ${jobNumber}. New dates are now in effect.`
          : `Crew rejected your proposed date change for ${jobNumber} — engagement cancelled.`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
}
