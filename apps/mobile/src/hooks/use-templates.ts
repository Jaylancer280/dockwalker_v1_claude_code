import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface DayworkTemplate {
  id: string;
  name: string;
  role_id: string | null;
  location_port_id: string | null;
  day_rate: number | null;
  currency: string | null;
  working_days: number | null;
  meals: string[] | null;
  notes: string | null;
  required_certification_ids: string[] | null;
  required_languages: string[] | null;
  experience_bracket_id: string | null;
  positions_available: number | null;
  permanent_opportunity: boolean | null;
  yacht_roles: { name: string } | null;
  ports: { name: string } | null;
}

export interface PermanentTemplate {
  id: string;
  name: string;
  vessel_id: string | null;
  role_id: string | null;
  port_id: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  live_aboard: boolean | null;
  shortlist_cap: number | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  meals: string[] | null;
  notes: string | null;
  required_certification_ids: string[] | null;
  required_languages: string[] | null;
  experience_bracket_id: string | null;
  positions_available: number | null;
  yacht_roles: { name: string } | null;
  ports: { name: string } | null;
}

export function useDayworkTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<{ templates: DayworkTemplate[] }>({
    queryKey: ['daywork-templates', user?.id],
    queryFn: async () => {
      const result = await apiGet<{ templates: DayworkTemplate[] }>('/api/daywork/templates');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['daywork-templates', user?.id] });
  }

  return { ...query, invalidate };
}

export function usePermanentTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<{ templates: PermanentTemplate[] }>({
    queryKey: ['permanent-templates', user?.id],
    queryFn: async () => {
      const result = await apiGet<{ templates: PermanentTemplate[] }>('/api/permanent/templates');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['permanent-templates', user?.id] });
  }

  return { ...query, invalidate };
}
