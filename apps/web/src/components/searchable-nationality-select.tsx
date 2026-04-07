'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface Nationality {
  id: string;
  name: string;
  flag_emoji: string | null;
}

interface SearchableNationalitySelectProps {
  value: string;
  onChange: (value: string) => void;
  nationalities: Nationality[];
  placeholder?: string;
}

export function SearchableNationalitySelect({
  value,
  onChange,
  nationalities,
  placeholder = 'Select nationality',
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

  const selected = nationalities.find((n) => n.id === value);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={selected ? '' : 'text-muted-foreground'}>
          {selected ? `${selected.flag_emoji ?? ''} ${selected.name}` : placeholder}
        </span>
        <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {filtered.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
                  n.id === value ? 'bg-accent font-medium' : ''
                }`}
                onClick={() => {
                  onChange(n.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                {n.flag_emoji} {n.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
