import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface Role {
  id: string;
  name: string;
  department: string;
}

interface Certification {
  id: string;
  name: string;
  category: string;
}

interface Port {
  id: string;
  name: string;
  city_id: string;
  cities: { name: string; regions: { name: string } };
}

interface City {
  id: string;
  name: string;
  region_id: string;
  regions: { name: string };
}

interface Region {
  id: string;
  name: string;
}

interface ExperienceBracket {
  id: string;
  label: string;
}

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

interface Nationality {
  id: string;
  name: string;
  flag_emoji: string;
}

interface VisaType {
  id: string;
  name: string;
}

interface FlagState {
  id: string;
  name: string;
}

const CANONICAL_STALE = Infinity;

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['canonical', 'roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yacht_roles')
        .select('id, name, department')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as Role[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useCertifications() {
  return useQuery<Certification[]>({
    queryKey: ['canonical', 'certifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('id, name, category')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as Certification[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function usePorts() {
  return useQuery<{ regions: Region[]; cities: City[]; ports: Port[] }>({
    queryKey: ['canonical', 'ports'],
    queryFn: async () => {
      const [regionsRes, citiesRes, portsRes] = await Promise.all([
        supabase.from('regions').select('id, name').order('sort_order'),
        supabase.from('cities').select('id, name, region_id, regions(name)').order('sort_order'),
        supabase
          .from('ports')
          .select('id, name, city_id, cities(name, regions(name))')
          .order('sort_order'),
      ]);
      if (regionsRes.error) throw regionsRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (portsRes.error) throw portsRes.error;
      return {
        regions: (regionsRes.data ?? []) as Region[],
        cities: (citiesRes.data ?? []) as unknown as City[],
        ports: (portsRes.data ?? []) as unknown as Port[],
      };
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useExperienceBrackets() {
  return useQuery<ExperienceBracket[]>({
    queryKey: ['canonical', 'experienceBrackets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experience_brackets')
        .select('id, label')
        .order('min_months');
      if (error) throw error;
      return (data ?? []) as ExperienceBracket[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useSizeBands() {
  return useQuery<SizeBand[]>({
    queryKey: ['canonical', 'sizeBands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessel_size_bands')
        .select('id, label, min_meters, max_meters')
        .order('min_meters');
      if (error) throw error;
      return (data ?? []) as SizeBand[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useNationalities() {
  return useQuery<Nationality[]>({
    queryKey: ['canonical', 'nationalities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nationalities')
        .select('id, name, flag_emoji')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Nationality[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useVisaTypes() {
  return useQuery<VisaType[]>({
    queryKey: ['canonical', 'visaTypes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visa_types')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as VisaType[];
    },
    staleTime: CANONICAL_STALE,
  });
}

export function useFlagStates() {
  return useQuery<FlagState[]>({
    queryKey: ['canonical', 'flagStates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flag_states')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as FlagState[];
    },
    staleTime: CANONICAL_STALE,
  });
}
