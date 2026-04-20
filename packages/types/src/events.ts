import type { RoleContext } from './enums';

/** All event types in the system, namespaced for extensibility */
export type EventType =
  // Person aggregate
  | 'PERSON.CREATED'
  | 'PERSON.HAT_CHANGED'
  | 'PERSON.DEACTIVATED'
  | 'PERSON.REACTIVATED'
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
  | 'DAYWORK.RELISTED'
  | 'DAYWORK.POSITIONS_UPDATED'
  | 'DAYWORK.EXTENDED'
  // Invitation (daywork aggregate)
  | 'DAYWORK.INVITED'
  | 'DAYWORK.INVITATION_ACCEPTED'
  | 'DAYWORK.INVITATION_DECLINED'
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
  | 'ENGAGEMENT.POSTPONEMENT_PROPOSED'
  | 'ENGAGEMENT.POSTPONEMENT_ACCEPTED'
  | 'ENGAGEMENT.POSTPONEMENT_REJECTED'
  | 'ENGAGEMENT.WORK_STARTED'
  | 'ENGAGEMENT.WORK_STARTED_CONFIRMED'
  | 'ENGAGEMENT.COMPLETION_CONFIRMED'
  | 'ENGAGEMENT.COMPLETION_DISPUTED'
  | 'ENGAGEMENT.RATED_BY_CREW'
  | 'ENGAGEMENT.RATED_BY_EMPLOYER'
  | 'ENGAGEMENT.CANCELLATION_RATED_BY_CREW'
  | 'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER'
  // Experience aggregate
  | 'EXPERIENCE.ADDED'
  | 'EXPERIENCE.UPDATED'
  | 'EXPERIENCE.REMOVED'
  // Checklist aggregate
  | 'CHECKLIST.SET'
  | 'CHECKLIST.ITEM_TOGGLED'
  // Availability (person aggregate)
  | 'AVAILABILITY.SET'
  // Message aggregate
  | 'MESSAGE.SENT'
  // Admin aggregate
  | 'ADMIN.ENGAGEMENT_COMPLETED'
  | 'ADMIN.CANONICAL_ADDED'
  | 'ADMIN.CANONICAL_UPDATED'
  | 'ADMIN.USER_BLOCKED'
  | 'ADMIN.USER_UNBLOCKED'
  | 'ADMIN.ENGAGEMENT_CANCELLED'
  | 'ADMIN.POSTING_HIDDEN'
  | 'SUPPORT.THREAD_OPENED'
  | 'SUPPORT.MESSAGE_SENT'
  // Permanent aggregate
  | 'PERMANENT.POSTED'
  | 'PERMANENT.APPLIED'
  | 'PERMANENT.APPLICATION_BLOCKED'
  | 'PERMANENT.SHORTLISTED'
  | 'PERMANENT.REJECTED'
  | 'PERMANENT.SELECTED'
  | 'PERMANENT.PLACEMENT_CONFIRMED'
  | 'PERMANENT.SELECTION_REVERTED'
  | 'PERMANENT.WITHDRAWN'
  | 'PERMANENT.CANCELLED_BY_EMPLOYER'
  | 'PERMANENT.ENGAGEMENT_CLOSED';

