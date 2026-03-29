import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface DockyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown;
  created_at: string;
}

interface DockyMessagesResponse {
  messages: DockyMessage[];
}

export function useDockyMessages(conversationId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['docky-messages', conversationId];

  const query = useQuery<DockyMessagesResponse>({
    queryKey,
    queryFn: async () => {
      const result = await apiGet<DockyMessagesResponse>(`/api/advisor/conversations/${conversationId}/messages`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user && !!conversationId,
  });

  const appendMessage = useCallback(
    (msg: DockyMessage) => {
      queryClient.setQueryData<DockyMessagesResponse>(queryKey, (old) => {
        if (!old) return { messages: [msg] };
        if (old.messages.some((m) => m.id === msg.id)) return old;
        return { messages: [...old.messages, msg] };
      });
    },
    [queryClient, queryKey],
  );

  return { ...query, appendMessage };
}
