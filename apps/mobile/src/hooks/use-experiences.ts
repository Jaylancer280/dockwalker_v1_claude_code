import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface Experience {
  id: string;
  vessel_id: string;
  role_id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: 'charter' | 'private';
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  vessels: {
    id: string;
    imo_number: string;
    name: string;
    vessel_type: string;
    size_band_id: string | null;
    loa_meters: number | null;
    vessel_size_bands: { label: string } | null;
  };
  yacht_roles: {
    id: string;
    name: string;
    department: string;
  };
}

interface ExperiencesResponse {
  experiences: Experience[];
}

export function useExperiences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ExperiencesResponse>({
    queryKey: ['experiences', user?.id],
    queryFn: async () => {
      const result = await apiGet<ExperiencesResponse>('/api/experiences');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['experiences', user?.id] }),
  };
}
