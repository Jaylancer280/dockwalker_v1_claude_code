import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface MyPermanent {
  id: string;
  job_number: number;
  status: string;
  start_date: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  applicant_count: number;
  shortlist_count: number;
  selected_crew_name: string | null;
  yacht_roles: { name: string } | null;
  vessels: { name: string; nda_flag: boolean; vessel_type: string } | null;
  ports: { name: string } | null;
}

export function useMyPermanent() {
  const { user } = useAuth();
  return useQuery<{ postings: MyPermanent[] }>({
    queryKey: ['my-permanent', user?.id],
    queryFn: async () => {
      const result = await apiGet<{ postings: MyPermanent[] }>('/api/permanent/mine');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });
}
