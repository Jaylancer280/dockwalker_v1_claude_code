'use client';

import { MapPin, Briefcase, Ship, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { currencySymbol } from '@/lib/units';
import type { EngagementContext } from './types';

interface PermanentSummaryCardProps {
  context: EngagementContext;
}

function formatSalary(min: number, max: number, currency: string, period: string) {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/year' : '/month';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}

function formatStartDate(dateStr: string) {
  const d = new Date(dateStr);
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PermanentSummaryCard({ context }: PermanentSummaryCardProps) {
  const pp = context.permanent_postings;
  if (!pp) return null;

  const vessel = pp.vessels;
  const vesselPrefix =
    vessel?.vessel_type === 'sail' ? 'S/Y' : vessel?.vessel_type === 'motor' ? 'M/Y' : '';
  const vesselDisplay = vessel ? `${vesselPrefix} ${vessel.name}`.trim() : 'Unknown Vessel';

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Permanent position</span>
        <Badge variant="outline" className="font-mono text-[10px]">
          PM-{String(pp.job_number).padStart(5, '0')}
        </Badge>
      </div>

      <p className="text-sm font-semibold">{pp.yacht_roles?.name ?? 'Unknown Role'}</p>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Ship className="h-3 w-3" />
        <span>{vesselDisplay}</span>
        {vessel?.vessel_size_bands?.label && <span>({vessel.vessel_size_bands.label})</span>}
        {vessel?.loa_meters && <span>{vessel.loa_meters}m</span>}
      </div>

      {vessel?.imo_number && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">IMO {vessel.imo_number}</p>
      )}

      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{[pp.ports?.name, pp.ports?.cities?.name].filter(Boolean).join(', ')}</span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Briefcase className="h-3 w-3" />
        <span>
          {formatSalary(pp.salary_min, pp.salary_max, pp.salary_currency, pp.salary_period)}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>Start: {formatStartDate(context.start_date)}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {pp.live_aboard && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
            Live aboard
          </Badge>
        )}
      </div>

      {pp.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pp.notes}</p>}
    </div>
  );
}
