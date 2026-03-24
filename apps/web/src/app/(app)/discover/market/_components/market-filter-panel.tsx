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

interface LookupItem {
  id: string;
  name: string;
}

export interface MarketFilterPanelProps {
  filterRoleId: string;
  setFilterRoleId: (v: string) => void;
  filterPortId: string;
  setFilterPortId: (v: string) => void;
  filterCertId: string;
  setFilterCertId: (v: string) => void;
  roles: LookupItem[];
  certs: LookupItem[];
}

export function MarketFilterPanel({
  filterRoleId,
  setFilterRoleId,
  filterPortId,
  setFilterPortId,
  filterCertId,
  setFilterCertId,
  roles,
  certs,
}: MarketFilterPanelProps) {
  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 pt-4">
        <Select value={filterRoleId} onValueChange={setFilterRoleId}>
          <SelectTrigger>
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
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
