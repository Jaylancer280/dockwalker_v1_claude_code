'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  groupCertsByCategoryAndSubcategory,
  certCategoryLabel,
  certSubcategoryLabel,
  type CertInput,
} from '@dockwalker/shared';
import { useLookups } from '@/hooks/use-lookups';

export interface CertificationPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Governs only the empty-state copy. The data/behaviour is the same either way.
   * `profile` — crew selecting their own certs.
   * `required` — employer selecting required certs on a posting.
   */
  mode?: 'profile' | 'required';
  /**
   * Optional override for the certification list. When omitted, the picker reads
   * from `useLookups()`. Callers outside the (app) route group (e.g. onboarding)
   * can pass their own certs loaded via their own query.
   */
  certs?: {
    id: string;
    name: string;
    category: string | null;
    subcategory: string | null;
    sort_order: number;
  }[];
}

/** Case + punctuation insensitive comparison. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.()\-–—/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function CertificationPicker({
  selectedIds,
  onChange,
  mode = 'profile',
  certs: certsOverride,
}: CertificationPickerProps) {
  const lookups = useLookups();
  const certifications = certsOverride ?? lookups.certifications;
  const [query, setQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string>('basic');
  const [expandedSubcategory, setExpandedSubcategory] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const certInputs = useMemo<CertInput[]>(
    () =>
      certifications.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        subcategory: c.subcategory,
        sort_order: c.sort_order,
      })),
    [certifications],
  );

  const groups = useMemo(() => groupCertsByCategoryAndSubcategory(certInputs), [certInputs]);

  const selectedCerts = useMemo(() => {
    const byId = new Map(certifications.map((c) => [c.id, c.name]));
    return selectedIds
      .map((id) => ({ id, label: byId.get(id) ?? 'Unknown certification' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedIds, certifications]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;
    const needle = normalise(trimmed);
    return certInputs
      .filter((c) => normalise(c.name).includes(needle))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query, certInputs]);

  function toggleItem(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleCategory(cat: string) {
    if (expandedCategory === cat) {
      setExpandedCategory('');
      setExpandedSubcategory(null);
    } else {
      setExpandedCategory(cat);
      setExpandedSubcategory(null);
    }
  }

  function toggleSubcategory(sub: string) {
    setExpandedSubcategory((prev) => (prev === sub ? null : sub));
  }

  const emptyCopy =
    mode === 'required'
      ? 'Search or browse to add required certifications'
      : 'Search or browse to add your certifications';

  return (
    <div className="flex flex-col gap-2">
      {/* Selected pills */}
      {selectedCerts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCerts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleItem(c.id)}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white"
              aria-label={`Remove ${c.label}`}
            >
              <span>{c.label}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search certifications..."
        className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        aria-label="Search certifications"
      />

      {searchResults !== null ? (
        <SearchResultsList
          results={searchResults}
          selectedSet={selectedSet}
          onToggle={toggleItem}
        />
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((group) => {
            const isOpen = expandedCategory === group.category;
            const selectedCount = countSelected(group, selectedSet);
            return (
              <div key={group.category} className="rounded-md border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggleCategory(group.category)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span className="font-medium">
                    {certCategoryLabel(group.category)}
                    {selectedCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">({selectedCount})</span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    {isOpen ? '▾' : '▸'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-3 py-2">
                    {group.subcategories.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {group.subcategories.map((sub) => {
                          const subOpen = expandedSubcategory === sub.subcategory;
                          const subSelected = sub.items.filter((i) => selectedSet.has(i.id)).length;
                          return (
                            <div key={sub.subcategory}>
                              <button
                                type="button"
                                onClick={() => toggleSubcategory(sub.subcategory)}
                                aria-expanded={subOpen}
                                className="flex w-full items-center justify-between py-1 text-left text-xs"
                              >
                                <span>
                                  {certSubcategoryLabel(sub.subcategory)}
                                  {subSelected > 0 && (
                                    <span className="ml-2 text-muted-foreground">
                                      ({subSelected})
                                    </span>
                                  )}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground">
                                  {subOpen ? '▾' : '▸'}
                                </span>
                              </button>
                              {subOpen && (
                                <PillGrid
                                  items={sub.items}
                                  selectedSet={selectedSet}
                                  onToggle={toggleItem}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <PillGrid
                        items={group.items}
                        selectedSet={selectedSet}
                        onToggle={toggleItem}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {certifications.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground">{emptyCopy}</p>
          )}
        </div>
      )}
    </div>
  );
}

function countSelected(
  group: ReturnType<typeof groupCertsByCategoryAndSubcategory>[number],
  selectedSet: Set<string>,
): number {
  if (group.subcategories.length > 0) {
    return group.subcategories.reduce(
      (n, s) => n + s.items.filter((i) => selectedSet.has(i.id)).length,
      0,
    );
  }
  return group.items.filter((i) => selectedSet.has(i.id)).length;
}

function PillGrid({
  items,
  selectedSet,
  onToggle,
}: {
  items: { id: string; label: string }[];
  selectedSet: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((item) => {
        const active = selectedSet.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              active
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent-lo)]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchResultsList({
  results,
  selectedSet,
  onToggle,
}: {
  results: CertInput[];
  selectedSet: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (results.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        No matching certifications — try a different search.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {results.map((item) => {
        const active = selectedSet.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              active
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent-lo)]'
            }`}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}
