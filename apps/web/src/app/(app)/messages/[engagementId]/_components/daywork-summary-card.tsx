import { MapPin, Calendar, Briefcase, Anchor, Utensils, Banknote } from 'lucide-react';
import type { EngagementContext } from './types';
import { currencySymbol } from '@/lib/units';

export function DayworkSummaryCard({ context }: { context: EngagementContext }) {
  const dw = context.dayworks;
  if (!dw) return null;

  const symbol = currencySymbol(dw.currency);
  const location = [dw.ports?.name, dw.ports?.cities?.name].filter(Boolean).join(', ');

  return (
    <div className="mb-4 rounded-xl border border-border bg-accent/50 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Daywork details
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        {dw.yacht_roles?.name && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">{dw.yacht_roles.name}</span>
          </div>
        )}
        {dw.vessels?.name && (
          <div className="flex items-center gap-2">
            <Anchor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{dw.vessels.name}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            {context.start_date} — {context.end_date} ({dw.working_days} day
            {dw.working_days !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Banknote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>
            {symbol}
            {dw.day_rate}/day
          </span>
        </div>
        {dw.meals && dw.meals.length > 0 && (
          <div className="flex items-center gap-2">
            <Utensils className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="capitalize">{dw.meals.join(', ')}</span>
          </div>
        )}
        {dw.notes && <p className="mt-1 text-xs text-muted-foreground">{dw.notes}</p>}
      </div>
    </div>
  );
}
