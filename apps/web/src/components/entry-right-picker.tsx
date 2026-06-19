'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useLookups, type EntryRightLookup } from '@/hooks/use-lookups';

export interface EntryRightPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Optional override for the canonical list. When omitted the picker reads
   * from `useLookups()`. Used by onboarding which loads lookups outside the
   * LookupsProvider.
   */
  entryRights?: EntryRightLookup[];
}

const CATEGORY_ORDER: Array<{ key: EntryRightLookup['category']; label: string }> = [
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'residence', label: 'Residence' },
  { key: 'visa', label: 'Visa' },
];

/** Case + punctuation insensitive comparison (matches CertificationPicker). */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.()\-–—/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Multi-select picker for the 24-entry canonical entry-rights list. Groups by
 * category (Citizenship / Residence / Visa), with a fuzzy-search input that
 * flattens results across categories once 2+ characters are typed.
 *
 * Entries are self-declared — DockWalker does not verify immigration documents.
 */
export function EntryRightPicker({
  selectedIds,
  onChange,
  entryRights: override,
}: EntryRightPickerProps) {
  const lookups = useLookups();
  const entryRights = override ?? lookups.entryRights;
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const byCategory = useMemo(() => {
    const map = new Map<string, EntryRightLookup[]>();
    for (const e of entryRights) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        list.slice().sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    return map;
  }, [entryRights]);

  const selectedEntries = useMemo(() => {
    const byId = new Map(entryRights.map((e) => [e.id, e]));
    return selectedIds.map((id) => byId.get(id)).filter((e): e is EntryRightLookup => Boolean(e));
  }, [selectedIds, entryRights]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;
    const needle = normalise(trimmed);
    return entryRights
      .filter((e) => normalise(e.name).includes(needle))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query, entryRights]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Select all that apply — more entries means you can enter more hubs.
      </p>

      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntries.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              aria-label={`Remove ${e.name}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white"
            >
              <span>{e.name}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search entry rights..."
        className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        aria-label="Search entry rights"
      />

      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No match — try a different search.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {searchResults.map((e) => (
              <EntryRightPill
                key={e.id}
                entry={e}
                active={selectedSet.has(e.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {CATEGORY_ORDER.map(({ key, label }) => {
            const items = byCategory.get(key) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((e) => (
                    <EntryRightPill
                      key={e.id}
                      entry={e}
                      active={selectedSet.has(e.id)}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="pt-1 text-[10px] leading-tight text-muted-foreground">
        Self-declared. DockWalker does not verify immigration documents.
      </p>
    </div>
  );
}

function EntryRightPill({
  entry,
  active,
  onToggle,
}: {
  entry: EntryRightLookup;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(entry.id)}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent-lo)]'
      }`}
    >
      {entry.name}
    </button>
  );
}
