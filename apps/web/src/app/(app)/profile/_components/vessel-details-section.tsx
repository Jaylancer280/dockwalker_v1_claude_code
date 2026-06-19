'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { metersToFeet, convertSizeBandLabel } from '@dockwalker/shared';

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

export interface VesselDetailsSectionProps {
  vesselType: 'motor' | 'sail';
  setVesselType: (v: 'motor' | 'sail') => void;
  vesselName: string;
  setVesselName: (v: string) => void;
  loaMeters: string;
  setLoaMeters: (v: string) => void;
  lengthUnit?: 'm' | 'ft';
  sizeBands?: SizeBand[];
}

export function VesselDetailsSection({
  vesselType,
  setVesselType,
  vesselName,
  setVesselName,
  loaMeters,
  setLoaMeters,
  lengthUnit = 'm',
  sizeBands,
}: VesselDetailsSectionProps) {
  const vesselPrefix = vesselType === 'sail' ? 'S/Y' : 'M/Y';

  // Derive LOA in meters for size band matching
  const loaNum = Number(loaMeters);
  const loaInMeters = useMemo(() => {
    if (!loaMeters || !Number.isFinite(loaNum) || loaNum <= 0) return null;
    return lengthUnit === 'ft' ? loaNum / 3.28084 : loaNum;
  }, [loaMeters, loaNum, lengthUnit]);

  const matchedBand = useMemo(() => {
    if (!loaInMeters || !sizeBands) return null;
    return (
      sizeBands.find(
        (b) => loaInMeters >= b.min_meters && (b.max_meters === null || loaInMeters < b.max_meters),
      ) ?? null
    );
  }, [loaInMeters, sizeBands]);

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
        <Label>LOA ({lengthUnit === 'ft' ? 'feet' : 'metres'})</Label>
        <Input
          type="text"
          inputMode="decimal"
          placeholder={lengthUnit === 'ft' ? 'e.g. 131' : 'e.g. 40'}
          value={loaMeters}
          onChange={(e) => setLoaMeters(e.target.value)}
        />
        {matchedBand && (
          <p className="text-xs text-muted-foreground">
            Size band: {convertSizeBandLabel(matchedBand.label, lengthUnit)}
          </p>
        )}
        {loaMeters && !matchedBand && loaInMeters != null && sizeBands && sizeBands.length > 0 && (
          <p className="text-xs text-destructive">
            Minimum vessel size is{' '}
            {lengthUnit === 'ft'
              ? `${Math.round(metersToFeet(sizeBands[0].min_meters))}ft`
              : `${sizeBands[0].min_meters}m`}
          </p>
        )}
      </div>
    </>
  );
}
