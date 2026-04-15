export interface ApplicantProfile {
  display_name: string;
  deck_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  yacht_roles: { name: string; department: string } | null;
  experience_brackets: { label: string } | null;
  ports: {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  certification_ids: string[];
  languages: string[];
  vessel_size_exposure_ids: string[];
  nationalities: { name: string; flag_emoji: string } | null;
  smoker: boolean | null;
  visible_tattoos: boolean | null;
}

export interface Applicant {
  id: string;
  crew_person_id: string;
  status: string;
  message: string | null;
  created_at: string;
  profiles: ApplicantProfile | null;
  available_days: number;
  availability_city: string | null;
  availability_not_available: boolean;
  past_daywork_count: number;
  source: string | null;
  shore_experience_categories: string[];
}

export interface AvailableCrew {
  person_id: string;
  display_name: string;
  avatar_url: string | null;
  primary_role_id: string;
  certification_ids: string[];
  languages: string[];
  experience_bracket_id: string;
  vessel_size_exposure_ids: string[];
  bio: string | null;
  location_port_id: string;
  yacht_roles: { name: string; department: string } | null;
  experience_brackets: { label: string } | null;
  ports: {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  available_days: number;
  nationalities: { name: string; flag_emoji: string } | null;
}

export type TabView = 'applicants' | 'shortlist' | 'available';
