'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';
import type { LocationSearchResult } from '@/app/api/locations/search/route';
import type { LocationByIdResult } from '@/app/api/locations/by-ids/route';

export interface CitiesPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 200;

/**
 * Multi-select city picker backed by server-side fuzzy search.
 *
 * Used for agent placement cities (onboarding, profile edit). Replaces the
 * previous `citiesToGroups → HierarchicalPills` pattern which required
 * eager-loading every city in `useLookups`.
 */
export function CitiesPicker({ selectedIds, onChange, placeholder }: CitiesPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [labels, setLabels] = useState<Map<string, { name: string; regionName: string | null }>>(
    () => new Map(),
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Hydrate labels for any selectedIds we don't have yet.
  useEffect(() => {
    const missing = selectedIds.filter((id) => !labels.has(id));
    if (missing.length === 0) return;
    const params = new URLSearchParams({ cities: missing.join(',') });
    let cancelled = false;
    safeFetch<{ results: LocationByIdResult[] }>(`/api/locations/by-ids?${params.toString()}`)
      .then((res) => {
        if (cancelled || !res.ok) return;
        setLabels((prev) => {
          const next = new Map(prev);
          for (const r of res.data.results) {
            if (r.kind === 'city') next.set(r.id, { name: r.name, regionName: r.region_name });
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedIds, labels]);

  // Debounce search. Always schedule the setState inside setTimeout so the
  // effect body itself never dispatches a synchronous render.
  useEffect(() => {
    const trimmed = query.trim();
    const ready = trimmed.length >= 2;
    const handle = setTimeout(
      () => setDebouncedQuery(ready ? trimmed : ''),
      ready ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(handle);
  }, [query]);

  // Fire the search.
  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      const reset = setTimeout(() => {
        if (!cancelled) setResults(null);
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
          const cities = res.data.results.filter((r) => r.kind === 'city');
          setResults(cities);
          setLabels((prev) => {
            const next = new Map(prev);
            for (const c of cities) next.set(c.id, { name: c.name, regionName: c.parent_name });
            return next;
          });
        } else {
          setResults([]);
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

  const toggle = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        onChange(selectedIds.filter((x) => x !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    },
    [selectedSet, selectedIds, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const entry = labels.get(id);
            const label = entry
              ? entry.regionName
                ? `${entry.name}, ${entry.regionName}`
                : entry.name
              : id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove ${label}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white"
              >
                <span>{label}</span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search cities…'}
          className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search cities"
        />
      </div>

      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}

      {!loading && debouncedQuery && results !== null && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No match — try a neighbouring city.</p>
      )}

      {!loading && results && results.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {results.map((r) => {
            const active = selectedSet.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                aria-pressed={active}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                  active ? 'font-medium text-primary' : ''
                }`}
              >
                <span className="truncate">
                  {r.name}
                  {r.parent_name && (
                    <span className="ml-1 text-xs text-muted-foreground">— {r.parent_name}</span>
                  )}
                </span>
                {active && <span className="ml-2 text-xs text-primary">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
