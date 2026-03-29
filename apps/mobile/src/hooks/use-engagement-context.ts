import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface EngagementContext {
  engagement_id: string;
  status: string;
  type: 'daywork' | 'permanent';
  crew_person_id: string;
  employer_person_id: string;
  start_date: string;
  end_date: string | null;
  work_started_status: string | null;
  postponement_status: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  crew_completion_status: string | null;
  has_rated: boolean;
  my_rating: Record<string, unknown> | null;
  other_party: {
    display_name: string;
    avatar_url: string | null;
  };
  daywork: {
    id: string;
    job_number: number;
    day_rate: number;
    currency: string;
    working_days: number;
    meals: string[];
    notes: string | null;
    yacht_roles: { name: string; department: string } | null;
    ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
    vessels: { name: string; nda_flag: boolean; vessel_type: string; loa_meters: number | null } | null;
  } | null;
  permanent_posting: {
    id: string;
    job_number: number;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string;
    salary_period: string;
    contract_type: string | null;
    yacht_roles: { name: string; department: string } | null;
    ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
    vessels: { name: string; nda_flag: boolean; vessel_type: string; loa_meters: number | null } | null;
  } | null;
  checklist: {
    items: { id: string; label: string }[];
    acknowledged_item_ids: string[];
  } | null;
}

export function useEngagementContext(engagementId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<EngagementContext>({
    queryKey: ['engagement-context', engagementId],
    queryFn: async () => {
      const result = await apiGet<EngagementContext>(`/api/messages/${engagementId}/context`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!engagementId,
    refetchInterval: 30000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['engagement-context', engagementId] });
  }

  return { ...query, invalidate };
}
