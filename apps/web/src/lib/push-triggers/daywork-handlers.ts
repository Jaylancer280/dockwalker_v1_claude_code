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
