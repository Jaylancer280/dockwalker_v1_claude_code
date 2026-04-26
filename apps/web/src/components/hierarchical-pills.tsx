'use client';

import { useState, useMemo } from 'react';
import { type PillGroup, rolesToGroups, certsToGroups, citiesToGroups } from '@dockwalker/shared';

export { type PillGroup, rolesToGroups, certsToGroups, citiesToGroups };

export interface HierarchicalPillsProps {
  groups: PillGroup[];
  value: string | string[];
  onValueChange: (v: string | string[]) => void;
  mode: 'single' | 'multi';
  placeholder?: string;
  required?: boolean;
}

export function HierarchicalPills({
  groups,
  value,
  onValueChange,
  mode,
  placeholder,
  required,
}: HierarchicalPillsProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    // Auto-expand the group containing the current value
    if (mode === 'single' && typeof value === 'string' && value) {
      for (const g of groups) {
        if (g.items.some((item) => item.id === value)) return g.id;
      }
    }
    return null;
  });

  const selectedSet = useMemo(() => {
    if (Array.isArray(value)) return new Set(value);
    return new Set(value ? [value] : []);
  }, [value]);

  // Count selected items per group (for multi-select badge)
  const groupCounts = useMemo(() => {
    if (mode !== 'multi') return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const g of groups) {
      const count = g.items.filter((item) => selectedSet.has(item.id)).length;
      if (count > 0) counts.set(g.id, count);
    }
    return counts;
  }, [groups, selectedSet, mode]);

  function handleGroupClick(groupId: string) {
    setExpandedGroup((prev) => (prev === groupId ? null : groupId));
  }

  // Track which groups contain the selected value (for highlighting). A
  // single role can belong to multiple departments (e.g. Deck/Engineer
  // appears under both Deck and Engineering); both pills should highlight.
  const selectedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    if (mode !== 'single' || !value || typeof value !== 'string') return ids;
    for (const g of groups) {
      if (g.items.some((item) => item.id === value)) ids.add(g.id);
    }
    return ids;
  }, [groups, value, mode]);

  function handleItemClick(itemId: string) {
    if (mode === 'single') {
      onValueChange(itemId);
      // Don't collapse — keep the group expanded so the selection stays visible
    } else {
      const arr = Array.isArray(value) ? value : [];
      if (arr.includes(itemId)) {
        onValueChange(arr.filter((id) => id !== itemId));
      } else {
        onValueChange([...arr, itemId]);
      }
    }
  }

  const expandedItems = expandedGroup
    ? (groups.find((g) => g.id === expandedGroup)?.items ?? [])
    : [];

  // In single-select, show the selected item label
  const selectedLabel = useMemo(() => {
    if (mode !== 'single' || !value || typeof value !== 'string') return null;
    for (const g of groups) {
      const item = g.items.find((i) => i.id === value);
      if (item) return item.label;
    }
    return null;
  }, [groups, value, mode]);

  return (
    <div
      className="flex flex-col gap-2"
      role={mode === 'single' ? 'radiogroup' : 'group'}
      aria-required={required || undefined}
    >
      {/* Selected preview for single-select */}
      {mode === 'single' && selectedLabel && (
        <p className="text-xs text-muted-foreground">{selectedLabel}</p>
      )}

      {/* Layer 1: Group pills */}
      <div className="flex flex-wrap gap-1.5">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const count = groupCounts.get(group.id);
          const hasSelection =
            mode === 'single' ? selectedGroupIds.has(group.id) : (count ?? 0) > 0;
          return (
            <button
              key={group.id}
              type="button"
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                isExpanded || hasSelection
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
              }`}
              onClick={() => handleGroupClick(group.id)}
            >
              {group.label}
              {count ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Layer 2: Items within expanded group */}
      {expandedGroup && expandedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {expandedItems.map((item) => {
            const isActive = selectedSet.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
                }`}
                onClick={() => handleItemClick(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Placeholder when nothing selected */}
      {!expandedGroup && selectedSet.size === 0 && placeholder && (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      )}
    </div>
  );
}
