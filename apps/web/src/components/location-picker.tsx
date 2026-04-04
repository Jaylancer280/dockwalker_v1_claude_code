'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, MapPin, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';

interface RegionData {
  id: string;
  name: string;
}

interface CityData {
  id: string;
  name: string;
  region_id: string;
  regions: { name: string } | null;
}

interface PortData {
  id: string;
  name: string;
  city_id: string;
  cities: { name: string; regions: { name: string } } | null;
}

interface HierarchyCity {
  id: string;
  name: string;
  ports: HierarchyPort[];
}

interface HierarchyPort {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
}

interface HierarchyRegion {
  id: string;
  name: string;
  cities: HierarchyCity[];
}

export interface LocationValue {
  cityId?: string;
  portId?: string;
}

export interface LocationPickerProps {
  /** 'port-required': must select a port. 'port-optional': city is enough, port is optional drill-down. */
  mode: 'port-required' | 'port-optional';
  value: LocationValue | null;
  onValueChange: (value: LocationValue) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Searchable hierarchical location picker.
 * Renders Region > City > Port/Marina in a popover with text search.
 */
export function LocationPicker({
  mode,
  value,
  onValueChange,
  placeholder,
  disabled,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [regions, setRegions] = useState<HierarchyRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // Flat lookups for resolving display labels
  const [cityMap, setCityMap] = useState<Map<string, { name: string; regionName: string }>>(
    new Map(),
  );
  const [portMap, setPortMap] = useState<
    Map<string, { name: string; cityName: string; regionName: string }>
  >(new Map());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [regionsRes, citiesRes, portsRes] = await Promise.all([
        supabase.from('regions').select('id, name').order('sort_order'),
        supabase.from('cities').select('id, name, region_id, regions(name)').order('sort_order'),
        supabase
          .from('ports')
          .select('id, name, city_id, cities(name, regions(name))')
          .order('sort_order'),
      ]);

      const regionsData = (regionsRes.data ?? []) as unknown as RegionData[];
      const citiesData = (citiesRes.data ?? []) as unknown as CityData[];
      const portsData = (portsRes.data ?? []) as unknown as PortData[];

      // Build city and port lookup maps
      const cMap = new Map<string, { name: string; regionName: string }>();
      for (const c of citiesData) {
        cMap.set(c.id, { name: c.name, regionName: c.regions?.name ?? '' });
      }
      setCityMap(cMap);

      const pMap = new Map<string, { name: string; cityName: string; regionName: string }>();
      for (const p of portsData) {
        pMap.set(p.id, {
          name: p.name,
          cityName: p.cities?.name ?? '',
          regionName: p.cities?.regions?.name ?? '',
        });
      }
      setPortMap(pMap);

      // Build hierarchy
      const citiesByRegion = new Map<string, CityData[]>();
      for (const c of citiesData) {
        const list = citiesByRegion.get(c.region_id) ?? [];
        list.push(c);
        citiesByRegion.set(c.region_id, list);
      }

      const portsByCity = new Map<string, PortData[]>();
      for (const p of portsData) {
        const list = portsByCity.get(p.city_id) ?? [];
        list.push(p);
        portsByCity.set(p.city_id, list);
      }

      const hierarchy: HierarchyRegion[] = regionsData.map((r) => ({
        id: r.id,
        name: r.name,
        cities: (citiesByRegion.get(r.id) ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          ports: (portsByCity.get(c.id) ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            cityId: c.id,
            cityName: c.name,
          })),
        })),
      }));

      setRegions(hierarchy);
      setLoading(false);
    }
    load();
  }, []);

  // Filter by search term
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return regions;

    return regions
      .map((region) => {
        const regionMatch = region.name.toLowerCase().includes(q);

        const filteredCities = region.cities
          .map((city) => {
            const cityMatch = city.name.toLowerCase().includes(q);
            const filteredPorts = city.ports.filter((p) => p.name.toLowerCase().includes(q));

            // Include city if it matches, or any of its ports match, or region matches
            if (regionMatch || cityMatch || filteredPorts.length > 0) {
              return {
                ...city,
                ports: cityMatch || regionMatch ? city.ports : filteredPorts,
              };
            }
            return null;
          })
          .filter(Boolean) as HierarchyCity[];

        if (filteredCities.length > 0) {
          return { ...region, cities: filteredCities };
        }
        return null;
      })
      .filter(Boolean) as HierarchyRegion[];
  }, [regions, search]);

  // When searching, auto-expand everything
  const isSearching = search.trim().length > 0;

  // Display label for the trigger button
  const displayLabel = useMemo(() => {
    if (!value) return null;
    if (value.portId) {
      const p = portMap.get(value.portId);
      if (p) return `${p.name} — ${p.cityName}, ${p.regionName}`;
    }
    if (value.cityId) {
      const c = cityMap.get(value.cityId);
      if (c) return `${c.name}, ${c.regionName}`;
    }
    return null;
  }, [value, portMap, cityMap]);

  function toggleRegion(regionId: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  }

  function toggleCity(cityId: string) {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  function selectCity(cityId: string) {
    onValueChange({ cityId });
    setOpen(false);
    setSearch('');
  }

  function selectPort(portId: string, cityId: string) {
    onValueChange({ cityId, portId });
    setOpen(false);
    setSearch('');
  }

  const defaultPlaceholder = mode === 'port-required' ? 'Select port/marina' : 'Select location';

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 dark:bg-input/30 dark:hover:bg-input/50"
          data-size="default"
        >
          <span className={displayLabel ? 'truncate' : 'text-muted-foreground'}>
            {displayLabel ?? placeholder ?? defaultPlaceholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="max-h-72 overflow-hidden p-0">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search location..."
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoFocus
          />
        </div>

        {/* Location list */}
        <div className="max-h-56 overflow-y-auto p-1">
          {loading && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Loading locations...
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No locations found
            </p>
          )}

          {!loading &&
            filtered.map((region) => {
              const regionExpanded = isSearching || expandedRegions.has(region.id);

              return (
                <div key={region.id}>
                  {/* Region header */}
                  <button
                    type="button"
                    onClick={() => toggleRegion(region.id)}
                    aria-expanded={regionExpanded}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
                  >
                    {regionExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {region.name}
                  </button>

                  {regionExpanded &&
                    region.cities.map((city) => {
                      const cityExpanded = isSearching || expandedCities.has(city.id);
                      const isCitySelected = value?.cityId === city.id && !value?.portId;
                      const hasPorts = city.ports.length > 0;

                      return (
                        <div key={city.id}>
                          {/* City row */}
                          <div className="flex items-center">
                            {mode === 'port-optional' ? (
                              <>
                                {/* In port-optional mode, clicking the city name selects it */}
                                <button
                                  type="button"
                                  onClick={() => selectCity(city.id)}
                                  className={`flex flex-1 items-center gap-2 rounded py-1.5 pl-6 pr-2 text-sm hover:bg-accent ${
                                    isCitySelected ? 'font-medium text-primary' : ''
                                  }`}
                                >
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  {city.name}
                                  {isCitySelected && (
                                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                                  )}
                                </button>
                                {/* Expand chevron to drill into ports */}
                                {hasPorts && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCity(city.id);
                                    }}
                                    aria-expanded={cityExpanded}
                                    aria-label="Toggle ports"
                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                                  >
                                    {cityExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </>
                            ) : (
                              /* In port-required mode, clicking a city just expands it */
                              <button
                                type="button"
                                onClick={() => toggleCity(city.id)}
                                aria-expanded={hasPorts ? cityExpanded : undefined}
                                className="flex flex-1 items-center gap-2 rounded py-1.5 pl-6 pr-2 text-sm hover:bg-accent"
                              >
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                {city.name}
                                {hasPorts && (
                                  <span className="ml-auto">
                                    {cityExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Ports */}
                          {cityExpanded &&
                            city.ports.map((port) => {
                              const isPortSelected = value?.portId === port.id;

                              return (
                                <button
                                  key={port.id}
                                  type="button"
                                  onClick={() => selectPort(port.id, port.cityId)}
                                  className={`flex w-full items-center gap-2 rounded py-1.5 pl-10 pr-2 text-sm hover:bg-accent ${
                                    isPortSelected ? 'font-medium text-primary' : ''
                                  }`}
                                >
                                  {port.name}
                                  {isPortSelected && (
                                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
