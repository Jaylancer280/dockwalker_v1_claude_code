'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface Nationality {
  id: string;
  name: string;
  flag_emoji: string | null;
}

interface SearchableNationalitySelectProps {
  /** Multi-select: selected nationality ids in order they were added.
   * Empty array means "no selection" (placeholder shown). */
  value: string[];
  onChange: (value: string[]) => void;
  nationalities: Nationality[];
  placeholder?: string;
  /** Optional cap on how many nationalities can be selected. Most users
   * have 1-2 passports; very few have 3+. UI does not enforce a limit
   * unless this is set. */
  max?: number;
}

export function SearchableNationalitySelect({
  value,
  onChange,
  nationalities,
  placeholder = 'Select nationality',
  max,
}: SearchableNationalitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return nationalities;
    const lower = search.toLowerCase();
    return nationalities.filter((n) => n.name.toLowerCase().startsWith(lower));
  }, [nationalities, search]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedRows = useMemo(
    () =>
      value.map((id) => nationalities.find((n) => n.id === id)).filter(Boolean) as Nationality[],
    [value, nationalities],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      if (max !== undefined && value.length >= max) return;
      onChange([...value, id]);
    }
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  const limitReached = max !== undefined && value.length >= max;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        {selectedRows.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5 py-1">
            {selectedRows.map((n) => (
              <span
                key={n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(n.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${n.name}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs"
              >
                {n.flag_emoji} {n.name} <span className="text-[10px] opacity-60">×</span>
              </span>
            ))}
          </span>
        )}
        <svg
          className="h-4 w-4 shrink-0 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-input bg-popover shadow-md">
          <div className="border-b border-input px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results</p>
            )}
            {filtered.map((n) => {
              const isSelected = selectedSet.has(n.id);
              const isDisabled = !isSelected && limitReached;
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={isDisabled}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? 'bg-accent font-medium' : ''
                  }`}
                  onClick={() => toggle(n.id)}
                >
                  <span className="flex-1 text-left">
                    {n.flag_emoji} {n.name}
                  </span>
                  {isSelected && <span className="text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
