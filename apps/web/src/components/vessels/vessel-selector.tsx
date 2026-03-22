'use client';

import { useState, useEffect } from 'react';
import { Ship, Plus, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { safeFetch } from '@/lib/safe-fetch';

interface VesselOption {
  id: string;
  name: string;
  imo_number: string;
  nda_flag: boolean;
}

interface VesselSelectorProps {
  value: string;
  onValueChange: (vesselId: string) => void;
  onNdaChange?: (isNda: boolean) => void;
  onRequestCreate?: () => void;
}

/**
 * Reusable vessel selector for daywork posting.
 * Loads the current user's vessels and allows selection.
 * Optionally shows a "Create new" action.
 */
export function VesselSelector({
  value,
  onValueChange,
  onNdaChange,
  onRequestCreate,
}: VesselSelectorProps) {
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await safeFetch<{ vessels: VesselOption[] }>('/api/vessels');
        if (result.ok && result.data.vessels) {
          setVessels(
            result.data.vessels.map((v: VesselOption) => ({
              id: v.id,
              name: v.name,
              imo_number: v.imo_number,
              nda_flag: v.nda_flag,
            })),
          );
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
        Loading vessels...
      </div>
    );
  }

  if (vessels.length === 0) {
    return (
      <button
        type="button"
        onClick={onRequestCreate}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Add your first vessel
      </button>
    );
  }

  const selectedVessel = vessels.find((v) => v.id === value);

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={value}
        onValueChange={(id) => {
          onValueChange(id);
          const v = vessels.find((vsl) => vsl.id === id);
          onNdaChange?.(v?.nda_flag ?? false);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select vessel" />
        </SelectTrigger>
        <SelectContent>
          {vessels.map((vessel) => (
            <SelectItem key={vessel.id} value={vessel.id}>
              <span className="flex items-center gap-2">
                <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                {vessel.nda_flag ? 'NDA Vessel' : vessel.name}
                <span className="text-xs text-muted-foreground">
                  {vessel.nda_flag ? '' : `IMO ${vessel.imo_number}`}
                </span>
              </span>
            </SelectItem>
          ))}
          {onRequestCreate && (
            <button
              type="button"
              onClick={onRequestCreate}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add new vessel
            </button>
          )}
        </SelectContent>
      </Select>
      {selectedVessel?.nda_flag && (
        <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Vessel details are hidden from crew until they accept this position (daywork) or are
            selected (permanent). Crew will see vessel name, type, and size — but not IMO — until
            then.
          </span>
        </div>
      )}
    </div>
  );
}
