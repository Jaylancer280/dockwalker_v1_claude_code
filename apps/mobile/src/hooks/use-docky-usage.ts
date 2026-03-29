import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface DockyUsageResponse {
  used: number | null;
  limit: number | null;
  plan?: string;
}

export function useDockyUsage() {
  const { user } = useAuth();

  return useQuery<DockyUsageResponse>({
    queryKey: ['docky-usage', user?.id],
    queryFn: async () => {
      const result = await apiGet<DockyUsageResponse>('/api/advisor/usage');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}
