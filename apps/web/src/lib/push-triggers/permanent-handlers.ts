import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';
import { getDisplayName, getEngagementParties, getPermanentPostingInfo } from './loaders';

/**
 * PERMANENT.INVITED — captain/agent invited a specific crew to apply.
 *
 * Notification body content-pass per spec v2.1:
 *   "Captain James invited you to apply for Bosun on M/Y Serenity"
 *
 * Deep link drops the crew straight into the apply form with the
 * invitation id pre-filled (the apply page reads `?from_invitation=`
 * and renders the context banner).
 */
export async function handlePermanentInvited(
  sc: SupabaseClient,
  payload: Record<string, unknown>,
  actorPersonId: string,
): Promise<NotifyContext[]> {
  const invitationId = payload.id as string;
  const postingId = payload.permanent_posting_id as string;
  const crewId = payload.crew_person_id as string;

  const [posting, captainName] = await Promise.all([
    getPermanentPostingInfo(sc, postingId),
    getDisplayName(sc, actorPersonId),
  ]);
  if (!posting) return [];

  // Vessel name is a separate query — getPermanentPostingInfo doesn't
  // currently load it and adding it there would broaden the surface
  // for other PERMANENT handlers that don't need it.
  let vesselName: string | null = null;
  const { data: postingRow } = await sc
    .from('permanent_postings')
    .select('vessels(name)')
    .eq('id', postingId)
    .single();
  if (postingRow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vesselName = (postingRow as any).vessels?.name ?? null;
  }

  const onVessel = vesselName ? ` on ${vesselName}` : '';
  return [
    {
      recipientPersonId: crewId,
      roleContext: 'crew',
      notification: {
        title: 'Invited to apply',
        body: `${captainName} invited you to apply for ${posting.role_name}${onVessel}`,
        data: {
          screen: 'permanent-apply',
          permanentPostingId: postingId,
          fromInvitation: invitationId,
        },
      },
    },
  ];
}

export async function handlePermanentApplied(
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

export async function handlePermanentShortlisted(
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

export async function handlePermanentSelected(
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

export async function handlePermanentRejected(
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

export async function handlePermanentPlacementConfirmed(
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

export async function handlePermanentSelectionReverted(
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

export async function handlePermanentCancelled(
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

export async function handlePermanentEngagementClosed(
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
