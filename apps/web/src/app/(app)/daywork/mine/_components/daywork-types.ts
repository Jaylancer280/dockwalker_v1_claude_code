export interface DayworkPosting {
  id: string;
  job_number: number;
  role_context: string;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  positions_available: number;
  positions_filled: number;
  permanent_opportunity: boolean;
  status: string;
  created_at: string;
  yacht_roles: { name: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string; nda_flag: boolean; vessel_size_bands: { label: string } | null } | null;
  experience_brackets: { label: string } | null;
}

export interface Template {
  id: string;
  name: string;
  yacht_roles: { name: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string } | null;
  day_rate: number | null;
  currency: string | null;
  working_days: number | null;
  created_at: string;
}
