'use client';

import { Briefcase, Pencil, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExpandableText } from '@/components/expandable-text';

export interface ShoreExperienceEntry {
  id: string;
  category_id: string;
  employer_name: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  shore_experience_categories: { id: string; name: string } | null;
}

interface Props {
  experiences: ShoreExperienceEntry[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  deletingId: string | null;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleDelete: (id: string) => Promise<void>;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export function ProfileShoreExperienceSection({
  experiences,
  expandedSections,
  toggleSection,
  expandedId,
  setExpandedId,
  deletingId,
  confirmDeleteId,
  setConfirmDeleteId,
  handleDelete,
  onAdd,
  onEdit,
}: Props) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => toggleSection('shore_experience')}
          className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
              Shore-Based Experience
            </p>
            {!expandedSections.shore_experience && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {experiences.length > 0
                  ? `${experiences.length} ${experiences.length === 1 ? 'entry' : 'entries'}`
                  : 'No shore experience added'}
              </p>
            )}
          </div>
          {expandedSections.shore_experience ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {experiences.length === 0 && (
          <Button variant="outline" className="mx-4 gap-2" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add shore-based experience
          </Button>
        )}
        {expandedSections.shore_experience && experiences.length > 0 && (
          <>
            <div className="flex items-center justify-between px-4">
              <Badge variant="secondary" className="text-[10px]">
                {experiences.length} {experiences.length === 1 ? 'entry' : 'entries'}
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onAdd}>
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {experiences.map((exp, idx) => {
              const isExpanded = expandedId === exp.id || idx === 0;
              const dateRange = formatDateRange(exp.start_date, exp.end_date, exp.is_current);
              const categoryName = exp.shore_experience_categories?.name ?? 'Uncategorized';

              return (
                <div
                  key={exp.id}
                  className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded && idx !== 0 ? null : exp.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--success-lo)] text-[var(--success)]">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{exp.employer_name}</p>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {categoryName}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {exp.job_title} · {dateRange}
                      </p>
                    </div>
                    {idx !== 0 &&
                      (isExpanded ? (
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ))}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-3 pb-3 pt-2">
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Category</p>
                          <p className="text-sm">{categoryName}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Period</p>
                          <p className="text-sm">{dateRange}</p>
                        </div>
                      </div>
                      {exp.description && (
                        <ExpandableText
                          text={exp.description}
                          maxLines={2}
                          className="mt-2 text-sm text-muted-foreground"
                        />
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(exp.id);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          disabled={deletingId === exp.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(exp.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingId === exp.id ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete shore experience</DialogTitle>
            <DialogDescription>
              This will permanently remove this experience entry from your profile. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!deletingId}
              onClick={async () => {
                if (confirmDeleteId) {
                  await handleDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDateRange(start: string, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };
  if (isCurrent) return `${fmt(start)} — Present`;
  if (!end) return fmt(start);
  return `${fmt(start)} — ${fmt(end)}`;
}
