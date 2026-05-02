'use client';

import { useMemo } from 'react';

interface WorkingDayCalendarProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  selectedDates: string[]; // YYYY-MM-DD[]
  onChange: (dates: string[]) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Generate all dates (YYYY-MM-DD) between start and end inclusive. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Get ISO day of week: 0=Mon ... 6=Sun */
function isoDow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // shift to 0=Mon
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate().toString();
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function WorkingDayCalendar({
  startDate,
  endDate,
  selectedDates,
  onChange,
}: WorkingDayCalendarProps) {
  const allDates = useMemo(() => dateRange(startDate, endDate), [startDate, endDate]);
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const selectableDates = useMemo(
    () => allDates.filter((d) => d >= todayISO),
    [allDates, todayISO],
  );

  // Group dates by month for display
  const months = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of allDates) {
      const key = d.slice(0, 7); // YYYY-MM
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [allDates]);

  function toggle(date: string) {
    if (selectedSet.has(date)) {
      // Don't allow deselecting the last day
      if (selectedDates.length <= 1) return;
      onChange(selectedDates.filter((d) => d !== date));
    } else {
      onChange([...selectedDates, date].sort());
    }
  }

  function selectAll() {
    onChange([...selectableDates]);
  }

  function selectWeekdaysOnly() {
    onChange(selectableDates.filter((d) => isoDow(d) < 5));
  }

  const selectedCount = selectedDates.length;
  const totalCount = selectableDates.length;

  return (
    <div className="flex flex-col gap-3">
      {months.map(([monthKey, dates]) => {
        const firstDow = isoDow(dates[0]); // offset for first day of the range in this month

        return (
          <div key={monthKey}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatMonthYear(dates[0])}
            </p>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}

              {/* Empty cells before the first date */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}

              {/* Date cells */}
              {dates.map((date) => {
                const isSelected = selectedSet.has(date);
                const isPast = date < todayISO;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => toggle(date)}
                    disabled={isPast}
                    aria-disabled={isPast}
                    title={isPast ? 'Past date — not selectable' : undefined}
                    className={`flex h-9 w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      isPast
                        ? 'bg-[var(--card)] text-[var(--muted-foreground)] opacity-40 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--card)] text-[var(--muted-foreground)] border border-dashed border-[var(--border)] line-through'
                    }`}
                  >
                    {formatDay(date)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Quick actions + counter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-lo)]"
          >
            Select all
          </button>
          {totalCount > 5 && (
            <button
              type="button"
              onClick={selectWeekdaysOnly}
              className="rounded-md px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-lo)]"
            >
              Weekdays only
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedCount} of {totalCount} days selected
        </p>
      </div>
    </div>
  );
}
