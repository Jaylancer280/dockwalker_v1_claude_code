'use client';

import type { ReactNode } from 'react';

export interface TabOption {
  value: string;
  label: string;
  count?: number;
  /** Optional inline icon rendered before the label (e.g. a lucide-react icon).
   *  Used to anchor visual meaning across the page (matching tab icon to
   *  action-button icon — see Shortlist tab + button pairing). */
  icon?: ReactNode;
}

export function UnderlineTabs({
  options,
  value,
  onChange,
}: {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto border-b border-[var(--border)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`inline-flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {opt.icon}
          <span>
            {opt.label}
            {opt.count != null && opt.count > 0 ? (
              <>
                {' '}
                (<span className="font-mono">{opt.count}</span>)
              </>
            ) : (
              ''
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
