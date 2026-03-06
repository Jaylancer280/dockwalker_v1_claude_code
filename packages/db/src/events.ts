import type { SupabaseClient } from '@supabase/supabase-js';
import type { AggregateType, EventType, RoleContext } from '@dockwalker/types';

export interface AppendEventParams {
  eventType: EventType;
  aggregateId: string;
  aggregateType: AggregateType;
  roleContext: RoleContext;
  payload: Record<string, unknown>;
  personId: string;
}

/**
 * Append an event to the event log and update projections atomically.
 * Calls the Postgres `append_event` function which runs both operations
 * in the same transaction.
 *
 * @returns The event ID on success
 * @throws Error if the RPC call fails
 */
export async function appendEvent(
  supabase: SupabaseClient,
  params: AppendEventParams,
): Promise<string> {
  const { data, error } = await supabase.rpc('append_event', {
    p_event_type: params.eventType,
    p_aggregate_id: params.aggregateId,
    p_aggregate_type: params.aggregateType,
    p_role_context: params.roleContext,
    p_payload: params.payload,
    p_person_id: params.personId,
  });

  if (error) {
    throw new Error(`append_event failed [${params.eventType}]: ${error.message}`);
  }

  return data as string;
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
