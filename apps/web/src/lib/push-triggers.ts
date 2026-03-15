import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser, type PushNotification } from './push-delivery';

interface NotifyContext {
  recipientPersonId: string;
  notification: PushNotification;
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
        sendPushToUser(serviceClient, ctx.recipientPersonId, ctx.notification).catch(() => {
          // swallow — push delivery errors are non-fatal
        });
      }
    })
    .catch(() => {
      // swallow — resolution errors are non-fatal
    });
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
): Promise<{ crew_person_id: string; employer_person_id: string; daywork_id: string } | null> {
  const { data } = await sc
    .from('active_engagements')
    .select('crew_person_id, employer_person_id, daywork_id')
    .eq('id', engagementId)
    .single();
  return data;
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
      notification: {
        title: 'New Invitation',
        body: `You've been invited to ${jobNumber}`,
        data: { screen: 'discover', type: 'invitation' },
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

  const recipientId =
    engagement.crew_person_id === actorPersonId
      ? engagement.employer_person_id
      : engagement.crew_person_id;

  const senderName = await getDisplayName(sc, actorPersonId);
  const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;

  return [
    {
      recipientPersonId: recipientId,
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

  const recipientId =
    engagement.crew_person_id === actorPersonId
      ? engagement.employer_person_id
      : engagement.crew_person_id;

  const jobNumber = await getJobNumber(sc, engagement.daywork_id);
  const isConfirm = eventType === 'ENGAGEMENT.WORK_STARTED_CONFIRMED';

  return [
    {
      recipientPersonId: recipientId,
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

  // Look up the engagement to find the crew member
  const { data: engagement } = await sc
    .from('active_engagements')
    .select('id, crew_person_id')
    .eq('daywork_id', dayworkId)
    .single();

  if (!engagement) return [];

  return [
    {
      recipientPersonId: engagement.crew_person_id,
      notification: {
        title: 'Job Completed',
        body: `${jobNumber} marked complete — please confirm`,
        data: { screen: 'chat', engagementId: engagement.id },
      },
    },
  ];
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
      notification: {
        title: 'Checklist Updated',
        body: `Pre-arrival checklist updated for ${jobNumber}`,
        data: { screen: 'chat', engagementId },
      },
    },
  ];
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
