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
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
          Permanent position
        </span>
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

      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <Briefcase className="h-3 w-3 text-[var(--muted-foreground)]" />
        <span>
          <span className="font-mono text-[17px] font-bold tracking-[-0.5px]">
            {formatSalary(pp.salary_min, pp.salary_max, pp.salary_currency, pp.salary_period)}
          </span>
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>Start: {formatStartDate(context.start_date)}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {pp.contract_type && pp.contract_type !== 'permanent' && (
          <Badge variant="outline" className="capitalize text-[10px]">
            {pp.contract_type}
          </Badge>
        )}
        {pp.live_aboard && (
          <Badge variant="status-open" className="text-[10px]">
            Live aboard
          </Badge>
        )}
      </div>

      {pp.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pp.notes}</p>}
    </div>
  );
}
