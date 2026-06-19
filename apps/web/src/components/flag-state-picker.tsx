'use client';

import { useState, useMemo, useRef } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface FlagStateItem {
  id: string;
  name: string;
}

export interface FlagStatePickerProps {
  flagStates: FlagStateItem[];
  value: string;
  onValueChange: (flagStateId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Searchable flag state picker.
 * Flat list with text search in a popover.
 */
export function FlagStatePicker({
  flagStates,
  value,
  onValueChange,
  placeholder = 'Select flag state',
  disabled,
}: FlagStatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return flagStates;
    return flagStates.filter((fs) => fs.name.toLowerCase().includes(q));
  }, [flagStates, search]);

  const displayLabel = useMemo(() => {
    if (!value) return null;
    const fs = flagStates.find((f) => f.id === value);
    return fs ? fs.name : null;
  }, [value, flagStates]);

  function selectFlagState(id: string) {
    onValueChange(id);
    setOpen(false);
    setSearch('');
  }

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
            {displayLabel ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="max-h-72 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flag states..."
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No flag states found
            </p>
          )}

          {filtered.map((fs) => {
            const isSelected = value === fs.id;

            return (
              <button
                key={fs.id}
                type="button"
                onClick={() => selectFlagState(fs.id)}
                className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent ${
                  isSelected ? 'font-medium text-primary' : ''
                }`}
              >
                {fs.name}
                {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