/** Aggregate types that events reference */
export type AggregateType = 'person' | 'vessel' | 'daywork' | 'application' | 'message' | 'engagement' | 'checklist' | 'experience' | 'invitation' | 'admin' | 'permanent' | 'support' | 'shore_experience';

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
  'PERSON.REACTIVATED': Record<string, never>;
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
    shore_experience?: string | null;
    motivation?: string | null;
    languages?: string[];
    available_to_start?: string | null;
    onboarding_version?: number;
    avatar_url?: string | null;
    nationality_id?: string | null;
    entry_right_ids?: string[];
    desired_role_id?: string | null;
    deck_name?: string | null;
    location_city_id?: string | null;
    smoker?: boolean | null;
    visible_tattoos?: boolean | null;
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
    shore_experience?: string | null;
    motivation?: string | null;
    languages?: string[];
    available_to_start?: string | null;
    avatar_url?: string | null;
    nationality_id?: string | null;
    entry_right_ids?: string[];
    permanent_availability?: string | null;
    notice_period_days?: number | null;
    currently_employed?: boolean;
    desired_role_id?: string | null;
    deck_name?: string | null;
    location_city_id?: string | null;
    smoker?: boolean | null;
    visible_tattoos?: boolean | null;
  };
  'AGENT.VERIFIED': Record<string, never>;
  'VESSEL.CREATED': {
    id: string;
    imo_number: string;
    name: string;
    vessel_type: string;
    size_band_id: string;
    loa_meters: number;
    nda_flag: boolean;
  };
  'VESSEL.UPDATED': {
    name?: string;
    vessel_type?: string;
    size_band_id?: string;
    loa_meters?: number;
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
    working_day_dates?: string[];
    required_certification_ids: string[];
    experience_bracket_id: string | null;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    positions_available?: number;
    permanent_opportunity?: boolean;
    required_languages?: string[];
  };
  'DAYWORK.CANCELLED_BY_EMPLOYER': Record<string, never>;
  'DAYWORK.COMPLETED': { daywork_id: string };
  'DAYWORK.RELISTED': {
    daywork_id: string;
    start_date?: string;
    end_date?: string;
    working_days?: number;
  };
  'DAYWORK.POSITIONS_UPDATED': {
    daywork_id: string;
    positions_available: number;
  };
  'DAYWORK.EXTENDED': {
    daywork_id: string;
    end_date: string;
    working_days?: number;
    working_day_dates?: string[];
  };
  'DAYWORK.INVITED': {
    daywork_id: string;
    crew_person_id: string;
  };
  'DAYWORK.INVITATION_ACCEPTED': {
    daywork_id: string;
    invitation_id: string;
    crew_person_id: string;
    employer_person_id: string;
    start_date: string;
    end_date: string;
  };
  'DAYWORK.INVITATION_DECLINED': {
    daywork_id: string;
    invitation_id: string;
  };
  'DAYWORK.APPLIED': {
    id: string;
    daywork_id: string;
    crew_person_id?: string;
    message?: string | null;
    source?: 'direct' | 'invitation';
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
    reason_category: 'personal_reasons' | 'found_other_work' | 'unsafe_conditions' | 'other';
    reason_text?: string;
  };
  'ENGAGEMENT.CANCELLED_BY_EMPLOYER': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
    reason_category: 'vessel_leaving' | 'crew_requirements_changed' | 'vessel_operational' | 'other';
    reason_text?: string;
    relist_requested: boolean;
    relist_reason_category?: 'wrong_crew' | 'requirements_changed' | 'different_skills' | 'relist_other';
    relist_reason_text?: string;
  };
  'ENGAGEMENT.POSTPONEMENT_PROPOSED': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
    proposed_start_date: string;
    proposed_end_date: string;
    proposed_working_days: number;
  };
  'ENGAGEMENT.POSTPONEMENT_ACCEPTED': {
    engagement_id: string;
    daywork_id: string;
    new_start_date: string;
    new_end_date: string;
    new_working_days: number;
  };
  'ENGAGEMENT.POSTPONEMENT_REJECTED': {
    engagement_id: string;
    daywork_id: string;
    crew_person_id: string;
  };
  'ENGAGEMENT.WORK_STARTED': {
    engagement_id: string;
    initiated_by: 'crew' | 'employer';
  };
  'ENGAGEMENT.WORK_STARTED_CONFIRMED': {
    engagement_id: string;
    confirmed_by: 'crew' | 'employer';
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
    permanent_opportunity_accuracy?: string;
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
  'ENGAGEMENT.CANCELLATION_RATED_BY_CREW': {
    engagement_id: string;
    notice_given: 'yes' | 'no' | 'partial';
    communication_accuracy: boolean;
    overall_match: number;
  };
  'ENGAGEMENT.CANCELLATION_RATED_BY_EMPLOYER': {
    engagement_id: string;
    communication_accuracy: boolean;
    overall_match: number;
  };
  'EXPERIENCE.ADDED': {
    id: string;
    vessel_id: string;
    role_id: string;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    vessel_operation: 'charter' | 'private';
    flag_state: string | null;
    salary_amount: number | null;
    salary_currency: 'EUR' | 'USD' | 'GBP' | 'AED' | null;
    salary_period: 'daily' | 'monthly' | 'annually' | null;
    sea_time_days: number | null;
    sea_time_nautical_miles: number | null;
    contract_type: 'permanent' | 'rotational' | 'seasonal' | 'crossing' | 'delivery' | 'temporary' | null;
    contract_details: string | null;
    description: string | null;
  };
  'EXPERIENCE.UPDATED': {
    role_id?: string;
    start_date?: string;
    end_date?: string | null;
    is_current?: boolean;
    vessel_operation?: 'charter' | 'private';
    flag_state?: string | null;
    salary_amount?: number | null;
    salary_currency?: 'EUR' | 'USD' | 'GBP' | 'AED' | null;
    salary_period?: 'daily' | 'monthly' | 'annually' | null;
    sea_time_days?: number | null;
    sea_time_nautical_miles?: number | null;
    contract_type?: 'permanent' | 'rotational' | 'seasonal' | 'crossing' | 'delivery' | 'temporary' | null;
    contract_details?: string | null;
    description?: string | null;
  };
  'EXPERIENCE.REMOVED': Record<string, never>;
  'CHECKLIST.SET': {
    engagement_id: string;
    items: Array<{ id: string; label: string; value: string }>;
  };
  'CHECKLIST.ITEM_TOGGLED': {
    engagement_id: string;
    item_id: string;
    checked: boolean;
  };
  'AVAILABILITY.SET': {
    start_date: string;
    end_date: string;
    expires_at?: string;
    city_id: string | null;
    port_id?: string | null;
    not_available?: boolean;
  };
  'MESSAGE.SENT': {
    id: string;
    engagement_id?: string;
    sender_person_id?: string;
    content: string;
    is_system?: boolean;
    message_type?: 'text' | 'documents';
    document_count?: number;
  };
  'ADMIN.ENGAGEMENT_COMPLETED': {
    engagement_id: string;
    daywork_id: string;
    reason: string;
    admin_person_id: string;
  };
  'ADMIN.CANONICAL_ADDED': {
    table: string;
    record_id: string;
    admin_person_id: string;
  };
  'ADMIN.CANONICAL_UPDATED': {
    table: string;
    record_id: string;
    fields: Record<string, unknown>;
    admin_person_id: string;
  };
  'ADMIN.USER_BLOCKED': {
    person_id: string;
    reason_category: string;
    reason_text: string;
    admin_person_id: string;
  };
  'ADMIN.USER_UNBLOCKED': {
    person_id: string;
    reason_text: string;
    admin_person_id: string;
  };
  'ADMIN.ENGAGEMENT_CANCELLED': {
    engagement_id: string;
    posting_type: 'daywork' | 'permanent';
    daywork_id?: string;
    permanent_posting_id?: string;
    reason_category: string;
    reason_text: string;
    admin_person_id: string;
  };
  'ADMIN.POSTING_HIDDEN': {
    posting_id: string;
    posting_type: 'daywork' | 'permanent';
    reason: string;
    admin_person_id: string;
  };
  'SUPPORT.THREAD_OPENED': {
    thread_id: string;
    person_id: string;
    subject?: string;
    is_admin_initiated: boolean;
  };
  'SUPPORT.MESSAGE_SENT': {
    message_id: string;
    thread_id: string;
    sender_person_id: string;
    is_platform: boolean;
  };
  'PERMANENT.POSTED': {
    id: string;
    vessel_id: string;
    role_id: string;
    port_id: string;
    start_date: string;
    salary_min: number;
    salary_max: number;
    salary_currency: string;
    salary_period: string;
    live_aboard: boolean;
    required_certification_ids: string[];
    experience_bracket_id: string | null;
    shortlist_cap: number;
    notes: string | null;
    required_languages?: string[];
    contract_type?: string | null;
    contract_details?: string | null;
    description?: string | null;
    meals?: string[];
    positions_available?: number;
  };
  'PERMANENT.APPLIED': {
    id: string;
    permanent_posting_id: string;
    crew_person_id: string;
    message?: string;
  };
  'PERMANENT.APPLICATION_BLOCKED': {
    crew_person_id: string;
    permanent_posting_id: string;
    missing_certification_ids: string[];
  };
  'PERMANENT.SHORTLISTED': {
    crew_person_id: string;
    permanent_posting_id: string;
  };
  'PERMANENT.REJECTED': {
    crew_person_id: string;
    permanent_posting_id: string;
  };
  'PERMANENT.SELECTED': {
    crew_person_id: string;
    permanent_posting_id: string;
    engagement_id: string;
  };
  'PERMANENT.PLACEMENT_CONFIRMED': {
    permanent_posting_id: string;
  };
  'PERMANENT.SELECTION_REVERTED': {
    permanent_posting_id: string;
    engagement_id: string;
  };
  'PERMANENT.WITHDRAWN': {
    crew_person_id: string;
    permanent_posting_id: string;
  };
  'PERMANENT.CANCELLED_BY_EMPLOYER': {
    permanent_posting_id: string;
    reason?: string;
  };
  'PERMANENT.ENGAGEMENT_CLOSED': {
    engagement_id: string;
    outcome: 'successful_placement' | 'not_successful' | 'withdrew';
    closed_by: 'crew' | 'employer';
  };
  'SHORE_EXPERIENCE.ADDED': {
    id: string;
    category_id: string;
    employer_name: string;
    job_title: string;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  };
  'SHORE_EXPERIENCE.UPDATED': {
    category_id?: string;
    employer_name?: string;
    job_title?: string;
    start_date?: string;
    end_date?: string | null;
    is_current?: boolean;
    description?: string | null;
  };
  'SHORE_EXPERIENCE.REMOVED': Record<string, never>;
}

/** Materialised daywork invitation row */
export interface DayworkInvitation {
  id: string;
  daywork_id: string;
  crew_person_id: string;
  employer_person_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
}
