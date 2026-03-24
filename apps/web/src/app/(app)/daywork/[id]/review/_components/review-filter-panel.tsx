'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export function ReviewFilterPanel({
  filterCertId,
  setFilterCertId,
  filterMinDays,
  setFilterMinDays,
  certifications,
}: {
  filterCertId: string;
  setFilterCertId: (v: string) => void;
  filterMinDays: string;
  setFilterMinDays: (v: string) => void;
  certifications: { id: string; name: string }[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Certification</label>
          <Select value={filterCertId} onValueChange={setFilterCertId}>
            <SelectTrigger>
              <SelectValue placeholder="All certs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All certs</SelectItem>
              {certifications.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Min available days</label>
          <Input
            type="number"
            min={0}
            placeholder="Any"
            value={filterMinDays}
            onChange={(e) => setFilterMinDays(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
