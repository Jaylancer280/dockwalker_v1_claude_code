'use client';

import { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface DepartmentGroup {
  department: string;
  roles: RoleItem[];
}

export interface RolePickerProps {
  roles: RoleItem[];
  value: string;
  onValueChange: (roleId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Searchable hierarchical role picker.
 * Renders Department > Role in a popover with text search.
 */
export function RolePicker({
  roles,
  value,
  onValueChange,
  placeholder = 'Select role',
  disabled,
}: RolePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const departments = useMemo(() => {
    const deptMap = new Map<string, RoleItem[]>();
    for (const role of roles) {
      const dept = role.department || 'Other';
      // Hybrid roles (e.g. deck_engineering) appear under both parent departments
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
    return groups;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return departments;

    return departments
      .map((dept) => {
        const deptMatch = dept.department.toLowerCase().includes(q);
        const filteredRoles = dept.roles.filter((r) => r.name.toLowerCase().includes(q));

        if (deptMatch || filteredRoles.length > 0) {
          return {
            ...dept,
            roles: deptMatch ? dept.roles : filteredRoles,
          };
        }
        return null;
      })
      .filter(Boolean) as DepartmentGroup[];
  }, [departments, search]);

  const isSearching = search.trim().length > 0;

  const displayLabel = useMemo(() => {
    if (!value) return null;
    const role = roles.find((r) => r.id === value);
    return role ? role.name : null;
  }, [value, roles]);

  function toggleDept(dept: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }

  function selectRole(roleId: string) {
    onValueChange(roleId);
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
            placeholder="Search roles..."
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No roles found</p>
          )}

          {filtered.map((dept) => {
            const deptExpanded = isSearching || expandedDepts.has(dept.department);

            return (
              <div key={dept.department}>
                <button
                  type="button"
                  onClick={() => toggleDept(dept.department)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent"
                >
                  {deptExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {dept.department}
                </button>

                {deptExpanded &&
                  dept.roles.map((role) => {
                    const isSelected = value === role.id;

                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => selectRole(role.id)}
                        className={`flex w-full items-center gap-2 rounded py-1.5 pl-6 pr-2 text-sm hover:bg-accent ${
                          isSelected ? 'font-medium text-primary' : ''
                        }`}
                      >
                        {role.name}
                        {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </button>
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
