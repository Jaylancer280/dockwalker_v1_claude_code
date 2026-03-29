import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface Conversation {
  id: string;
  status: string;
  type: 'daywork' | 'permanent';
  start_date: string;
  end_date: string | null;
  has_rated: boolean;
  unread_count: number;
  is_overdue: boolean;
  rating_expired: boolean;
  last_message: { content: string; created_at: string; is_system: boolean } | null;
  dayworks: {
    job_number: number;
    day_rate: number;
    currency: string;
    yacht_roles: { name: string } | null;
    vessels: { name: string; nda_flag: boolean; vessel_type: string } | null;
  } | null;
  permanent_postings: {
    job_number: number;
    salary_max: number | null;
    salary_currency: string;
    yacht_roles: { name: string } | null;
    vessels: { name: string; nda_flag: boolean; vessel_type: string } | null;
  } | null;
  other_party_profile: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

interface ConversationsResponse {
  conversations: Conversation[];
  unread_total: number;
}

export function useConversations() {
  const { user } = useAuth();

  return useQuery<ConversationsResponse>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      const result = await apiGet<ConversationsResponse>('/api/messages');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });
}
