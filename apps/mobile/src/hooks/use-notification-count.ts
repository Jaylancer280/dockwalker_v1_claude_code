import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface NotificationCountResponse {
  notification_count: number;
  message_count: number;
  alt_notification_count: number;
  alt_message_count: number;
}

export function useNotificationCount() {
  const { user } = useAuth();

  return useQuery<NotificationCountResponse>({
    queryKey: ['notification-count', user?.id],
    queryFn: async () => {
      const result = await apiGet<NotificationCountResponse>('/api/notifications/count');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
