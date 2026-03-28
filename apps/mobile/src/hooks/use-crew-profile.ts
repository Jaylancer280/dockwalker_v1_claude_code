import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface CrewProfile {
  certification_ids: string[];
  languages: string[];
}

export function useCrewProfile() {
  const { user } = useAuth();

  return useQuery<CrewProfile>({
    queryKey: ['crew-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('certification_ids, languages')
        .eq('person_id', user!.id)
        .single();

      if (error) throw error;
      return {
        certification_ids: (data?.certification_ids as string[]) ?? [],
        languages: (data?.languages as string[]) ?? [],
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
