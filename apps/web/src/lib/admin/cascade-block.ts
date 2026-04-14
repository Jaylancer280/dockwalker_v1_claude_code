import type { SupabaseClient } from '@supabase/supabase-js';
import { appendEvents, type AppendEventParams } from '@dockwalker/db';
import type { EventPayloadMap } from '@dockwalker/types';

interface CascadeOptions {
  reasonCategory?: string;
  reasonText?: string;
}

export async function cascadeBlock(
  serviceClient: SupabaseClient,
  personId: string,
  adminPersonId: string,
  options?: CascadeOptions,
) {
  const reasonCategory = options?.reasonCategory ?? 'other';
  const reasonText = options?.reasonText ?? 'Account suspended by DockWalker';
  const [
    { data: activeEngagements },
    { data: activePostingsDW },
    { data: activePostingsPM },
    { data: futureAvailability },
  ] = await Promise.all([
    serviceClient
      .from('active_engagements')
      .select('id, daywork_id, permanent_posting_id')
      .or(`crew_person_id.eq.${personId},employer_person_id.eq.${personId}`)
      .eq('status', 'active'),
    serviceClient
      .from('dayworks')
      .select('id')
      .eq('poster_person_id', personId)
      .in('status', ['active', 'in_progress']),
    serviceClient
      .from('permanent_postings')
      .select('id')
      .eq('employer_person_id', personId)
      .in('status', ['active', 'in_negotiation']),
    serviceClient
      .from('availability_windows')
      .select('id')
      .eq('person_id', personId)
      .gt('expires_at', new Date().toISOString())
      .limit(1),
  ]);

  const events: AppendEventParams<keyof EventPayloadMap>[] = [
    {
      eventType: 'ADMIN.USER_BLOCKED',
      aggregateId: personId,
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: {
        person_id: personId,
        reason_category: reasonCategory,
        reason_text: reasonText,
        admin_person_id: adminPersonId,
      },
      personId: adminPersonId,
    },
  ];

  for (const eng of activeEngagements ?? []) {
    events.push({
      eventType: 'ADMIN.ENGAGEMENT_CANCELLED',
      aggregateId: eng.id,
      aggregateType: 'admin',
      roleContext: 'employer',
      payload: {
        engagement_id: eng.id,
        posting_type: eng.daywork_id ? 'daywork' : 'permanent',
        daywork_id: eng.daywork_id ?? undefined,
        permanent_posting_id: eng.permanent_posting_id ?? undefined,
        reason_category: 'other',
        reason_text: 'Account deleted by DockWalker',
        admin_person_id: adminPersonId,
      },
      personId: adminPersonId,
    });
  }

  const cascadedDayworkIds = new Set(
    (activeEngagements ?? []).filter((e) => e.daywork_id).map((e) => e.daywork_id),
  );
  const cascadedPermanentIds = new Set(
    (activeEngagements ?? [])
      .filter((e) => e.permanent_posting_id)
      .map((e) => e.permanent_posting_id),
  );

  for (const posting of activePostingsDW ?? []) {
    if (!cascadedDayworkIds.has(posting.id)) {
      events.push({
        eventType: 'ADMIN.POSTING_HIDDEN',
        aggregateId: posting.id,
        aggregateType: 'admin',
        roleContext: 'employer',
        payload: {
          posting_id: posting.id,
          posting_type: 'daywork',
          reason: 'Account deleted by DockWalker',
          admin_person_id: adminPersonId,
        },
        personId: adminPersonId,
      });
    }
  }

  for (const posting of activePostingsPM ?? []) {
    if (!cascadedPermanentIds.has(posting.id)) {
      events.push({
        eventType: 'ADMIN.POSTING_HIDDEN',
        aggregateId: posting.id,
        aggregateType: 'admin',
        roleContext: 'employer',
        payload: {
          posting_id: posting.id,
          posting_type: 'permanent',
          reason: 'Account deleted by DockWalker',
          admin_person_id: adminPersonId,
        },
        personId: adminPersonId,
      });
    }
  }

  if ((futureAvailability ?? []).length > 0) {
    const today = new Date().toISOString().split('T')[0];
    events.push({
      eventType: 'AVAILABILITY.SET',
      aggregateId: personId,
      aggregateType: 'person',
      roleContext: 'crew',
      payload: {
        not_available: true,
        start_date: today,
        end_date: today,
        expires_at: new Date().toISOString(),
      },
      personId,
    });
  }

  await appendEvents(serviceClient, events);

  await serviceClient
    .from('applications')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('crew_person_id', personId)
    .in('status', ['applied', 'viewed', 'shortlisted']);

  await serviceClient.from('notifications').delete().eq('person_id', personId).eq('read', false);

  return {
    engagements_cancelled: (activeEngagements ?? []).length,
    postings_hidden:
      (activePostingsDW ?? []).length +
      (activePostingsPM ?? []).length -
      cascadedDayworkIds.size -
      cascadedPermanentIds.size,
    availability_cleared: (futureAvailability ?? []).length > 0,
  };
}
