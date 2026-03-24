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
    <div className="flex border-b border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
          {opt.count != null && opt.count > 0 ? ` (${opt.count})` : ''}
        </button>
      ))}
    </div>
  );
}
