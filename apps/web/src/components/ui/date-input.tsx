'use client';

import * as React from 'react';
import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
}

/** Parse ISO date string to dd/mm/yyyy display format */
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Parse dd/mm/yyyy display format to ISO date string */
function displayToIso(display: string): string {
  const cleaned = display.replace(/[^\d/]/g, '');
  const parts = cleaned.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return '';
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  return `${y}-${month}-${day}`;
}

/** Auto-format typed input as dd/mm/yyyy */
function autoFormat(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Date input that always displays dd/mm/yyyy format.
 * Uses a visible text input for display + a hidden native date input for mobile picker.
 * Value prop and onChange use ISO YYYY-MM-DD format.
 */
export function DateInput({ value, onChange, className, min, max, disabled }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = React.useState(() => isoToDisplay(value));

  // Sync display when value prop changes externally
  React.useEffect(() => {
    setDisplayValue(isoToDisplay(value));
  }, [value]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = autoFormat(e.target.value);
      setDisplayValue(formatted);

      // Only emit onChange when we have a complete valid date
      if (formatted.length === 10) {
        const iso = displayToIso(formatted);
        if (iso && !isNaN(Date.parse(iso))) {
          onChange(iso);
        }
      }
    },
    [onChange],
  );

  const handleNativeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value;
      if (iso) {
        onChange(iso);
        setDisplayValue(isoToDisplay(iso));
      }
    },
    [onChange],
  );

  const handleTap = useCallback(() => {
    // On mobile, open the native date picker
    hiddenRef.current?.showPicker?.();
  }, []);

  const inputClasses = cn(
    'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    className,
  );

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={displayValue}
        onChange={handleTextChange}
        onClick={handleTap}
        disabled={disabled}
        className={inputClasses}
        maxLength={10}
      />
      {/* Hidden native date input for mobile picker */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleNativeChange}
        min={min}
        max={max}
        disabled={disabled}
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
