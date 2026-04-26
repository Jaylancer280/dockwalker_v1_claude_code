'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, Search, MapPin, Check, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { safeFetch } from '@/lib/safe-fetch';
import { LocationRequestModal } from '@/components/location-request-modal';
import type { LocationSearchResult } from '@/app/api/locations/search/route';
import type { TopLocationResult } from '@/app/api/locations/top/route';
import type { LocationByIdResult } from '@/app/api/locations/by-ids/route';
import type { ExternalLocationResult } from '@/app/api/locations/search-external/route';

/** Matches Tailwind's md breakpoint (768px). Initialises from
 * window.innerWidth so the first render matches the real device, avoiding
 * a flash of the wrong overlay. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

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
const EXTERNAL_MIN_QUERY = 3;

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
  const [externalResults, setExternalResults] = useState<ExternalLocationResult[] | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [adoptingOsmKey, setAdoptingOsmKey] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
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
        if (!cancelled) {
          setSearchResults(null);
          setExternalResults(null);
        }
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

  // OSM Nominatim live fallback. Fires only after canonical search has
  // returned zero hits and the query is meaty enough (≥3 chars). The
  // route handles its own rate-limit + error swallowing — we just render
  // whatever it returns. Skipped in `port-required` mode because the
  // canonicalize endpoint creates cities, not ports — Wave C's manual
  // request flow is the right tool for new port submissions.
  useEffect(() => {
    let cancelled = false;
    const stillWaitingOnCanonical = searchResults === null;
    const shouldFire =
      mode !== 'port-required' &&
      !!debouncedQuery &&
      debouncedQuery.length >= EXTERNAL_MIN_QUERY &&
      !stillWaitingOnCanonical &&
      searchResults!.length === 0;

    if (stillWaitingOnCanonical) return;

    if (!shouldFire) {
      const reset = setTimeout(() => {
        if (!cancelled) setExternalResults(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(reset);
      };
    }

    const startLoading = setTimeout(() => {
      if (!cancelled) setExternalLoading(true);
    }, 0);
    safeFetch<{ results: ExternalLocationResult[] }>(
      `/api/locations/search-external?q=${encodeURIComponent(debouncedQuery)}`,
    )
      .then((res) => {
        if (cancelled) return;
        setExternalResults(res.ok ? res.data.results : []);
      })
      .finally(() => {
        if (!cancelled) setExternalLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(startLoading);
    };
  }, [mode, debouncedQuery, searchResults]);

  const handleManualSubmit = useCallback(
    (result: { cityId: string; portId?: string }, displayLabel: string) => {
      const cityName = displayLabel.split(',')[0]?.trim() ?? displayLabel;
      const regionName = displayLabel.split(',').slice(-1)[0]?.trim() ?? null;
      // Prime the label cache so the trigger renders the user's typed
      // text immediately — no /by-ids round-trip needed.
      setLabels((prev) => {
        const ports = new Map(prev.ports);
        const cities = new Map(prev.cities);
        cities.set(result.cityId, { name: cityName, regionName });
        if (result.portId) {
          // For port submissions the displayLabel starts with the port name.
          const portName = displayLabel.split(' — ')[0]?.trim() ?? cityName;
          ports.set(result.portId, {
            name: portName,
            cityName,
            regionName,
          });
        }
        return { ports, cities };
      });
      onValueChange(
        result.portId
          ? { cityId: result.cityId, portId: result.portId }
          : { cityId: result.cityId },
      );
      setRequestModalOpen(false);
      setOpen(false);
      setQuery('');
    },
    [onValueChange],
  );

  const adoptExternal = useCallback(
    async (r: ExternalLocationResult) => {
      const key = `${r.osm_type}:${r.osm_id}`;
      setAdoptingOsmKey(key);
      try {
        const res = await safeFetch<{ cityId: string }>('/api/locations/canonicalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            osm_id: r.osm_id,
            osm_type: r.osm_type,
            name: r.name,
            country_code: r.country_code,
            country_name: r.country_name,
            latitude: r.latitude,
            longitude: r.longitude,
            place_type: r.place_type,
          }),
        });
        if (!res.ok) {
          setAdoptingOsmKey(null);
          return;
        }
        const cityId = res.data.cityId;
        // Prime the label cache so the trigger renders without an extra
        // round-trip through /api/locations/by-ids.
        setLabels((prev) => {
          const cities = new Map(prev.cities);
          cities.set(cityId, { name: r.name, regionName: r.country_name ?? null });
          return { ports: prev.ports, cities };
        });
        onValueChange({ cityId });
        setOpen(false);
        setQuery('');
        setAdoptingOsmKey(null);
      } catch {
        setAdoptingOsmKey(null);
      }
    },
    [onValueChange],
  );

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
  const isMobile = useIsMobile();

  // Don't show a "Searching…" flash the very first time the sheet opens —
  // top results arrive fast enough that rendering an empty list reads as
  // instant. Only show the loading state for subsequent user-driven searches.
  const showLoading = loading && isSearching;

  function handleClose() {
    setOpen(false);
    setQuery('');
  }

  const triggerButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={disabled}
      aria-required={required || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 dark:bg-input/30 dark:hover:bg-input/50"
      data-size="default"
    >
      <span className={displayLabel ? 'truncate' : 'text-muted-foreground'}>
        {displayLabel ?? placeholder ?? defaultPlaceholder}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );

  const resultsBody = (
    <>
      {showLoading && (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Searching…</p>
      )}

      {!showLoading &&
        isSearching &&
        searchResults !== null &&
        searchResults.length === 0 &&
        externalLoading && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Searching OpenStreetMap…
          </p>
        )}

      {!showLoading &&
        isSearching &&
        searchResults !== null &&
        searchResults.length === 0 &&
        !externalLoading &&
        (externalResults === null || externalResults.length === 0) && (
          <NoMatchManualFallback mode={mode} onAddManually={() => setRequestModalOpen(true)} />
        )}

      {!showLoading &&
        isSearching &&
        searchResults !== null &&
        searchResults.length === 0 &&
        externalResults !== null &&
        externalResults.length > 0 && (
          <ExternalResultsList
            results={externalResults}
            adoptingKey={adoptingOsmKey}
            onAdopt={adoptExternal}
            onAddManually={() => setRequestModalOpen(true)}
          />
        )}

      {!showLoading && isSearching && searchResults && searchResults.length > 0 && (
        <SearchResultsList
          results={searchResults}
          mode={mode}
          value={value}
          onSelectPort={selectPort}
          onSelectCity={selectCity}
        />
      )}

      {!showLoading && !isSearching && topResults && topResults.length > 0 && (
        <TopResultsList results={topResults} value={value} onSelectPort={selectPort} />
      )}

      {!showLoading && !isSearching && topResults === null && (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Loading top ports…</p>
      )}

      {!showLoading && !isSearching && topResults && topResults.length === 0 && (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          Start typing to search.
        </p>
      )}
    </>
  );

  const footer = (
    <p className="border-t px-3 py-2 text-[10px] leading-tight text-muted-foreground">
      Can&apos;t find your port? Pick the closest one. · © OpenStreetMap contributors
    </p>
  );

  const requestModal = (
    <LocationRequestModal
      open={requestModalOpen}
      mode={mode}
      initialQuery={query}
      onClose={() => setRequestModalOpen(false)}
      onSubmitted={handleManualSubmit}
    />
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <LocationPickerSheet
          open={open}
          onClose={handleClose}
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          resultsBody={resultsBody}
          footer={footer}
        />
        {requestModal}
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>

      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] max-h-[28rem] overflow-hidden p-0">
        <div className="flex h-[28rem] flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
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
          <div className="min-h-0 flex-1 overflow-y-auto">{resultsBody}</div>
          <div className="shrink-0">{footer}</div>
        </div>
      </PopoverContent>
      {requestModal}
    </Popover>
  );
}

function LocationPickerSheet({
  open,
  onClose,
  query,
  setQuery,
  searchRef,
  resultsBody,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  setQuery: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  resultsBody: React.ReactNode;
  footer: React.ReactNode;
}) {
  useBodyScrollLock(open);

  // Track the visual viewport height so the modal shrinks to match whatever
  // screen space is ACTUALLY available once the keyboard is open. `dvh` in
  // CSS handles modern iOS/Android, but older Safari + edge cases still
  // leak through. `visualViewport.height` is the authoritative source of
  // truth — fall back to window.innerHeight when the API is unavailable.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function update() {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    }
    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    // Focus the search input on open so the keyboard comes up immediately.
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
    };
  }, [open, onClose, searchRef]);

  if (!open) return null;

  // Prefer JS-measured height when available (robust across Safari versions
  // and split-screen / Stage Manager). Fall back to `dvh` via the CSS
  // default. The modal fills the full visible viewport — header, search
  // input, scrollable results, and footer stack vertically so the input
  // is ALWAYS pinned at the top above the keyboard.
  const heightStyle: React.CSSProperties = viewportHeight
    ? { height: `${viewportHeight}px` }
    : { height: '100dvh' };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] bg-black/50"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col bg-background md:mx-auto md:my-auto md:rounded-2xl md:shadow-xl"
        style={heightStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold">Select location</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or port..."
            className="h-7 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            inputMode="search"
            aria-label="Search location"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{resultsBody}</div>
        <div className="shrink-0">{footer}</div>
      </div>
    </div>
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

function ExternalResultsList({
  results,
  adoptingKey,
  onAdopt,
  onAddManually,
}: {
  results: ExternalLocationResult[];
  adoptingKey: string | null;
  onAdopt: (r: ExternalLocationResult) => void;
  onAddManually: () => void;
}) {
  return (
    <>
      <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Found in OpenStreetMap
      </p>
      {results.map((r) => {
        const key = `${r.osm_type}:${r.osm_id}`;
        const adopting = adoptingKey === key;
        const tail = r.country_name ?? r.country_code ?? null;
        return (
          <button
            key={key}
            type="button"
            disabled={adoptingKey !== null}
            onClick={() => onAdopt(r)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {r.place_type}
              </span>
              <span className="mx-1">{r.name}</span>
              {tail && <span className="text-xs text-muted-foreground">— {tail}</span>}
            </span>
            {adopting && <span className="ml-auto text-[10px] text-muted-foreground">Adding…</span>}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddManually}
        disabled={adoptingKey !== null}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded border-t border-dashed px-3 py-3 text-xs text-primary hover:bg-accent disabled:opacity-50"
      >
        Still can&apos;t find it? Add it manually
      </button>
    </>
  );
}

function NoMatchManualFallback({
  mode,
  onAddManually,
}: {
  mode: 'port-required' | 'port-optional';
  onAddManually: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-5 text-center">
      <p className="text-xs text-muted-foreground">
        {mode === 'port-required'
          ? 'No match — try a different spelling, or add the port manually.'
          : 'No match in our list or OpenStreetMap. Add it manually so you can use it now.'}
      </p>
      <button
        type="button"
        onClick={onAddManually}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Add it manually
      </button>
    </div>
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
