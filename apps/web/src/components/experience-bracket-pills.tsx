'use client';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
}

export interface ExperienceBracketPillsProps {
  brackets: LookupItem[];
  value: string;
  onValueChange: (id: string) => void;
  optional?: boolean;
}

export function ExperienceBracketPills({
  brackets,
  value,
  onValueChange,
  optional,
}: ExperienceBracketPillsProps) {
  const items = optional ? [{ id: '', name: 'Any' }, ...brackets] : brackets;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((b) => {
        const isActive = value === b.id;
        return (
          <button
            key={b.id || '__any'}
            type="button"
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              isActive
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]'
            }`}
            onClick={() => onValueChange(b.id)}
          >
            {b.label ?? b.name}
          </button>
        );
      })}
    </div>
  );
}
