'use client';

export interface TabOption {
  value: string;
  label: string;
  count?: number;
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
          className={`min-w-fit flex-1 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {opt.label}
          {opt.count != null && opt.count > 0 ? (
            <>
              {' '}
              (<span className="font-mono">{opt.count}</span>)
            </>
          ) : (
            ''
          )}
        </button>
      ))}
    </div>
  );
}
