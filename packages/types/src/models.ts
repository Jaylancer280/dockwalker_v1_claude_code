import type {
  ApplicationStatus,
  IdentityType,
  MealOption,
  RoleContext,
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
  created_at: string;
  updated_at: string;
}

/** Vessel entity — IMO is the immutable identity anchor */
export interface Vessel {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: VesselType;
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
  day_rate: number | null;
  meals: MealOption[];
  notes: string | null;
  status: 'active' | 'cancelled' | 'completed';
  created_at: string;
}

/** Application — crew+daywork pair */
export interface Application {
  id: string;
  crew_person_id: string;
  daywork_id: string;
  status: ApplicationStatus;
  message: string | null;
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

/** Message in an engagement conversation */
export interface Message {
  id: string;
  engagement_id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
  hidden_by: string[];
}
