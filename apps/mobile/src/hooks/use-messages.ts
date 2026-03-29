import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface Message {
  id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
  is_system: boolean;
}

interface MessagesResponse {
  messages: Message[];
}

export function useMessages(engagementId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<MessagesResponse>({
    queryKey: ['messages', engagementId],
    queryFn: async () => {
      const result = await apiGet<MessagesResponse>(`/api/messages/${engagementId}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!engagementId,
  });

  function appendMessage(msg: Message) {
    queryClient.setQueryData<MessagesResponse>(
      ['messages', engagementId],
      (old) => old ? { messages: [...old.messages, msg] } : { messages: [msg] },
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['messages', engagementId] });
  }

  return { ...query, appendMessage, invalidate };
}
