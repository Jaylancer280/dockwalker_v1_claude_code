'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationPicker } from '@/components/location-picker';

interface RoleItem {
  id: string;
  name: string;
  department?: string;
}

interface LookupItem {
  id: string;
  name: string;
}

const DEPARTMENTS = [
  { value: 'all', label: 'All departments' },
  { value: 'deck', label: 'Deck' },
  { value: 'interior', label: 'Interior' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'galley', label: 'Galley' },
  { value: 'bridge', label: 'Bridge' },
];

export interface MarketFilterPanelProps {
  filterDepartment: string;
  setFilterDepartment: (v: string) => void;
  filterRoleId: string;
  setFilterRoleId: (v: string) => void;
  filterPortId: string;
  setFilterPortId: (v: string) => void;
  filterCertId: string;
  setFilterCertId: (v: string) => void;
  roles: RoleItem[];
  certs: LookupItem[];
}

export function MarketFilterPanel({
  filterDepartment,
  setFilterDepartment,
  filterRoleId,
  setFilterRoleId,
  filterPortId,
  setFilterPortId,
  filterCertId,
  setFilterCertId,
  roles,
  certs,
}: MarketFilterPanelProps) {
  const filteredRoles =
    filterDepartment && filterDepartment !== 'all'
      ? roles.filter((r) => r.department === filterDepartment)
      : roles;

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 pt-4">
        <Select
          value={filterDepartment}
          onValueChange={(v) => {
            setFilterDepartment(v);
            setFilterRoleId('');
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRoleId} onValueChange={setFilterRoleId}>
          <SelectTrigger>
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {filteredRoles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <LocationPicker
          mode="port-required"
          value={filterPortId ? { portId: filterPortId } : null}
          onValueChange={(v) => setFilterPortId(v.portId ?? '')}
          placeholder="All locations"
        />
        <Select value={filterCertId} onValueChange={setFilterCertId}>
          <SelectTrigger>
            <SelectValue placeholder="All certifications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All certifications</SelectItem>
            {certs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
