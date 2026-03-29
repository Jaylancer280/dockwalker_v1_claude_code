import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  deep_link: string;
  read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<NotificationsResponse>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const result = await apiGet<NotificationsResponse>('/api/notifications');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  };
}
