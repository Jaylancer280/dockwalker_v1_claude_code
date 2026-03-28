import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export interface Vessel {
  id: string;
  name: string;
  vessel_type: string;
  loa_meters: number | null;
  nda_flag: boolean;
  vessel_size_bands: { label: string } | null;
}

export function useVessels() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Vessel[]>({
    queryKey: ['vessels', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessels')
        .select('id, name, vessel_type, loa_meters, nda_flag, vessel_size_bands(label)')
        .eq('owner_person_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Vessel[];
    },
    enabled: !!user,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['vessels', user?.id] });
  }

  return { ...query, invalidate };
}
