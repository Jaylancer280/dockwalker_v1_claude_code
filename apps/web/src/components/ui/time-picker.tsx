'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  /** HH:mm string (24-hour). Empty string → defaults to "00:00" visually. */
  value: string;
  /** Fires with HH:mm. */
  onChange: (value: string) => void;
  /** Minute step. Default 15 — quarter-hour-aligned arrivals are the common case. */
  minuteStep?: 1 | 5 | 10 | 15 | 30;
  className?: string;
  disabled?: boolean;
}

const ROW_PX = 36;
/** Number of phantom rows above the first real value so the FIRST row
 *  can sit centered when the column scrolls to its top. Equals the
 *  number of rows visible above the centerline (1 in our 3-row UI). */
const SCROLL_PAD_ROWS = 1;

function clampHour(h: number): number {
  if (!Number.isFinite(h) || h < 0) return 0;
  if (h > 23) return 23;
  return Math.floor(h);
}

function clampMinute(m: number, step: number): number {
  if (!Number.isFinite(m) || m < 0) return 0;
  const clamped = Math.min(Math.max(0, Math.floor(m)), 59);
  return Math.round(clamped / step) * step;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseValue(value: string): { h: number; m: number } {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: 0, m: 0 };
  return { h: clampHour(Number(m[1])), m: clampMinute(Number(m[2]), 1) };
}

/**
 * iOS-style scroll-wheel time picker. Two side-by-side columns
 * (hours 0-23, minutes by `minuteStep`). CSS scroll-snap holds each
 * row in the centerline; a scroll listener reads which row sits at
 * the center and calls `onChange`. Output is always HH:mm so existing
 * form / event payloads don't change.
 *
 * Avoids `react-mobile-picker` (~12 KB minified) — a CSS-snap impl is
 * ~120 lines and good enough for the one callsite that uses this
 * (`checklist-form-overlay.tsx`).
 */
export function TimePicker({
  value,
  onChange,
  minuteStep = 15,
  className,
  disabled,
}: TimePickerProps) {
  const initial = React.useMemo(
    () => ({
      h: parseValue(value).h,
      m: clampMinute(parseValue(value).m, minuteStep),
    }),
    [value, minuteStep],
  );

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = React.useMemo(
    () => Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  const [hoursEl, setHoursEl] = React.useState<HTMLDivElement | null>(null);
  const [minutesEl, setMinutesEl] = React.useState<HTMLDivElement | null>(null);

  // Sync the columns whenever value changes from the outside (or on
  // mount, since `el` becomes non-null right after the first render).
  React.useEffect(() => {
    const parsed = parseValue(value);
    const h = parsed.h;
    const m = clampMinute(parsed.m, minuteStep);
    if (hoursEl) hoursEl.scrollTo({ top: h * ROW_PX, behavior: 'auto' });
    const minuteIdx = minutes.indexOf(m);
    if (minutesEl) {
      minutesEl.scrollTo({
        top: (minuteIdx >= 0 ? minuteIdx : 0) * ROW_PX,
        behavior: 'auto',
      });
    }
  }, [value, minuteStep, minutes, hoursEl, minutesEl]);

  // Lazy debounced onChange — wait for scroll to settle before reading
  // the centered row, otherwise the first frame of momentum scrolling
  // fires before the snap completes.
  const settleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = React.useCallback(
    (next: { h: number; m: number }) => {
      if (settleRef.current) clearTimeout(settleRef.current);
      settleRef.current = setTimeout(() => {
        const out = `${pad2(next.h)}:${pad2(next.m)}`;
        if (out !== value) onChange(out);
      }, 100);
    },
    [onChange, value],
  );

  function handleScroll(kind: 'h' | 'm', el: HTMLDivElement | null) {
    if (!el) return;
    const idx = Math.round(el.scrollTop / ROW_PX);
    if (kind === 'h') {
      const h = Math.max(0, Math.min(23, idx));
      const current = parseValue(value);
      settle({ h, m: clampMinute(current.m, minuteStep) });
    } else {
      const m = minutes[Math.max(0, Math.min(minutes.length - 1, idx))];
      settle({ h: parseValue(value).h, m });
    }
  }

  React.useEffect(() => {
    return () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative flex w-fit overflow-hidden rounded-lg border border-input bg-card',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      role="group"
      aria-label="Time picker"
    >
      {/* Centerline highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-primary/30 bg-primary/5"
        style={{ height: ROW_PX }}
      />

      <ScrollColumn
        onMount={setHoursEl}
        rows={hours.map((h) => pad2(h))}
        initialIndex={initial.h}
        ariaLabel="Hours"
        onScroll={(el) => handleScroll('h', el)}
      />
      <div
        className="z-10 flex items-center px-1 text-base font-medium"
        style={{ height: ROW_PX * 3 }}
      >
        :
      </div>
      <ScrollColumn
        onMount={setMinutesEl}
        rows={minutes.map((m) => pad2(m))}
        initialIndex={Math.max(0, minutes.indexOf(initial.m))}
        ariaLabel="Minutes"
        onScroll={(el) => handleScroll('m', el)}
      />
    </div>
  );
}

function ScrollColumn({
  onMount,
  rows,
  initialIndex,
  ariaLabel,
  onScroll,
}: {
  /** Hand the scroll element back to the parent so it can scroll
   *  programmatically when the value prop changes. Called once on
   *  mount with the DOM node, and again with `null` on unmount. */
  onMount: (el: HTMLDivElement | null) => void;
  rows: string[];
  initialIndex: number;
  ariaLabel: string;
  onScroll: (el: HTMLDivElement) => void;
}) {
  // Snap initial scroll position the first frame the element exists,
  // then notify the parent so it can drive subsequent scroll resets.
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) node.scrollTop = initialIndex * ROW_PX;
      onMount(node);
    },
    [initialIndex, onMount],
  );

  return (
    <div
      ref={setRef}
      onScroll={(e) => onScroll(e.currentTarget)}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        'relative w-12 overflow-y-scroll text-center text-base font-medium',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'snap-y snap-mandatory',
      )}
      style={{ height: ROW_PX * 3, scrollPaddingBlock: ROW_PX * SCROLL_PAD_ROWS }}
    >
      {/* Top spacer keeps the first real row centerable. */}
      <div aria-hidden style={{ height: ROW_PX }} />
      {rows.map((row, idx) => (
        <div
          key={row}
          className="flex snap-center items-center justify-center"
          style={{ height: ROW_PX }}
          aria-selected={idx === initialIndex || undefined}
        >
          {row}
        </div>
      ))}
      {/* Bottom spacer for the last row. */}
      <div aria-hidden style={{ height: ROW_PX }} />
    </div>
  );
}
