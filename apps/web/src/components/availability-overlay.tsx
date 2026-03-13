'use client';

import { useState } from 'react';
import { Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationPicker } from '@/components/location-picker';
import type { LocationValue } from '@/components/location-picker';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * AvailabilityOverlay — bottom-sheet overlay for setting crew availability.
 * Shows a 14-day rolling calendar from today and a city selector.
 * Used from both the profile page and the discover page gate.
 */
export function AvailabilityOverlay({
  existingDates,
  existingCityId,
  existingPortId,
  existingNotAvailable,
  onConfirm,
  onCancel,
}: {
  existingDates?: string[];
  existingCityId?: string | null;
  existingPortId?: string | null;
  existingNotAvailable?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    new Set(existingNotAvailable ? [] : (existingDates ?? [])),
  );
  const [notAvailable, setNotAvailable] = useState(existingNotAvailable ?? false);
  const [locationValue, setLocationValue] = useState<LocationValue | null>(
    existingCityId ? { cityId: existingCityId, portId: existingPortId ?? undefined } : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build 14-day grid from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    days.push(addDays(today, i));
  }

  // Split into weeks (Mon-Sun aligned)
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  for (const day of days) {
    const dow = day.getDay();
    const mondayIdx = dow === 0 ? 6 : dow - 1;
    if (currentWeek.length > 0 && mondayIdx === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  function toggleDate(dateStr: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  }

  function selectAll() {
    const all = new Set<string>();
    for (const d of days) {
      all.add(toDateStr(d));
    }
    setSelectedDates(all);
  }

  function clearAll() {
    setSelectedDates(new Set());
  }

  // User had existing availability (dates or not-available) and has now cleared everything
  const hasExisting = (existingDates && existingDates.length > 0) || existingNotAvailable;
  const isClearingAll = hasExisting && selectedDates.size === 0 && !notAvailable;

  // City is required for setting availability. Clearing all doesn't need a city.
  const isValid =
    isClearingAll || (locationValue?.cityId && (notAvailable || selectedDates.size > 0));

  async function handleConfirm() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    // Clearing all availability — delete everything and exit
    if (isClearingAll) {
      const res = await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        onConfirm();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to clear availability');
      }
      setSubmitting(false);
      return;
    }

    if (notAvailable) {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notAvailable: true,
          cityId: locationValue?.cityId,
          portId: locationValue?.portId,
        }),
      });
      if (res.ok) {
        onConfirm();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to set availability');
      }
      setSubmitting(false);
      return;
    }

    // Group selected dates into contiguous ranges to avoid filling gaps
    // between sparse picks (e.g. Mon, Wed, Fri → three ranges, not Mon-Fri).
    const sorted = [...selectedDates].sort();
    const ranges: Array<{ start: string; end: string }> = [];
    let rangeStart = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const prevMs = new Date(prev + 'T00:00:00').getTime();
      const currMs = new Date(sorted[i] + 'T00:00:00').getTime();
      if (currMs - prevMs > 86_400_000) {
        ranges.push({ start: rangeStart, end: prev });
        rangeStart = sorted[i];
      }
      prev = sorted[i];
    }
    ranges.push({ start: rangeStart, end: prev });

    // POST each contiguous range
    let failed = false;
    let failError = '';
    for (const range of ranges) {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: range.start,
          endDate: range.end,
          cityId: locationValue?.cityId,
          portId: locationValue?.portId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        failError = data.error ?? 'Failed to set availability';
        failed = true;
        break;
      }
    }

    // Clear dates the user deselected (were previously available but no longer picked)
    if (!failed && existingDates?.length) {
      const deselected = existingDates.filter((d) => !selectedDates.has(d));
      if (deselected.length > 0) {
        await fetch('/api/availability', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dates: deselected }),
        });
      }
    }

    if (!failed) {
      onConfirm();
    } else {
      setError(failError);
    }
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      style={{ bottom: 'calc(var(--nav-height, 0px) + env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-lg animate-in slide-in-from-bottom flex-col rounded-t-2xl bg-background">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold">Set availability</h2>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto px-4 pb-2">
          {/* Location selector */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where are you available?
            </p>
            <LocationPicker
              mode="port-optional"
              value={locationValue}
              onValueChange={setLocationValue}
              placeholder="Select town (optionally port/marina)"
            />
          </section>

          {/* Not available toggle */}
          <section>
            <button
              onClick={() => {
                setNotAvailable((prev) => {
                  if (!prev) setSelectedDates(new Set());
                  return !prev;
                });
              }}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                notAvailable
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  notAvailable
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-muted-foreground/30'
                }`}
              >
                {notAvailable && (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${notAvailable ? 'text-destructive' : ''}`}>
                  I&apos;m not available
                </p>
                <p className="text-xs text-muted-foreground">
                  Confirm you are not available for any daywork right now
                </p>
              </div>
            </button>
          </section>

          {/* 14-day calendar */}
          <section className={notAvailable ? 'pointer-events-none opacity-40' : ''}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                When are you available? (next 2 weeks)
              </p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline">
                  All
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar rows */}
            {weeks.map((week, wi) => {
              // Pad start of first week to align with day-of-week
              const firstDow = week[0].getDay();
              const padStart = firstDow === 0 ? 6 : firstDow - 1;

              return (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {/* Empty padding cells */}
                  {wi === 0 &&
                    Array.from({ length: padStart }).map((_, i) => <div key={`pad-${i}`} />)}
                  {week.map((day) => {
                    const dateStr = toDateStr(day);
                    const isSelected = selectedDates.has(dateStr);
                    const isToday = dateStr === todayStr;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => toggleDate(dateStr)}
                        className={`relative flex h-10 items-center justify-center rounded-lg text-sm transition-colors
                          ${isToday ? 'ring-1 ring-primary' : ''}
                          ${isSelected ? 'bg-success text-white font-medium' : 'hover:bg-accent cursor-pointer'}
                        `}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            <p className="mt-1 text-[11px] text-muted-foreground">
              Availability expires after 7 days. You can refresh it at any time.
            </p>
          </section>
        </div>

        <div className="border-t border-border px-4 py-3">
          <Button className="w-full" disabled={!isValid || submitting} onClick={handleConfirm}>
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-1.5 h-4 w-4" />
            )}
            {isClearingAll
              ? 'Clear availability'
              : notAvailable
                ? 'Confirm not available'
                : 'Confirm availability'}
          </Button>
          {!isValid && !isClearingAll && (
            <p className="mt-1.5 text-center text-xs text-destructive">
              {!locationValue?.cityId
                ? 'Please select a location'
                : 'Please select dates or mark as not available'}
            </p>
          )}
          {error && <p className="mt-1.5 text-center text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
