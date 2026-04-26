'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarProps {
  /** ISO YYYY-MM-DD; the day rendered as "selected". Empty string = no selection. */
  value: string;
  /** Fired with ISO YYYY-MM-DD when the user picks a day. */
  onSelect: (iso: string) => void;
  /** ISO YYYY-MM-DD lower bound (inclusive). Days before this are disabled. */
  min?: string;
  /** ISO YYYY-MM-DD upper bound (inclusive). Days after this are disabled. */
  max?: string;
  /** Anchor the visible month at this ISO date if no `value` is set. Defaults to today. */
  defaultMonth?: string;
  className?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoFromYMD(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function ymdFromIso(iso: string): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function todayYMD(): { y: number; m: number; d: number } {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Mon=0 ... Sun=6 — match the column header row. */
function mondayWeekday(y: number, m: number, d: number): number {
  const js = new Date(y, m, d).getDay(); // Sun=0..Sat=6
  return (js + 6) % 7;
}

/**
 * Minimal click-to-select month-grid calendar. Avoids the
 * react-day-picker + date-fns combo (~100 KB) that would otherwise land
 * on every DateInput callsite. Handles the things this app actually
 * needs: month navigation, today marker, selected-day highlight,
 * min/max clamping. No keyboard arrow-key navigation — the parent
 * `DateInput` keeps the dd/mm/yyyy text input as the keyboard path.
 */
export function Calendar({ value, onSelect, min, max, defaultMonth, className }: CalendarProps) {
  const valueYMD = ymdFromIso(value);
  const fallback = ymdFromIso(defaultMonth ?? '') ?? todayYMD();
  const [view, setView] = React.useState(() => ({
    y: valueYMD?.y ?? fallback.y,
    m: valueYMD?.m ?? fallback.m,
  }));

  // Keep the visible month in sync if the parent jumps the selection
  // far away (e.g. the user pasted a date into the text input).
  React.useEffect(() => {
    if (valueYMD && (valueYMD.y !== view.y || valueYMD.m !== view.m)) {
      setView({ y: valueYMD.y, m: valueYMD.m });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const minYMD = min ? ymdFromIso(min) : null;
  const maxYMD = max ? ymdFromIso(max) : null;
  const today = todayYMD();

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const gridStart = mondayWeekday(view.y, view.m, 1);
  const total = daysInMonth(view.y, view.m);
  const cells: Array<{ d: number | null; iso: string | null }> = [];
  for (let i = 0; i < gridStart; i++) cells.push({ d: null, iso: null });
  for (let d = 1; d <= total; d++) {
    cells.push({ d, iso: isoFromYMD(view.y, view.m, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ d: null, iso: null });

  function dayDisabled(iso: string): boolean {
    if (minYMD && iso < `${minYMD.y}-${pad(minYMD.m + 1)}-${pad(minYMD.d)}`) return true;
    if (maxYMD && iso > `${maxYMD.y}-${pad(maxYMD.m + 1)}-${pad(maxYMD.d)}`) return true;
    return false;
  }

  function step(delta: -1 | 1) {
    setView((prev) => {
      const next = new Date(prev.y, prev.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  return (
    <div
      className={cn('w-72 select-none p-3 text-sm', className)}
      role="application"
      aria-label={`Calendar, currently showing ${monthLabel}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell, i) => {
          if (cell.d === null || cell.iso === null) {
            return <div key={i} aria-hidden />;
          }
          const isSelected = cell.iso === value;
          const isToday = cell.d === today.d && view.m === today.m && view.y === today.y;
          const disabled = dayDisabled(cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(cell.iso!)}
              className={cn(
                'h-8 w-full rounded-md text-center text-sm transition-colors',
                'hover:bg-accent hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                !isSelected && isToday && 'border border-primary text-primary',
              )}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
            >
              {cell.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
