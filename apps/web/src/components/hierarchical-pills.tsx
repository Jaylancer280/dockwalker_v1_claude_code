'use client';

import { useState, useMemo } from 'react';

export interface PillGroup {
  id: string;
  label: string;
  items: { id: string; label: string }[];
}

export interface HierarchicalPillsProps {
  groups: PillGroup[];
  value: string | string[];
  onValueChange: (v: string | string[]) => void;
  mode: 'single' | 'multi';
  optional?: boolean;
  placeholder?: string;
}

const DEPT_LABELS: Record<string, string> = {
  bridge: 'Bridge',
  deck: 'Deck',
  engineering: 'Engineering',
  galley: 'Galley',
  interior: 'Interior',
  safety: 'Safety',
  medical: 'Medical',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert yacht_roles rows (id, name, department) into PillGroups. Hybrid departments split into parents. */
export function rolesToGroups(
  roles: { id: string; name: string; department?: string }[],
): PillGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const r of roles) {
    const dept = r.department || 'other';
    const parts = dept.includes('_') ? dept.split('_') : [dept];
    for (const p of parts) {
      const list = map.get(p) ?? [];
      list.push({ id: r.id, label: r.name });
      map.set(p, list);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dept, items]) => ({
      id: dept,
      label: DEPT_LABELS[dept] ?? capitalize(dept),
      items,
    }));
}

/** Convert certifications rows (id, name, category) into PillGroups grouped by category. */
export function certsToGroups(
  certs: { id: string; name: string; category?: string }[],
): PillGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const c of certs) {
    const cat = c.category || 'other';
    const list = map.get(cat) ?? [];
    list.push({ id: c.id, label: c.name });
    map.set(cat, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, items]) => ({
      id: cat,
      label: DEPT_LABELS[cat] ?? capitalize(cat),
      items,
    }));
}

export function HierarchicalPills({
  groups,
  value,
  onValueChange,
  mode,
  placeholder,
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

  function handleItemClick(itemId: string) {
    if (mode === 'single') {
      onValueChange(itemId);
      setExpandedGroup(null);
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
    <div className="flex flex-col gap-2">
      {/* Selected preview for single-select */}
      {mode === 'single' && selectedLabel && (
        <p className="text-xs text-muted-foreground">{selectedLabel}</p>
      )}

      {/* Layer 1: Group pills */}
      <div className="flex flex-wrap gap-1.5">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const count = groupCounts.get(group.id);
          return (
            <button
              key={group.id}
              type="button"
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                isExpanded
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
