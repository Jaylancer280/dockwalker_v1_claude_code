import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface Applicant {
  id: string;
  crew_person_id: string;
  status: string;
  message: string | null;
  created_at: string;
  source: string | null;
  available_days: number;
  availability_city: string | null;
  not_available: boolean;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    deck_name: string | null;
    certification_ids: string[] | null;
    languages: string[] | null;
    bio: string | null;
    yacht_roles: { name: string; department: string } | null;
    experience_brackets: { label: string } | null;
    ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
    nationalities: { name: string; flag_emoji: string } | null;
  } | null;
}

interface ApplicantsResponse {
  applicants: Applicant[];
  positions_available: number;
  positions_filled: number;
  positions_remaining: number;
}

export function useDayworkApplicants(dayworkId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ApplicantsResponse>({
    queryKey: ['daywork-applicants', dayworkId],
    queryFn: async () => {
      const result = await apiGet<ApplicantsResponse>(`/api/daywork/${dayworkId}/applicants`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!dayworkId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['daywork-applicants', dayworkId] });
  }

  return { ...query, invalidate };
}
