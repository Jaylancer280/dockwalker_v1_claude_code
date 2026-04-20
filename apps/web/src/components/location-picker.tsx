'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, Search, MapPin, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { safeFetch } from '@/lib/safe-fetch';
import type { LocationSearchResult } from '@/app/api/locations/search/route';
import type { TopLocationResult } from '@/app/api/locations/top/route';
import type { LocationByIdResult } from '@/app/api/locations/by-ids/route';

export interface LocationValue {
  cityId?: string;
  portId?: string;
}

export interface LocationPickerProps {
  /** 'port-required': only ports are selectable. 'port-optional': city is enough, port is optional. */
  mode: 'port-required' | 'port-optional';
  value: LocationValue | null;
  onValueChange: (value: LocationValue) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

interface LabelCache {
  ports: Map<string, { name: string; cityName: string | null; regionName: string | null }>;
  cities: Map<string, { name: string; regionName: string | null }>;
}

const DEBOUNCE_MS = 200;
const TOP_LIMIT = 50;

/**
 * Searchable location picker backed by server-side fuzzy search.
 *
 * - Opens → fetches top-N most-used ports (`/api/locations/top`)
 * - Typing 2+ chars → debounced search (`/api/locations/search`,
 *   diacritic-insensitive, pg_trgm similarity)
 * - Existing value hydrated via `/api/locations/by-ids`
 * - Canonical-only: if the user can't find their marina, they pick the
 *   nearest city or port. No free-text fallback.
 */
export function LocationPicker({
  mode,
  value,
  onValueChange,
  placeholder,
  disabled,
  required,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [topResults, setTopResults] = useState<TopLocationResult[] | null>(null);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [labels, setLabels] = useState<LabelCache>({ ports: new Map(), cities: new Map() });

  const mergeLabels = useCallback((next: LocationByIdResult[]) => {
    setLabels((prev) => {
      const ports = new Map(prev.ports);
      const cities = new Map(prev.cities);
      for (const r of next) {
        if (r.kind === 'port') {
          ports.set(r.id, {
            name: r.name,
            cityName: r.city_name,
            regionName: r.region_name,
          });
        } else if (r.kind === 'city') {
          cities.set(r.id, { name: r.name, regionName: r.region_name });
        }
      }
      return { ports, cities };
    });
  }, []);

  // Hydrate the label cache from props whenever the selection changes to IDs
  // we haven't resolved yet.
  useEffect(() => {
    const portId = value?.portId;
    const cityId = value?.cityId;
    const needPort = portId && !labels.ports.has(portId);
    const needCity = cityId && !labels.cities.has(cityId);
    if (!needPort && !needCity) return;

    const params = new URLSearchParams();
    if (needPort && portId) params.set('ports', portId);
    if (needCity && cityId) params.set('cities', cityId);

    let cancelled = false;
    safeFetch<{ results: LocationByIdResult[] }>(`/api/locations/by-ids?${params.toString()}`)
      .then((res) => {
        if (cancelled || !res.ok) return;
        mergeLabels(res.data.results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value?.portId, value?.cityId, labels, mergeLabels]);

  // Load top-N on first open.
  useEffect(() => {
    if (!open || topResults !== null) return;
    let cancelled = false;
    const startLoading = setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    safeFetch<{ results: TopLocationResult[] }>(`/api/locations/top?limit=${TOP_LIMIT}`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setTopResults(res.data.results);
          // Prime the label cache so displayLabel works post-selection without a round-trip
          mergeLabels(
            res.data.results.map((r) => ({
              id: r.id,
              kind: 'port' as const,
              name: r.name,
              city_id: r.city_id,
              city_name: r.city_name,
              region_id: r.region_id,
              region_name: r.region_name,
              country_code: r.country_code,
            })),
          );
        } else {
          setTopResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(startLoading);
    };
  }, [open, topResults, mergeLabels]);

  // Debounce the search query. setState is always wrapped in a timer so the
  // effect body never dispatches synchronously.
  useEffect(() => {
    const trimmed = query.trim();
    const ready = trimmed.length >= 2;
    const handle = setTimeout(
      () => setDebouncedQuery(ready ? trimmed : ''),
      ready ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(handle);
  }, [query]);

  // Fire the search when the debounced query changes.
  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      const reset = setTimeout(() => {
        if (!cancelled) setSearchResults(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(reset);
      };
    }
    const startLoading = setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    safeFetch<{ results: LocationSearchResult[] }>(
      `/api/locations/search?q=${encodeURIComponent(debouncedQuery)}`,
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSearchResults(res.data.results);
          // Port results include parent_name (city); that's enough for label
          // display on selection.
          const ports = res.data.results.filter((r) => r.kind === 'port');
          const cities = res.data.results.filter((r) => r.kind === 'city');
          setLabels((prev) => {
            const next = {
              ports: new Map(prev.ports),
              cities: new Map(prev.cities),
            };
            for (const p of ports) {
              next.ports.set(p.id, {
                name: p.name,
                cityName: p.parent_name,
                regionName: null,
              });
            }
            for (const c of cities) {
              next.cities.set(c.id, { name: c.name, regionName: p_name(c) });
            }
            return next;
          });
        } else {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(startLoading);
    };
  }, [debouncedQuery]);

  const displayLabel = useMemo(() => {
    if (!value) return null;
    if (value.portId) {
      const p = labels.ports.get(value.portId);
      if (p) {
        const parts = [p.name, p.cityName, p.regionName].filter(Boolean);
        return parts.join(' — ');
      }
    }
    if (value.cityId) {
      const c = labels.cities.get(value.cityId);
      if (c) {
        return c.regionName ? `${c.name}, ${c.regionName}` : c.name;
      }
    }
    return null;
  }, [value, labels]);

  function selectCity(cityId: string) {
    onValueChange({ cityId });
    setOpen(false);
    setQuery('');
  }

  function selectPort(portId: string, cityId: string | null) {
    onValueChange({ cityId: cityId ?? undefined, portId });
    setOpen(false);
    setQuery('');
  }

  const defaultPlaceholder = mode === 'port-required' ? 'Select port/marina' : 'Select location';
  const isSearching = debouncedQuery.length >= 2;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-required={required || undefined}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 dark:bg-input/30 dark:hover:bg-input/50"
          data-size="default"
        >
          <span className={displayLabel ? 'truncate' : 'text-muted-foreground'}>
            {displayLabel ?? placeholder ?? defaultPlaceholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] max-h-96 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or port..."
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoFocus
            aria-label="Search location"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {loading && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Searching…</p>
          )}

          {!loading && isSearching && searchResults !== null && searchResults.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No match — try the nearest city or port instead.
            </p>
          )}

          {!loading && isSearching && searchResults && searchResults.length > 0 && (
            <SearchResultsList
              results={searchResults}
              mode={mode}
              value={value}
              onSelectPort={selectPort}
              onSelectCity={selectCity}
            />
          )}

          {!loading && !isSearching && topResults && topResults.length > 0 && (
            <TopResultsList results={topResults} value={value} onSelectPort={selectPort} />
          )}

          {!loading && !isSearching && topResults && topResults.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Start typing to search.
            </p>
          )}
        </div>

        <div className="border-t px-3 py-2 text-[10px] leading-tight text-muted-foreground">
          <p>Can&apos;t find your port? Pick the closest one.</p>
          <p>Data © OpenStreetMap contributors (ODbL).</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper for label cache region_name from a city search hit (city's parent is
// the region).
function p_name(c: LocationSearchResult): string | null {
  return c.parent_name ?? null;
}

function TopResultsList({
  results,
  value,
  onSelectPort,
}: {
  results: TopLocationResult[];
  value: LocationValue | null;
  onSelectPort: (portId: string, cityId: string | null) => void;
}) {
  return (
    <>
      {results.map((r) => {
        const isSelected = value?.portId === r.id;
        const tail = [r.city_name, r.region_name].filter(Boolean).join(', ');
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelectPort(r.id, r.city_id)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
              isSelected ? 'font-medium text-primary' : ''
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              <span>{r.name}</span>
              {tail && <span className="ml-1 text-xs text-muted-foreground">— {tail}</span>}
            </span>
            {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
          </button>
        );
      })}
    </>
  );
}

function SearchResultsList({
  results,
  mode,
  value,
  onSelectPort,
  onSelectCity,
}: {
  results: LocationSearchResult[];
  mode: 'port-required' | 'port-optional';
  value: LocationValue | null;
  onSelectPort: (portId: string, cityId: string | null) => void;
  onSelectCity: (cityId: string) => void;
}) {
  const visible = mode === 'port-required' ? results.filter((r) => r.kind === 'port') : results;

  if (visible.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
        No match — try the nearest city or port instead.
      </p>
    );
  }

  return (
    <>
      {visible.map((r) => {
        const isSelected =
          (r.kind === 'port' && value?.portId === r.id) ||
          (r.kind === 'city' && value?.cityId === r.id && !value?.portId);
        const handleClick = () => {
          if (r.kind === 'port') onSelectPort(r.id, r.parent_id);
          else if (r.kind === 'city') onSelectCity(r.id);
        };
        const badge = r.kind === 'port' ? 'Port' : r.kind === 'city' ? 'City' : 'Region';
        const tail = r.parent_name ? (r.kind === 'port' ? r.parent_name : r.parent_name) : null;
        const disabled = mode === 'port-required' && r.kind === 'region';
        return (
          <button
            key={`${r.kind}-${r.id}`}
            type="button"
            disabled={disabled}
            onClick={handleClick}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50 ${
              isSelected ? 'font-medium text-primary' : ''
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
              <span className="mx-1">{r.name}</span>
              {tail && <span className="text-xs text-muted-foreground">— {tail}</span>}
            </span>
            {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
          </button>
        );
      })}
    </>
  );
}
