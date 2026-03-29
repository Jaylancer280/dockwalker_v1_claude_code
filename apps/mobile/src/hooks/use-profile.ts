import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface ProfilePerson {
  id: string;
  current_hat: string;
  identity_type: string;
}

export interface Profile {
  person_id: string;
  display_name: string;
  identity_type: string;
  bio: string | null;
  avatar_url: string | null;
  deck_name: string | null;
  primary_role_id: string | null;
  desired_role_id: string | null;
  certification_ids: string[];
  experience_bracket_id: string | null;
  vessel_size_exposure_ids: string[];
  location_port_id: string | null;
  location_city_id: string | null;
  nationality_id: string | null;
  visa_ids: string[];
  languages: string[];
  permanent_availability: 'immediate' | 'after_notice' | 'not_looking' | null;
  notice_period_days: number | null;
  currently_employed: boolean;
  agency_name: string | null;
  role_specialization_ids: string[];
  yacht_roles: { id: string; name: string; department: string } | null;
  desired_roles: { id: string; name: string } | null;
  experience_brackets: { id: string; label: string } | null;
  ports: { id: string; name: string; cities: { name: string; regions: { name: string } } } | null;
  location_cities: { id: string; name: string; regions: { name: string } } | null;
  nationalities: { id: string; name: string; country_code: string; flag_emoji: string } | null;
  vessel_size_bands: { id: string; label: string }[];
  certifications: { id: string; name: string }[];
  profile_languages: { code: string; name: string }[];
  visa_types: { id: string; name: string }[];
  role_specializations: { id: string; name: string }[];
}

interface ProfileResponse {
  person: ProfilePerson;
  profile: Profile;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ProfileResponse>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const result = await apiGet<ProfileResponse>('/api/profile');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['profile', user?.id] }),
  };
}
