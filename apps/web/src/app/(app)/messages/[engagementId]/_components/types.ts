export interface Message {
  id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
  is_system?: boolean;
}

export interface RatingData {
  id: string;
  rater_role: string;
  rating_context?: string;
  pay_accuracy: string | null;
  meals_accuracy: string | null;
  role_accuracy: string | null;
  working_days_accuracy: string | null;
  vessel_condition: number | null;
  would_work_on_vessel_again: boolean | null;
  skills_as_advertised: string | null;
  certifications_verified: string | null;
  punctuality: string | null;
  would_rehire: boolean | null;
  communication_accuracy: boolean | null;
  overall_match: number | null;
  notice_given: string | null;
}

export interface EngagementContext {
  id: string;
  daywork_id: string;
  crew_person_id: string;
  employer_person_id: string;
  start_date: string;
  end_date: string;
  status: string;
  crew_completion_status: string | null;
  cancelled_by: string | null;
  cancellation_reason_category: string | null;
  cancellation_reason_text: string | null;
  postponement_status: string | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  proposed_working_days: number | null;
  work_started_status: string | null;
  work_started_at: string | null;
  crew_cancel_responded: boolean;
  dayworks: {
    job_number: number;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    yacht_roles: { name: string } | null;
    ports: { name: string; cities: { name: string } | null } | null;
    vessels: { name: string } | null;
  } | null;
  other_name: string;
  has_rated: boolean;
  my_rating: RatingData | null;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '\u20AC',
  USD: '$',
  GBP: '\u00A3',
  AED: '\u062F.\u0625',
};

export const POLL_INTERVAL = 5000;
