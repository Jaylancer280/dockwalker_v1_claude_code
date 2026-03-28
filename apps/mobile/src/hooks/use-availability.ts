import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface AvailabilityData {
  status: 'available' | 'not_available' | null;
  dates: string[];
  cityName: string | null;
  portName: string | null;
}

async function fetchAvailability(userId: string): Promise<AvailabilityData> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('availability_windows')
    .select('date, not_available, expires_at, city_id, port_id, cities(name), ports(name)')
    .eq('person_id', userId)
    .gt('expires_at', now)
    .order('date');

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    date: string;
    not_available: boolean;
    expires_at: string;
    city_id: string | null;
    port_id: string | null;
    cities: { name: string } | null;
    ports: { name: string } | null;
  }>;

  if (rows.length === 0) {
    return { status: null, dates: [], cityName: null, portName: null };
  }

  const notAvailRow = rows.find((r) => r.not_available);
  if (notAvailRow) {
    return { status: 'not_available', dates: [], cityName: null, portName: null };
  }

  return {
    status: 'available',
    dates: rows.map((r) => r.date),
    cityName: rows[0]?.cities?.name ?? null,
    portName: rows[0]?.ports?.name ?? null,
  };
}

export function useAvailability() {
  const { user } = useAuth();

  return useQuery<AvailabilityData>({
    queryKey: ['availability', user?.id],
    queryFn: () => fetchAvailability(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
