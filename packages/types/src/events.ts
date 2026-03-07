import type { RoleContext } from './enums';

/** All event types in the system, namespaced for extensibility */
export type EventType =
  // Person aggregate
  | 'PERSON.CREATED'
  | 'PERSON.HAT_CHANGED'
  | 'PERSON.DEACTIVATED'
  | 'PERSON.DATA_SCRUBBED'
  // Profile (person aggregate)
  | 'PROFILE.CREATED'
  | 'PROFILE.UPDATED'
  // Agent (person aggregate)
  | 'AGENT.VERIFIED'
  // Vessel aggregate
  | 'VESSEL.CREATED'
  | 'VESSEL.UPDATED'
  // Daywork aggregate
  | 'DAYWORK.POSTED'
  | 'DAYWORK.CANCELLED_BY_EMPLOYER'
  | 'DAYWORK.COMPLETED'
  // Application aggregate
  | 'DAYWORK.APPLIED'
  | 'DAYWORK.VIEWED'
  | 'DAYWORK.ACCEPTED'
  | 'DAYWORK.REJECTED'
  | 'APPLICATION.WITHDRAWN'
  | 'APPLICATION.SUPERSEDED'
  | 'ENGAGEMENT.CANCELLED_BY_CREW'
  | 'ENGAGEMENT.CANCELLED_BY_EMPLOYER'
  // Availability (person aggregate)
  | 'AVAILABILITY.SET'
  // Message aggregate
  | 'MESSAGE.SENT'
  | 'MESSAGE.HIDDEN';

/** Aggregate types that events reference */
export type AggregateType = 'person' | 'vessel' | 'daywork' | 'application' | 'message';

/** Base event shape stored in the events table */
export interface DomainEvent {
  id: string;
  event_type: EventType;
  aggregate_id: string;
  aggregate_type: AggregateType;
  role_context: RoleContext;
  payload: Record<string, unknown>;
  person_id: string;
  created_at: string;
}
