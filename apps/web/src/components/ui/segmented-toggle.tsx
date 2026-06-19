'use client';

export function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
