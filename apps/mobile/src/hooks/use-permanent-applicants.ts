import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface PermanentApplicant {
  id: string;
  crew_person_id: string;
  status: string;
  message: string | null;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
  role_name: string | null;
  role_department: string | null;
  experience_label: string | null;
  certification_ids: string[] | null;
  languages: string[] | null;
  permanent_availability: string | null;
  notice_period_days: number | null;
  nationality_name: string | null;
  nationality_flag: string | null;
}

interface PermanentReviewResponse {
  applicants: PermanentApplicant[];
  shortlist_cap: number;
  shortlist_count: number;
  posting_status: string;
  selected_crew_id: string | null;
  selected_crew_name: string | null;
}

export function usePermanentApplicants(postingId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<PermanentReviewResponse>({
    queryKey: ['permanent-applicants', postingId],
    queryFn: async () => {
      const result = await apiGet<PermanentReviewResponse>(`/api/permanent/${postingId}/review`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!postingId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['permanent-applicants', postingId] });
  }

  return { ...query, invalidate };
}
