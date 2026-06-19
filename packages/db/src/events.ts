import type { SupabaseClient } from '@supabase/supabase-js';
import type { AggregateType, EventPayloadMap, RoleContext } from '@dockwalker/types';

export type AppendEventParams<T extends keyof EventPayloadMap> = {
  eventType: T;
  aggregateId: string;
  aggregateType: AggregateType;
  roleContext: RoleContext;
  payload: EventPayloadMap[T];
  personId: string;
  /**
   * Optional idempotency key (D-1). When supplied, a retry of the
   * same event from the same person resolves to the original event
   * id without re-running the projection — prevents double-fills,
   * duplicate ratings, etc. when a network blip causes a client
   * retry. Recommended pattern: derive deterministically from
   * request context, e.g. `DAYWORK.ACCEPTED:${crewId}:${dayworkId}`.
   * Omit (undefined) for events that don't need dedup or where
   * legitimate duplicates are expected.
   */
  idempotencyKey?: string;
};

/**
 * Append an event to the event log and update projections atomically.
 * Calls the Postgres `append_event` function which runs both operations
 * in the same transaction.
 *
 * Payload is typed per event — the compiler rejects mismatched fields.
 *
 * @returns The event ID on success (or the original event id if a
 *          retry was deduped via the idempotency key).
 * @throws Error if the RPC call fails.
 */
export async function appendEvent<T extends keyof EventPayloadMap>(
  supabase: SupabaseClient,
  params: AppendEventParams<T>,
): Promise<string> {
  const { data, error } = await supabase.rpc('append_event', {
    p_event_type: params.eventType,
    p_aggregate_id: params.aggregateId,
    p_aggregate_type: params.aggregateType,
    p_role_context: params.roleContext,
    p_payload: params.payload,
    p_person_id: params.personId,
    p_idempotency_key: params.idempotencyKey ?? null,
  });

  if (error) {
    throw new Error(`append_event failed [${params.eventType}]: ${error.message}`);
  }

  return data as string;
}

/**
 * Append multiple events atomically in a single database transaction.
 * All events succeed or none do — prevents partial state from mid-flight failures.
 *
 * @returns Array of event IDs on success
 * @throws Error if the RPC call fails (all events are rolled back)
 */
export async function appendEvents<T extends keyof EventPayloadMap>(
  supabase: SupabaseClient,
  events: AppendEventParams<T>[],
): Promise<string[]> {
  if (events.length === 0) return [];
  if (events.length === 1) {
    const id = await appendEvent(supabase, events[0]);
    return [id];
  }

  const payload = events.map((e) => ({
    event_type: e.eventType,
    aggregate_id: e.aggregateId,
    aggregate_type: e.aggregateType,
    role_context: e.roleContext,
    payload: e.payload,
    person_id: e.personId,
  }));

  const { data, error } = await supabase.rpc('append_events_batch', {
    p_events: payload,
  });

  if (error) {
    throw new Error(`append_events_batch failed: ${error.message}`);
  }

  return data as string[];
}

/**
 * Check whether accepting a crew member for a daywork would cause a date overlap
 * with an existing active engagement.
 *
 * @returns true if no overlap (safe to accept), false if overlap exists
 */
export async function checkNoOverlap(
  supabase: SupabaseClient,
  crewPersonId: string,
  dayworkId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_no_overlap', {
    p_crew_person_id: crewPersonId,
    p_daywork_id: dayworkId,
  });

  if (error) {
    throw new Error(`check_no_overlap failed: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Check date overlap excluding a specific engagement.
 * Used for postponement proposals where the current engagement should not conflict with itself.
 *
 * @returns true if no overlap (safe), false if overlap exists
 */
export async function checkNoOverlapExcluding(
  supabase: SupabaseClient,
  crewPersonId: string,
  startDate: string,
  endDate: string,
  excludeEngagementId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_no_overlap_excluding', {
    p_crew_person_id: crewPersonId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_exclude_engagement_id: excludeEngagementId,
  });

  if (error) {
    throw new Error(`check_no_overlap_excluding failed: ${error.message}`);
  }

  return data as boolean;
}
