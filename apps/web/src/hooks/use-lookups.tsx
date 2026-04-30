'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LANGUAGES, type BundleMap } from '@dockwalker/shared';

export interface RoleLookup {
  id: string;
  name: string;
  department: string;
}

export interface CertLookup {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  sort_order: number;
}

export interface ExperienceBracketLookup {
  id: string;
  label: string;
}

export interface SizeBandLookup {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

export interface NationalityLookup {
  id: string;
  name: string;
  flag_emoji: string;
}

export interface EntryRightLookup {
  id: string;
  name: string;
  category: 'citizenship' | 'residence' | 'visa';
  sort_order: number;
}

export interface LookupsData {
  roles: RoleLookup[];
  certifications: CertLookup[];
  experienceBrackets: ExperienceBracketLookup[];
  sizeBands: SizeBandLookup[];
  nationalities: NationalityLookup[];
  entryRights: EntryRightLookup[];
  languages: { code: string; label: string }[];
  /** Map from bundle cert id → array of component cert ids it covers
   *  (per migration 00115's `certification_components` table). Used by
   *  discover cards to colour cert pills as "covered" when the crew
   *  holds a bundle that includes the required component. */
  bundleMap: BundleMap;
  loading: boolean;
}

const LANGUAGES_LIST = LANGUAGES.map((l) => ({ code: l.code, label: l.label }));

const defaultLookups: LookupsData = {
  roles: [],
  certifications: [],
  experienceBrackets: [],
  sizeBands: [],
  nationalities: [],
  entryRights: [],
  languages: LANGUAGES_LIST,
  bundleMap: {},
  loading: true,
};

const LookupsContext = createContext<LookupsData>(defaultLookups);

// Bump cache version when the lookup shape changes so stale clients drop the
// old payload cleanly. v3 renames visaTypes → entryRights (category-aware).
// v5 adds bundleMap (cert bundle expansion for discover cards).
const CACHE_KEY = 'dw-lookups-v5';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedLookups {
  ts: number;
  roles: RoleLookup[];
  certifications: CertLookup[];
  experienceBrackets: ExperienceBracketLookup[];
  sizeBands: SizeBandLookup[];
  nationalities: NationalityLookup[];
  entryRights: EntryRightLookup[];
  bundleMap: BundleMap;
}

function readCache(): (CachedLookups & { stale?: boolean }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLookups;
    if (!parsed.roles?.length) return null;
    if (!parsed.ts || Date.now() - parsed.ts > CACHE_MAX_AGE_MS) {
      return { ...parsed, stale: true };
    }
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
  entryRights: EntryRightLookup[],
  bundleMap: BundleMap,
): LookupsData {
  return {
    roles,
    certifications,
    experienceBrackets,
    sizeBands,
    nationalities,
    entryRights,
    languages: LANGUAGES_LIST,
    bundleMap,
    loading: false,
  };
}

/** Build a {bundle_id → component_id[]} map from junction-table rows. */
function buildBundleMap(rows: { bundle_cert_id: string; component_cert_id: string }[]): BundleMap {
  const map: BundleMap = {};
  for (const r of rows) {
    if (!map[r.bundle_cert_id]) map[r.bundle_cert_id] = [];
    map[r.bundle_cert_id].push(r.component_cert_id);
  }
  return map;
}

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LookupsData>(() => {
    if (typeof window === 'undefined') return defaultLookups;
    const cached = readCache();
    if (cached) {
      return buildLookupsData(
        cached.roles,
        cached.certifications,
        cached.experienceBrackets,
        cached.sizeBands,
        cached.nationalities,
        cached.entryRights,
        cached.bundleMap ?? {},
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
    const [rolesRes, certsRes, bracketsRes, bandsRes, natRes, entryRightsRes, componentsRes] =
      await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase
          .from('certifications')
          .select('id, name, category, subcategory, sort_order')
          .order('category')
          .order('subcategory')
          .order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('min_months'),
        supabase
          .from('vessel_size_bands')
          .select('id, label, min_meters, max_meters')
          .order('min_meters'),
        supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
        supabase
          .from('entry_rights')
          .select('id, name, category, sort_order')
          .order('category')
          .order('sort_order'),
        supabase.from('certification_components').select('bundle_cert_id, component_cert_id'),
      ]);

    const roles = (rolesRes.data ?? []) as RoleLookup[];
    const certifications = (certsRes.data ?? []) as CertLookup[];
    const experienceBrackets = (bracketsRes.data ?? []) as ExperienceBracketLookup[];
    const sizeBands = (bandsRes.data ?? []) as SizeBandLookup[];
    const nationalities = (natRes.data ?? []) as NationalityLookup[];
    const entryRights = (entryRightsRes.data ?? []) as EntryRightLookup[];
    const bundleMap = buildBundleMap(
      (componentsRes.data ?? []) as { bundle_cert_id: string; component_cert_id: string }[],
    );

    setData(
      buildLookupsData(
        roles,
        certifications,
        experienceBrackets,
        sizeBands,
        nationalities,
        entryRights,
        bundleMap,
      ),
    );
    setFetchedAt(Date.now());
    writeCache({
      roles,
      certifications,
      experienceBrackets,
      sizeBands,
      nationalities,
      entryRights,
      bundleMap,
    });
  }, []);

  // Background revalidation on mount (skip if cache is fresh — stale cache triggers refresh)
  useEffect(() => {
    const cached = typeof window !== 'undefined' ? readCache() : null;
    if (cached && !cached.stale) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
      supabase
        .from('certifications')
        .select('id, name, category, subcategory, sort_order')
        .order('category')
        .order('subcategory')
        .order('sort_order'),
      supabase.from('experience_brackets').select('id, label').order('min_months'),
      supabase
        .from('vessel_size_bands')
        .select('id, label, min_meters, max_meters')
        .order('min_meters'),
      supabase.from('nationalities').select('id, name, flag_emoji').order('sort_order'),
      supabase
        .from('entry_rights')
        .select('id, name, category, sort_order')
        .order('category')
        .order('sort_order'),
      supabase.from('certification_components').select('bundle_cert_id, component_cert_id'),
    ]).then(
      ([rolesRes, certsRes, bracketsRes, bandsRes, natRes, entryRightsRes, componentsRes]) => {
        if (cancelled) return;
        const roles = (rolesRes.data ?? []) as RoleLookup[];
        const certifications = (certsRes.data ?? []) as CertLookup[];
        const experienceBrackets = (bracketsRes.data ?? []) as ExperienceBracketLookup[];
        const sizeBands = (bandsRes.data ?? []) as SizeBandLookup[];
        const nationalities = (natRes.data ?? []) as NationalityLookup[];
        const entryRights = (entryRightsRes.data ?? []) as EntryRightLookup[];
        const bundleMap = buildBundleMap(
          (componentsRes.data ?? []) as {
            bundle_cert_id: string;
            component_cert_id: string;
          }[],
        );
        setData(
          buildLookupsData(
            roles,
            certifications,
            experienceBrackets,
            sizeBands,
            nationalities,
            entryRights,
            bundleMap,
          ),
        );
        setFetchedAt(Date.now());
        writeCache({
          roles,
          certifications,
          experienceBrackets,
          sizeBands,
          nationalities,
          entryRights,
          bundleMap,
        });
      },
    );
    return () => {
      cancelled = true;
    };
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
