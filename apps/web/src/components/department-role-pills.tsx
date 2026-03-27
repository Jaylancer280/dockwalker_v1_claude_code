'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { EpauletteBadge } from '@/components/epaulette-badge';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface DepartmentGroup {
  department: string;
  roles: RoleItem[];
}

export interface DepartmentRolePillsProps {
  roles: RoleItem[];
  value: string;
  onValueChange: (roleId: string) => void;
}

export function DepartmentRolePills({ roles, value, onValueChange }: DepartmentRolePillsProps) {
  const [search, setSearch] = useState('');

  // Find the department of the currently selected role
  const selectedRole = roles.find((r) => r.id === value);
  const selectedDepts = useMemo(() => {
    if (!selectedRole) return new Set<string>();
    const dept = selectedRole.department || 'Other';
    if (dept.includes('_')) {
      return new Set(dept.split('_'));
    }
    return new Set([dept]);
  }, [selectedRole]);

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(selectedDepts);

  // Group roles by department, hybrid roles appear under both parents
  const departments = useMemo(() => {
    const deptMap = new Map<string, RoleItem[]>();
    for (const role of roles) {
      const dept = role.department || 'Other';
      if (dept.includes('_')) {
        const parts = dept.split('_');
        for (const part of parts) {
          const list = deptMap.get(part) ?? [];
          list.push(role);
          deptMap.set(part, list);
        }
      } else {
        const list = deptMap.get(dept) ?? [];
        list.push(role);
        deptMap.set(dept, list);
      }
    }
    const groups: DepartmentGroup[] = [];
    for (const [department, deptRoles] of deptMap) {
      groups.push({ department, roles: deptRoles });
    }
    groups.sort((a, b) => a.department.localeCompare(b.department));
    return groups;
  }, [roles]);

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return departments;

    return departments
      .map((dept) => {
        const deptMatch = dept.department.toLowerCase().includes(q);
        const filteredRoles = dept.roles.filter((r) => r.name.toLowerCase().includes(q));
        if (deptMatch || filteredRoles.length > 0) {
          return { ...dept, roles: deptMatch ? dept.roles : filteredRoles };
        }
        return null;
      })
      .filter(Boolean) as DepartmentGroup[];
  }, [departments, search]);

  // Auto-expand departments that match search
  const visibleExpanded = useMemo(() => {
    if (search.trim()) {
      return new Set(filtered.map((d) => d.department));
    }
    return expandedDepts;
  }, [search, filtered, expandedDepts]);

  function toggleDept(dept: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground"
        />
      </div>

      {/* Selected role preview */}
      {selectedRole && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <EpauletteBadge roleName={selectedRole.name} size="sm" />
          <span>{selectedRole.name}</span>
        </div>
      )}

      {/* Departments */}
      <div className="flex flex-col gap-1">
        {filtered.map((dept) => {
          const isExpanded = visibleExpanded.has(dept.department);
          return (
            <div key={dept.department}>
              <button
                type="button"
                onClick={() => toggleDept(dept.department)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-[var(--accent-lo)]"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {dept.department}
                <span className="text-[10px] font-normal">({dept.roles.length})</span>
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                  {dept.roles.map((role) => {
                    const isActive = value === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${
                          isActive
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-lo)]'
                        }`}
                        onClick={() => onValueChange(role.id)}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
