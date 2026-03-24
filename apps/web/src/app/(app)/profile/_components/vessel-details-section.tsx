'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface VesselDetailsSectionProps {
  vesselType: 'motor' | 'sail';
  setVesselType: (v: 'motor' | 'sail') => void;
  vesselName: string;
  setVesselName: (v: string) => void;
  loaMeters: string;
  setLoaMeters: (v: string) => void;
}

export function VesselDetailsSection({
  vesselType,
  setVesselType,
  vesselName,
  setVesselName,
  loaMeters,
  setLoaMeters,
}: VesselDetailsSectionProps) {
  const vesselPrefix = vesselType === 'sail' ? 'S/Y' : 'M/Y';

  return (
    <>
      {/* Vessel type (motor/sail) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Vessel type</Label>
          <Select value={vesselType} onValueChange={(v) => setVesselType(v as 'motor' | 'sail')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="motor">Motor (M/Y)</SelectItem>
              <SelectItem value="sail">Sail (S/Y)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vessel name with M/Y or S/Y prefix */}
      <div className="flex flex-col gap-1.5">
        <Label>Vessel name</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {vesselPrefix}
          </span>
          <Input
            placeholder="Vessel Name"
            value={vesselName}
            onChange={(e) => setVesselName(e.target.value)}
            className="rounded-l-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>LOA (meters)</Label>
        <Input
          type="number"
          placeholder="45"
          value={loaMeters}
          onChange={(e) => setLoaMeters(e.target.value)}
          min={1}
        />
      </div>
    </>
  );
}
