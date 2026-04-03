import type {
  ApplicationStatus,
  ContractType,
  IdentityType,
  MealOption,
  PermanentAvailability,
  PermanentPostingStatus,
  RoleContext,
  SalaryPeriod,
  SubscriptionPlan,
  SubscriptionStatus,
  VesselOperation,
  VesselType,
} from './enums';

/** Person — auth-linked identity */
export interface Person {
  id: string;
  identity_type: IdentityType;
  current_hat: RoleContext;
  created_at: string;
  deactivated_at: string | null;
}

/** Crew profile data */
export interface CrewProfile {
  person_id: string;
  display_name: string;
  primary_role_id: string;
  certification_ids: string[];
  experience_bracket_id: string;
  vessel_size_exposure_ids: string[];
  location_port_id: string | null;
  bio: string | null;
  shore_experience: string | null;
  motivation: string | null;
  languages: string[];
  available_to_start: 'immediate' | 'within_1_week' | 'within_2_weeks' | 'within_1_month' | null;
  onboarding_version: number;
  avatar_url: string | null;
  permanent_availability: PermanentAvailability | null;
  notice_period_days: number | null;
  currently_employed: boolean;
  smoker: boolean | null;
  visible_tattoos: boolean | null;
  created_at: string;
  updated_at: string;
}

/** Agent profile data */
export interface AgentProfile {
  person_id: string;
  display_name: string;
  agency_name: string;
  location_port_id: string | null;
  role_specialization_ids: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Vessel entity — IMO is the immutable identity anchor */
export interface Vessel {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: VesselType;
  vessel_operation: VesselOperation;
  size_band_id: string;
  nda_flag: boolean;
  owner_person_id: string;
  created_at: string;
  updated_at: string;
}

/** Daywork posting */
export interface Daywork {
  id: string;
  poster_person_id: string;
  role_context: RoleContext;
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
  meals: MealOption[];
  notes: string | null;
  positions_available: number;
  positions_filled: number;
  permanent_opportunity: boolean;
  status: 'active' | 'in_progress' | 'cancelled' | 'completed';
  created_at: string;
}

/** Application — crew+posting pair (daywork or permanent, XOR) */
export interface Application {
  id: string;
  crew_person_id: string;
  daywork_id: string | null;
  permanent_posting_id: string | null;
  status: ApplicationStatus;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Availability window for a crew member */
export interface AvailabilityWindow {
  id: string;
  person_id: string;
  date: string;
  expires_at: string;
  created_at: string;
}

/** Active engagement between crew and employer */
export interface Engagement {
  id: string;
  application_id: string;
  crew_person_id: string;
  employer_person_id: string;
  daywork_id: string | null;
  permanent_posting_id: string | null;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'cancelled' | 'closed';
  outcome: 'successful_placement' | 'not_successful' | 'withdrew' | null;
  crew_completion_status: 'confirmed' | 'disputed' | null;
  created_at: string;
}

/** Message in an engagement conversation */
export interface Message {
  id: string;
  engagement_id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
}

/** Crew experience entry — vessel work history */
export interface CrewExperience {
  id: string;
  person_id: string;
  vessel_id: string;
  role_id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: VesselOperation;
  flag_state: string | null;
  contract_type: ContractType | null;
  contract_details: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Subscription — Stripe-owned state */
export interface Subscription {
  id: string;
  person_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/** Permanent posting */
export interface PermanentPosting {
  id: string;
  employer_person_id: string;
  vessel_id: string;
  role_id: string;
  port_id: string;
  start_date: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  salary_period: SalaryPeriod;
  live_aboard: boolean;
  required_certification_ids: string[];
  experience_bracket_id: string | null;
  shortlist_cap: number;
  notes: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  meals: string[];
  positions_available: number;
  positions_filled: number;
  status: PermanentPostingStatus;
  job_number: number;
  created_at: string;
  updated_at: string;
}

/** Permanent template for repeat posting */
export interface PermanentTemplate {
  id: string;
  employer_person_id: string;
  template_name: string;
  vessel_id: string;
  role_id: string;
  port_id: string;
  start_date: string;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  salary_period: SalaryPeriod;
  live_aboard: boolean;
  required_certification_ids: string[];
  experience_bracket_id: string | null;
  shortlist_cap: number;
  notes: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  meals: string[];
  positions_available: number;
  created_at: string;
  updated_at: string;
}

/** Engagement rating (one per person per engagement) */
export interface EngagementRating {
  id: string;
  engagement_id: string;
  rater_person_id: string;
  rater_role: 'crew' | 'employer';
  // Crew-specific
  pay_accuracy: string | null;
  meals_accuracy: string | null;
  role_accuracy: string | null;
  working_days_accuracy: string | null;
  vessel_condition: number | null;
  would_work_on_vessel_again: boolean | null;
  permanent_opportunity_accuracy: string | null;
  // Employer-specific
  skills_as_advertised: string | null;
  certifications_verified: string | null;
  punctuality: string | null;
  would_rehire: boolean | null;
  // Symmetric
  communication_accuracy: boolean | null;
  overall_match: number | null;
  created_at: string;
}
