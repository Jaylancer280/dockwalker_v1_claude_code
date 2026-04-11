'use client';

import * as React from 'react';
import { useRef, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
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
 * Uses a visible text input for typing + a hidden native date input for the
 * browser's date picker. A calendar icon button triggers the native picker.
 * Value prop and onChange use ISO YYYY-MM-DD format.
 */
export function DateInput({
  value,
  onChange,
  onBlur,
  className,
  min,
  max,
  disabled,
  required,
}: DateInputProps) {
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

  const openPicker = useCallback(() => {
    if (hiddenRef.current) {
      try {
        hiddenRef.current.showPicker();
      } catch {
        // showPicker() not supported — focus the native input as fallback
        hiddenRef.current.focus();
        hiddenRef.current.click();
      }
    }
  }, []);

  const inputClasses = cn(
    'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
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
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        className={inputClasses}
        maxLength={10}
      />
      {/* Calendar icon button — opens native date picker */}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        aria-label="Open date picker"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {/* Hidden native date input for browser picker */}
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
