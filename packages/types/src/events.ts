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
  | 'VESSEL.RENAMED'
  | 'VESSEL.REFLAGGED'
  | 'VESSEL.METADATA_UPDATED'
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
  | 'PERMANENT.ENGAGEMENT_CLOSED'
  // Reference aggregate (consent-based references)
  | 'REFERENCE.REQUESTED'
  | 'REFERENCE.ACCEPTED'
  | 'REFERENCE.COMMENT_UPDATED'
  | 'REFERENCE.DECLINED'
  | 'REFERENCE.REVOKED_BY_REQUESTER'
  | 'REFERENCE.REVOKED_BY_REFEREE'
  | 'REFERENCE.EXPIRED'
  // Reference contact (employer asks referee for chat)
  | 'REFERENCE.CONTACT_REQUESTED'
  | 'REFERENCE.CONTACT_ACCEPTED'
  | 'REFERENCE.CONTACT_DECLINED'
  | 'REFERENCE.CONTACT_THREAD_CLOSED'
  // Permanent invitation (captain invites a specific crew to apply)
  | 'PERMANENT.INVITED'
  // CV Builder (person aggregate)
  | 'CV.GENERATED'
  | 'CV.HANDLE_REGENERATED';

/** Aggregate types that events reference */
export type AggregateType =
  | 'person'
  | 'vessel'
  | 'daywork'
  | 'application'
  | 'message'
  | 'engagement'
  | 'checklist'
  | 'experience'
  | 'invitation'
  | 'admin'
  | 'permanent'
  | 'support'
  | 'shore_experience'
  | 'reference'
  | 'reference_contact'
  | 'permanent_invitation';

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
    /** @deprecated use `nationality_ids` (array). Single field kept for
     * backward compat — projection writes both during the transition. */
    nationality_id?: string | null;
    nationality_ids?: string[];
    entry_right_ids?: string[];
    desired_role_id?: string | null;
    deck_name?: string | null;
    location_city_id?: string | null;
    smoker?: boolean | null;
    visible_tattoos?: boolean | null;
    /** Set true by the lightweight referee signup flow (P1-C). Profile is
     * gated to consent + settings paths until the user completes full
     * onboarding (which flips this back to false via PROFILE.UPDATED). */
    referee_only?: boolean;
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
    /** @deprecated use `nationality_ids` (array). */
    nationality_id?: string | null;
    nationality_ids?: string[];
    entry_right_ids?: string[];
    permanent_availability?: string | null;
    notice_period_days?: number | null;
    currently_employed?: boolean;
    desired_role_id?: string | null;
    deck_name?: string | null;
    location_city_id?: string | null;
    smoker?: boolean | null;
    visible_tattoos?: boolean | null;
    /** Flips false when a referee_only user completes full onboarding. */
    referee_only?: boolean;
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
    /** Provenance — defaults to 'curated' on legacy callsites; the
     *  Wave C `/api/vessels/request` route sets `'pending'`. */
    source?: 'curated' | 'user_submitted' | 'pending';
  };
  'VESSEL.UPDATED': {
    name?: string;
    vessel_type?: string;
    size_band_id?: string;
    loa_meters?: number;
    nda_flag?: boolean;
  };
  'VESSEL.RENAMED': {
    name: string;
    /** ISO date the new name takes effect. Defaults to today server-side. */
    effective_from?: string;
    /** ISO date the new name stops being current. Omit (or null) for an
     *  open-ended "this is the current name" record. Set when an admin
     *  is back-filling a historical alias. */
    effective_to?: string | null;
    source?: 'curated' | 'user_submitted' | 'pending';
  };
  'VESSEL.REFLAGGED': {
    flag_state_id: string;
    effective_from?: string;
    effective_to?: string | null;
    source?: 'curated' | 'user_submitted' | 'pending';
  };
  'VESSEL.METADATA_UPDATED': {
    gross_tonnage?: number | null;
    beam_meters?: number | null;
    year_built?: number | null;
    builder?: string | null;
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
    content_preview?: string;
    is_admin_initiated: boolean;
  };
  'SUPPORT.MESSAGE_SENT': {
    message_id: string;
    thread_id: string;
    sender_person_id: string;
    content_preview?: string;
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
    /** When the application was created in response to a PERMANENT.INVITED
     * deep-link, this carries the invitation row id. The projection sets
     * `applications.invited_from_id` and flips the linked invitation row
     * to `applied` (race-guarded `AND status='pending'`). Omit for
     * organic /discover applications. */
    invited_from_id?: string;
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
  // ── REFERENCES (consent-based references — see tasks/todo.md) ───────
  'REFERENCE.REQUESTED': {
    id: string;
    experience_id: string;
    vessel_id: string;
    requester_role_at_time: string;
    claimed_referee_role: string;
    claimed_referee_name: string;
    claimed_referee_email?: string | null;
    token: string;
    snapshot_vessel_imo: string;
    snapshot_vessel_name: string;
    snapshot_start_date: string;
    snapshot_end_date?: string | null;
    /** Optional override of the default `now() + 24 months`. */
    expires_at?: string;
    /** Optional override of the default `now() + 30 days`. */
    pending_expires_at?: string;
  };
  'REFERENCE.ACCEPTED': Record<string, never>;
  'REFERENCE.COMMENT_UPDATED': {
    /** The reference being commented on (carried in payload because the
     * event aggregate_id is set when fired alongside REFERENCE.ACCEPTED). */
    reference_id: string;
    /** Empty/null clears the comment. */
    comment: string | null;
  };
  'REFERENCE.DECLINED': Record<string, never>;
  'REFERENCE.REVOKED_BY_REQUESTER': Record<string, never>;
  'REFERENCE.REVOKED_BY_REFEREE': Record<string, never>;
  'REFERENCE.EXPIRED': Record<string, never>;
  'REFERENCE.CONTACT_REQUESTED': {
    id: string;
    reference_id: string;
    /** Optional employer question shown on the consent prompt and pre-populated
     * as the chat's first message on accept (P1-D). Max 200 chars. */
    question?: string | null;
  };
  'REFERENCE.CONTACT_ACCEPTED': {
    /** New active_engagements row id created for the chat thread. */
    engagement_id: string;
  };
  'REFERENCE.CONTACT_DECLINED': Record<string, never>;
  'REFERENCE.CONTACT_THREAD_CLOSED': {
    engagement_id: string;
  };
  // ── PERMANENT INVITATION (captain invites a specific crew to apply) ──
  'PERMANENT.INVITED': {
    id: string;
    permanent_posting_id: string;
    crew_person_id: string;
    /** Optional captain-authored note shown alongside the invitation
     * notification + apply-page banner. Max 500 chars. */
    message?: string | null;
  };
  // ── CV BUILDER (person aggregate) ────────────────────────────────────
  'CV.GENERATED': {
    /** The cv_handle minted/used for this generation. Projection lazily
     * back-fills `profiles.cv_handle` if currently null (coalesce on OLD).
     * For Stage-1 admin mint, the route also fires CV.HANDLE_REGENERATED
     * separately so this event isn't required for first-mint. */
    handle: string;
    format: 'pdf';
  };
  'CV.HANDLE_REGENERATED': {
    /** Null on first mint (admin route or Stage-2 first generation),
     * non-null on Crew-Pro regenerate. */
    old_handle: string | null;
    new_handle: string;
  };
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
