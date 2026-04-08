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

const LANGUAGES_LIST = LANGUAGES.map((l) => ({ code: l.code, label: l.label }));

const defaultLookups: LookupsData = {
  roles: [],
  certifications: [],
  experienceBrackets: [],
  sizeBands: [],
  nationalities: [],
  visaTypes: [],
  ports: [],
  cities: [],
  languages: LANGUAGES_LIST,
  loading: true,
};

const LookupsContext = createContext<LookupsData>(defaultLookups);

const CACHE_KEY = 'dw-lookups';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedLookups {
  ts: number;
  roles: RoleLookup[];
  certifications: CertLookup[];
  experienceBrackets: ExperienceBracketLookup[];
  sizeBands: SizeBandLookup[];
  nationalities: NationalityLookup[];
  visaTypes: VisaTypeLookup[];
  ports: PortLookup[];
  cities: CityLookup[];
}

function readCache(): CachedLookups | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLookups;
    if (!parsed.ts || Date.now() - parsed.ts > CACHE_MAX_AGE_MS) return null;
    if (!parsed.roles?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: Omit<CachedLookups, 'ts'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
  } catch {
    // quota exceeded — ignore
  }
}

function buildLookupsData(
  roles: RoleLookup[],
  certifications: CertLookup[],
  experienceBrackets: ExperienceBracketLookup[],
  sizeBands: SizeBandLookup[],
  nationalities: NationalityLookup[],
  visaTypes: VisaTypeLookup[],
  ports: PortLookup[],
  cities: CityLookup[],
): LookupsData {
  return {
    roles,
    certifications,
    experienceBrackets,
    sizeBands,
    nationalities,
    visaTypes,
    ports,
    cities,
    languages: LANGUAGES_LIST,
    loading: false,
  };
}

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LookupsData>(() => {
    // Hydrate from cache synchronously if available
    if (typeof window === 'undefined') return defaultLookups;
    const cached = readCache();
    if (cached) {
      return buildLookupsData(
        cached.roles,
        cached.certifications,
        cached.experienceBrackets,
        cached.sizeBands,
        cached.nationalities,
        cached.visaTypes,
        cached.ports,
        cached.cities,
      );
    }
    return defaultLookups;
  });
  const [fetchedAt, setFetchedAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return parsed.ts ?? 0;
    } catch {
      return 0;
    }
  });

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

    const roles = (rolesRes.data ?? []) as RoleLookup[];
    const certifications = (certsRes.data ?? []) as CertLookup[];
    const experienceBrackets = (bracketsRes.data ?? []) as ExperienceBracketLookup[];
    const sizeBands = (bandsRes.data ?? []) as SizeBandLookup[];
    const nationalities = (natRes.data ?? []) as NationalityLookup[];
    const visaTypes = (visaRes.data ?? []) as VisaTypeLookup[];
    const ports = (portsRes.data ?? []) as unknown as PortLookup[];
    const cities = (citiesRes.data ?? []) as unknown as CityLookup[];

    setData(
      buildLookupsData(
        roles,
        certifications,
        experienceBrackets,
        sizeBands,
        nationalities,
        visaTypes,
        ports,
        cities,
      ),
    );
    setFetchedAt(Date.now());
    writeCache({
      roles,
      certifications,
      experienceBrackets,
      sizeBands,
      nationalities,
      visaTypes,
      ports,
      cities,
    });
  }, []);

  // Background revalidation on mount (skip if cache is still fresh)
  useEffect(() => {
    if (fetchedAt > 0 && Date.now() - fetchedAt < CACHE_MAX_AGE_MS) return;
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
      const roles = (rolesRes.data ?? []) as RoleLookup[];
      const certifications = (certsRes.data ?? []) as CertLookup[];
      const experienceBrackets = (bracketsRes.data ?? []) as ExperienceBracketLookup[];
      const sizeBands = (bandsRes.data ?? []) as SizeBandLookup[];
      const nationalities = (natRes.data ?? []) as NationalityLookup[];
      const visaTypes = (visaRes.data ?? []) as VisaTypeLookup[];
      const ports = (portsRes.data ?? []) as unknown as PortLookup[];
      const cities = (citiesRes.data ?? []) as unknown as CityLookup[];
      setData(
        buildLookupsData(
          roles,
          certifications,
          experienceBrackets,
          sizeBands,
          nationalities,
          visaTypes,
          ports,
          cities,
        ),
      );
      setFetchedAt(Date.now());
      writeCache({
        roles,
        certifications,
        experienceBrackets,
        sizeBands,
        nationalities,
        visaTypes,
        ports,
        cities,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidate on visibility change if stale
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - fetchedAt > CACHE_MAX_AGE_MS) {
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
