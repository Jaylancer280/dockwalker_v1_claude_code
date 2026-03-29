import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface DockyConversation {
  id: string;
  title: string;
  updated_at: string;
  preview: string | null;
}

interface DockyConversationsResponse {
  conversations: DockyConversation[];
}

export function useDockyConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<DockyConversationsResponse>({
    queryKey: ['docky-conversations', user?.id],
    queryFn: async () => {
      const result = await apiGet<DockyConversationsResponse>('/api/advisor/conversations');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['docky-conversations', user?.id] }),
  };
}
