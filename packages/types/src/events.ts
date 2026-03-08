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
  | 'DAYWORK.SHORTLISTED'
  | 'DAYWORK.ACCEPTED'
  | 'DAYWORK.REJECTED'
  | 'APPLICATION.WITHDRAWN'
  | 'APPLICATION.SUPERSEDED'
  // Engagement aggregate
  | 'ENGAGEMENT.CANCELLED_BY_CREW'
  | 'ENGAGEMENT.CANCELLED_BY_EMPLOYER'
  | 'ENGAGEMENT.COMPLETION_CONFIRMED'
  | 'ENGAGEMENT.COMPLETION_DISPUTED'
  | 'ENGAGEMENT.RATED_BY_CREW'
  | 'ENGAGEMENT.RATED_BY_EMPLOYER'
  // Availability (person aggregate)
  | 'AVAILABILITY.SET'
  // Message aggregate
  | 'MESSAGE.SENT';

/** Aggregate types that events reference */
export type AggregateType = 'person' | 'vessel' | 'daywork' | 'application' | 'message' | 'engagement';

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

/**
 * Per-event payload type map.
 * Every event emitted by the API must conform to these shapes.
 */
export interface EventPayloadMap {
  'PERSON.CREATED': { identity_type: string; current_hat: string };
  'PERSON.HAT_CHANGED': { current_hat: 'crew' | 'employer' };
  'PERSON.DEACTIVATED': Record<string, never>;
  'PERSON.DATA_SCRUBBED': Record<string, never>;
  'PROFILE.CREATED': {
    display_name: string;
    identity_type: string;
    primary_role_id: string;
    certification_ids: string[];
    experience_bracket_id: string;
    vessel_size_exposure_ids: string[];
    bio: string | null;
    agency_name?: string | null;
    role_specialization_ids?: string[];
    location_port_id: string;
  };
  'PROFILE.UPDATED': {
    display_name?: string;
    primary_role_id?: string;
    certification_ids?: string[];
    experience_bracket_id?: string;
    vessel_size_exposure_ids?: string[];
    bio?: string | null;
    agency_name?: string | null;
    role_specialization_ids?: string[];
    location_port_id?: string;
  };
  'AGENT.VERIFIED': Record<string, never>;
  'VESSEL.CREATED': {
    id: string;
    imo_number: string;
    name: string;
    vessel_type: string;
    size_band_id: string;
    nda_flag: boolean;
  };
  'VESSEL.UPDATED': {
    name?: string;
    vessel_type?: string;
    size_band_id?: string;
    nda_flag?: boolean;
  };
  'DAYWORK.POSTED': {
    id: string;
    vessel_id: string;
    role_id: string;
    location_port_id: string;
    start_date: string;
    end_date: string;
    working_days: number;
    required_certification_ids: string[];
    experience_bracket_id: string | null;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
  };
  'DAYWORK.CANCELLED_BY_EMPLOYER': Record<string, never>;
  'DAYWORK.COMPLETED': { daywork_id: string };
  'DAYWORK.APPLIED': {
    id: string;
    daywork_id: string;
    crew_person_id?: string;
    message?: string | null;
  };
  'DAYWORK.VIEWED': { daywork_id: string; crew_person_id: string };
  'DAYWORK.SHORTLISTED': { daywork_id: string; crew_person_id: string };
  'DAYWORK.ACCEPTED': {
    daywork_id: string;
    crew_person_id: string;
    employer_person_id?: string;
    start_date?: string;
    end_date?: string;
  };
  'DAYWORK.REJECTED': { daywork_id: string; crew_person_id: string };
  'APPLICATION.WITHDRAWN': { daywork_id: string; crew_person_id: string };
  'APPLICATION.SUPERSEDED': Record<string, never>;
  'ENGAGEMENT.CANCELLED_BY_CREW': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
  };
  'ENGAGEMENT.CANCELLED_BY_EMPLOYER': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
  };
  'ENGAGEMENT.COMPLETION_CONFIRMED': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
    confirmed: boolean;
  };
  'ENGAGEMENT.COMPLETION_DISPUTED': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
    confirmed: boolean;
  };
  'ENGAGEMENT.RATED_BY_CREW': {
    engagement_id: string;
    pay_accuracy: string;
    meals_accuracy: string;
    role_accuracy: string;
    working_days_accuracy: string;
    vessel_condition: number;
    would_work_on_vessel_again: boolean;
    communication_accuracy: boolean;
    overall_match: number;
  };
  'ENGAGEMENT.RATED_BY_EMPLOYER': {
    engagement_id: string;
    skills_as_advertised: string;
    certifications_verified: string;
    punctuality: string;
    would_rehire: boolean;
    communication_accuracy: boolean;
    overall_match: number;
  };
  'AVAILABILITY.SET': {
    start_date: string;
    end_date: string;
    expires_at: string;
  };
  'MESSAGE.SENT': {
    id: string;
    engagement_id?: string;
    sender_person_id?: string;
    content: string;
  };
}
