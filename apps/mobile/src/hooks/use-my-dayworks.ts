import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface MyDaywork {
  id: string;
  job_number: number;
  status: string;
  start_date: string;
  end_date: string;
  day_rate: number;
  currency: string;
  positions_available: number;
  positions_filled: number;
  yacht_roles: { name: string } | null;
  vessels: { name: string; nda_flag: boolean; vessel_type: string } | null;
  ports: { name: string } | null;
}

export function useMyDayworks() {
  const { user } = useAuth();
  return useQuery<{ dayworks: MyDaywork[] }>({
    queryKey: ['my-dayworks', user?.id],
    queryFn: async () => {
      const result = await apiGet<{ dayworks: MyDaywork[] }>('/api/daywork/mine');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });
}
