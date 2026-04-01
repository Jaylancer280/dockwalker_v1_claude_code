'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LANGUAGES } from '@dockwalker/shared';

export interface RoleLookup {
  id: string;
  name: string;
  department: string;
}

export interface CertLookup {
  id: string;
  name: string;
  category: string;
}

export interface ExperienceBracketLookup {
  id: string;
  label: string;
}

export interface SizeBandLookup {
  id: string;
  label: string;
}

export interface NationalityLookup {
  id: string;
  name: string;
  flag_emoji: string;
}

export interface VisaTypeLookup {
  id: string;
  name: string;
}

export interface PortLookup {
  id: string;
  name: string;
  cities: { name: string; regions: { name: string } } | null;
}

export interface CityLookup {
  id: string;
  name: string;
  region_id: string;
  regions: { name: string } | null;
}

export interface LookupsData {
  roles: RoleLookup[];
  certifications: CertLookup[];
  experienceBrackets: ExperienceBracketLookup[];
  sizeBands: SizeBandLookup[];
  nationalities: NationalityLookup[];
  visaTypes: VisaTypeLookup[];
  ports: PortLookup[];
  cities: CityLookup[];
  languages: { code: string; label: string }[];
  loading: boolean;
}

const defaultLookups: LookupsData = {
  roles: [],
  certifications: [],
  experienceBrackets: [],
  sizeBands: [],
  nationalities: [],
  visaTypes: [],
  ports: [],
  cities: [],
  languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
  loading: true,
};

const LookupsContext = createContext<LookupsData>(defaultLookups);

const REVALIDATE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LookupsData>(defaultLookups);
  const [fetchedAt, setFetchedAt] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [rolesRes, certsRes, bracketsRes, bandsRes, natRes, visaRes, portsRes, citiesRes] =
      await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('certifications').select('id, name, category').order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('min_months'),
        supabase.from('vessel_size_bands').select('id, label').order('min_meters'),
        supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
        supabase.from('visa_types').select('id, name').order('sort_order'),
        supabase.from('ports').select('id, name, cities(name, regions(name))').order('name'),
        supabase.from('cities').select('id, name, region_id, regions(name)').order('name'),
      ]);

    setData({
      roles: (rolesRes.data ?? []) as RoleLookup[],
      certifications: (certsRes.data ?? []) as CertLookup[],
      experienceBrackets: (bracketsRes.data ?? []) as ExperienceBracketLookup[],
      sizeBands: (bandsRes.data ?? []) as SizeBandLookup[],
      nationalities: (natRes.data ?? []) as NationalityLookup[],
      visaTypes: (visaRes.data ?? []) as VisaTypeLookup[],
      ports: (portsRes.data ?? []) as unknown as PortLookup[],
      cities: (citiesRes.data ?? []) as unknown as CityLookup[],
      languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
      loading: false,
    });
    setFetchedAt(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
      supabase.from('certifications').select('id, name, category').order('sort_order'),
      supabase.from('experience_brackets').select('id, label').order('min_months'),
      supabase.from('vessel_size_bands').select('id, label').order('min_meters'),
      supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
      supabase.from('visa_types').select('id, name').order('sort_order'),
      supabase.from('ports').select('id, name, cities(name, regions(name))').order('name'),
      supabase.from('cities').select('id, name, region_id, regions(name)').order('name'),
    ]).then(([rolesRes, certsRes, bracketsRes, bandsRes, natRes, visaRes, portsRes, citiesRes]) => {
      if (cancelled) return;
      setData({
        roles: (rolesRes.data ?? []) as RoleLookup[],
        certifications: (certsRes.data ?? []) as CertLookup[],
        experienceBrackets: (bracketsRes.data ?? []) as ExperienceBracketLookup[],
        sizeBands: (bandsRes.data ?? []) as SizeBandLookup[],
        nationalities: (natRes.data ?? []) as NationalityLookup[],
        visaTypes: (visaRes.data ?? []) as VisaTypeLookup[],
        ports: (portsRes.data ?? []) as unknown as PortLookup[],
        cities: (citiesRes.data ?? []) as unknown as CityLookup[],
        languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })),
        loading: false,
      });
      setFetchedAt(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revalidate on visibility change if stale
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt > REVALIDATE_MS) {
        load();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchedAt, load]);

  return <LookupsContext value={data}>{children}</LookupsContext>;
}

export function useLookups(): LookupsData {
  return useContext(LookupsContext);
}
