'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AvailabilityWindow {
  id: string;
  date: string;
  expires_at: string;
}

interface Engagement {
  id: string;
  start_date: string;
  end_date: string;
  daywork_id: string;
  dayworks: { yacht_roles: { name: string } | null } | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

export default function AvailabilityPage() {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const availableDates = useMemo(() => new Set(windows.map((w) => w.date)), [windows]);

  const blockedDates = useMemo(() => {
    const blocked = new Map<string, string>();
    for (const eng of engagements) {
      const start = new Date(eng.start_date);
      const end = new Date(eng.end_date);
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        blocked.set(toDateStr(d), eng.dayworks?.yacht_roles?.name ?? 'Engaged');
      }
    }
    return blocked;
  }, [engagements]);

  const expiryInfo = useMemo(() => {
    if (windows.length === 0) return null;
    const earliest = windows.reduce((min, w) => (w.expires_at < min.expires_at ? w : min));
    const d = new Date(earliest.expires_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const daysLeft = Math.floor(hoursLeft / 24);
    return daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`;
  }, [windows]);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/availability');
    const data = await res.json();
    if (data.windows) setWindows(data.windows);
    if (data.engagements) setEngagements(data.engagements);
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadData();
  }, [loadData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function setRange(startDate: string, endDate: string) {
    setSaving(true);
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate }),
    });
    await loadData();
    setSaving(false);
  }

  async function toggleDay(dateStr: string) {
    if (blockedDates.has(dateStr)) return;

    if (availableDates.has(dateStr)) {
      setSaving(true);
      await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: [dateStr] }),
      });
      await loadData();
      setSaving(false);
    } else {
      await setRange(dateStr, dateStr);
    }
  }

  function handleQuickSet(label: string) {
    const today = new Date();
    if (label === 'this-week') {
      const monday = getMonday(today);
      const friday = addDays(monday, 4);
      setRange(toDateStr(monday < today ? today : monday), toDateStr(friday));
    } else if (label === 'next-week') {
      const nextMon = addDays(getMonday(today), 7);
      const nextFri = addDays(nextMon, 4);
      setRange(toDateStr(nextMon), toDateStr(nextFri));
    } else if (label === 'next-2-weeks') {
      const nextMon = addDays(getMonday(today), 7);
      const end = addDays(nextMon, 13);
      setRange(toDateStr(nextMon), toDateStr(end));
    }
  }

  // Build calendar grid
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startGrid = getMonday(firstDay);

  const weeks: Date[][] = [];
  let current = new Date(startGrid);
  while (current <= lastDay || weeks.length < 5) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    if (current > lastDay && weeks.length >= 4) break;
  }

  const today = toDateStr(new Date());

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Availability</h1>
          {expiryInfo && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {expiryInfo}
            </Badge>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {/* Quick set buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSet('this-week')}
            disabled={saving}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSet('next-week')}
            disabled={saving}
          >
            Next week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickSet('next-2-weeks')}
            disabled={saving}
          >
            Next 2 weeks
          </Button>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="flex flex-col gap-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const dateStr = toDateStr(day);
                const isCurrentMonth = day.getMonth() === month;
                const isToday = dateStr === today;
                const isAvailable = availableDates.has(dateStr);
                const blockedRole = blockedDates.get(dateStr);
                const isPast = dateStr < today;

                return (
                  <button
                    key={dateStr}
                    onClick={() => !isPast && !blockedRole && toggleDay(dateStr)}
                    disabled={saving || isPast || !!blockedRole}
                    className={`relative flex h-10 items-center justify-center rounded-lg text-sm transition-colors
                      ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                      ${isPast ? 'text-muted-foreground/30' : ''}
                      ${isToday ? 'ring-1 ring-primary' : ''}
                      ${blockedRole ? 'bg-sea/15 text-sea cursor-not-allowed' : ''}
                      ${isAvailable && !blockedRole ? 'bg-success text-white font-medium' : ''}
                      ${!isAvailable && !blockedRole && !isPast && isCurrentMonth ? 'hover:bg-accent cursor-pointer' : ''}
                    `}
                    title={
                      blockedRole
                        ? `Engaged: ${blockedRole}`
                        : isAvailable
                          ? 'Available — tap to remove'
                          : 'Tap to mark available'
                    }
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-success" />
            Available
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-sea/15" />
            Engaged
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-border" />
            Not set
          </div>
        </div>

        {/* Empty state */}
        {!loading && windows.length === 0 && engagements.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No availability set</CardTitle>
              <CardDescription>
                Tap dates on the calendar or use the quick-set buttons to mark when you&apos;re
                available for daywork. Availability expires automatically if not refreshed.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Engagements */}
        {engagements.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Upcoming engagements</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {engagements.map((eng) => (
                <div key={eng.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {eng.dayworks?.yacht_roles?.name ?? 'Daywork'}
                  </span>
                  <span className="text-muted-foreground">
                    {eng.start_date} → {eng.end_date}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
