import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface Preferences {
  email_enabled: boolean;
  push_jobs: boolean;
  push_applications: boolean;
  push_messages: boolean;
  push_reminders: boolean;
}

interface PreferencesResponse {
  preferences: Preferences;
}

export function usePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<PreferencesResponse>({
    queryKey: ['preferences', user?.id],
    queryFn: async () => {
      const result = await apiGet<PreferencesResponse>('/api/preferences');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['preferences', user?.id] }),
  };
}
