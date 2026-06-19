'use client';

import { ClipboardList, Check, Pencil } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  value: string;
}

export function ChecklistCard({
  items,
  acknowledgedItemIds,
  isCrew,
  isEmployer,
  onToggle,
  onEdit,
}: {
  items: ChecklistItem[];
  acknowledgedItemIds: string[];
  isCrew: boolean;
  isEmployer: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
  onEdit: () => void;
}) {
  const acked = new Set(acknowledgedItemIds);
  const total = items.length;
  const done = items.filter((i) => acked.has(i.id)).length;

  return (
    <div className="mb-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pre-arrival checklist
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {done}/{total} confirmed
          </span>
          {isEmployer && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent)]/80"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const isChecked = acked.has(item.id);
          return (
            <div key={item.id} className="flex items-start gap-2">
              {isCrew ? (
                <button
                  onClick={() => onToggle(item.id, !isChecked)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isChecked
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-border bg-background hover:border-[var(--accent)]/50'
                  }`}
                >
                  {isChecked && <Check className="h-3 w-3" />}
                </button>
              ) : (
                <div
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isChecked
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {isChecked && <Check className="h-3 w-3" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${isChecked ? 'text-muted-foreground line-through' : ''}`}
                >
                  {item.label}
                </p>
                {item.value !== 'Yes' && (
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
