import { MapPin, Calendar, Briefcase, Anchor, Utensils, Banknote } from 'lucide-react';
import type { EngagementContext } from './types';
import { currencySymbol } from '@dockwalker/shared';

export function DayworkSummaryCard({ context }: { context: EngagementContext }) {
  const dw = context.dayworks;
  if (!dw) return null;

  const symbol = currencySymbol(dw.currency);
  const location = [dw.ports?.name, dw.ports?.cities?.name].filter(Boolean).join(', ');

  return (
    <div className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
          Daywork details
        </span>
        <span className="font-mono text-[11px] text-[var(--tertiary)]">
          DW-{String(dw.job_number).padStart(5, '0')}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        {dw.yacht_roles?.name && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <span className="font-medium">{dw.yacht_roles.name}</span>
          </div>
        )}
        {dw.vessels?.name && (
          <div className="flex items-center gap-2">
            <Anchor className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <span>
              {dw.vessels.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} {dw.vessels.name}
              {dw.vessels.vessel_size_bands?.label && ` · ${dw.vessels.vessel_size_bands.label}`}
              {dw.vessels.loa_meters && ` · ${dw.vessels.loa_meters}m`}
              {dw.vessels.imo_number && ` · IMO ${dw.vessels.imo_number}`}
            </span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <span>{location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
          <span>
            {context.start_date} — {context.end_date} ({dw.working_days} day
            {dw.working_days !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
          <span>
            <span className="font-mono text-[17px] font-bold tracking-[-0.5px]">
              {symbol}
              {dw.day_rate}
            </span>
            <span className="text-[11px] font-medium text-[var(--muted-foreground)] opacity-60">
              /day
            </span>
          </span>
        </div>
        {dw.meals && dw.meals.length > 0 && (
          <div className="flex items-center gap-2">
            <Utensils className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            <span className="capitalize">{dw.meals.join(', ')}</span>
          </div>
        )}
        {dw.notes && <p className="mt-1 text-xs text-muted-foreground">{dw.notes}</p>}
      </div>
    </div>
  );
}
