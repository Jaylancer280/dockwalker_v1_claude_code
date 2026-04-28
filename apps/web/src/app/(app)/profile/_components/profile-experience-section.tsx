'use client';

import { useState } from 'react';
import { Ship, Pencil, Trash2, Plus, ChevronUp, ChevronDown, UserPlus } from 'lucide-react';
import { EpauletteBadge } from '@/components/epaulette-badge';
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
import { computeTotalExperience } from '@dockwalker/shared';
import { ExpandableText } from '@/components/expandable-text';
import { AddReferenceDialog } from '@/components/references/add-reference-dialog';

interface ExperienceEntry {
  id: string;
  vessel_id: string;
  role_id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string;
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  /** Set when the vessel was renamed AFTER this experience ended — surfaces
   *  the name the user knew it as. Null when the current name was already
   *  in effect during the experience window. */
  historical_vessel_name: string | null;
  vessels: {
    id: string;
    imo_number: string;
    name: string;
    vessel_type: string;
    size_band_id: string;
    loa_meters: number;
    nda_flag?: boolean;
    source?: string;
    hidden_at?: string | null;
    vessel_size_bands: unknown;
  } | null;
  yacht_roles: { id: string; name: string; department: string } | null;
  references_active_count?: number;
}

interface ProfileExperienceSectionProps {
  experiences: ExperienceEntry[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  expandedExpId: string | null;
  setExpandedExpId: (id: string | null) => void;
  deletingExpId: string | null;
  confirmDeleteExpId: string | null;
  setConfirmDeleteExpId: (id: string | null) => void;
  handleDeleteExperience: (id: string) => Promise<void>;
  onAddExperience: () => void;
  onEditExperience: (id: string) => void;
  /** Caller's subscription plan — drives the per-experience reference cap. */
  subscriptionPlan?: 'free' | 'crew_pro' | 'employer_pro' | string;
  /** Triggered after an Add Reference dialog closes — caller refetches. */
  onReferencesChanged?: () => void;
}

export function ProfileExperienceSection({
  experiences,
  expandedSections,
  toggleSection,
  expandedExpId,
  setExpandedExpId,
  deletingExpId,
  confirmDeleteExpId,
  setConfirmDeleteExpId,
  handleDeleteExperience,
  onAddExperience,
  onEditExperience,
  subscriptionPlan = 'free',
  onReferencesChanged,
}: ProfileExperienceSectionProps) {
  const [addRefDialogExpId, setAddRefDialogExpId] = useState<string | null>(null);
  const refsCap = subscriptionPlan === 'crew_pro' ? 3 : 1;
  const dialogExp = experiences.find((e) => e.id === addRefDialogExpId);
  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => toggleSection('experience')}
          className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
              Experience
            </p>
            {!expandedSections.experience && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {experiences.length > 0
                  ? `${experiences.length} entries · ${computeTotalExperience(experiences)}`
                  : 'No experience added'}
              </p>
            )}
          </div>
          {expandedSections.experience ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {experiences.length === 0 && (
          <Button variant="outline" className="mx-4 gap-2" onClick={onAddExperience}>
            <Plus className="h-4 w-4" />
            Add your vessel experience
          </Button>
        )}
        {expandedSections.experience && experiences.length > 0 && (
          <>
            <div className="flex items-center justify-between px-4">
              <Badge variant="secondary" className="text-[10px]">
                {computeTotalExperience(experiences)} total
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={onAddExperience}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {experiences.map((exp, idx) => {
              const isExpanded = expandedExpId === exp.id || idx === 0;
              const dateRange = formatDateRange(exp.start_date, exp.end_date, exp.is_current);

              return (
                <div
                  key={exp.id}
                  className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]"
                >
                  <button
                    onClick={() => setExpandedExpId(isExpanded && idx !== 0 ? null : exp.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--accent-lo)] text-[var(--accent)]">
                      <Ship className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-sm font-medium truncate"
                          title={
                            exp.historical_vessel_name && exp.vessels?.name
                              ? `Now ${exp.vessels.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} ${exp.vessels.name}`
                              : undefined
                          }
                        >
                          {exp.vessels?.vessel_type === 'sail' ? 'S/Y' : 'M/Y'}{' '}
                          {exp.historical_vessel_name ?? exp.vessels?.name ?? 'Unknown vessel'}
                        </p>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {exp.vessel_operation}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {exp.yacht_roles?.name ?? 'Unknown role'} · {dateRange}
                      </p>
                    </div>
                    {exp.yacht_roles?.name && (
                      <EpauletteBadge
                        roleName={exp.yacht_roles.name}
                        department={exp.yacht_roles?.department}
                        size="md"
                      />
                    )}
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
                        {exp.flag_state && (
                          <div>
                            <p className="text-[11px] text-muted-foreground">Flag state</p>
                            <p className="text-sm">{exp.flag_state}</p>
                          </div>
                        )}
                        {exp.vessels?.loa_meters && (
                          <div>
                            <p className="text-[11px] text-muted-foreground">LOA</p>
                            <p className="text-sm">{exp.vessels.loa_meters}m</p>
                          </div>
                        )}
                        {exp.contract_type && (
                          <div>
                            <p className="text-[11px] text-muted-foreground">Contract</p>
                            <ExpandableText
                              text={`${exp.contract_type}${exp.contract_details ? ` \u2014 ${exp.contract_details}` : ''}`}
                              maxLines={2}
                              className="text-sm capitalize"
                            />
                          </div>
                        )}
                        {exp.vessels?.vessel_type && (
                          <div>
                            <p className="text-[11px] text-muted-foreground">Vessel type</p>
                            <p className="text-sm capitalize">{exp.vessels.vessel_type}</p>
                          </div>
                        )}
                      </div>
                      {exp.description && (
                        <ExpandableText
                          text={exp.description}
                          maxLines={2}
                          className="mt-2 text-sm text-muted-foreground"
                        />
                      )}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {(() => {
                          const refsActive = exp.references_active_count ?? 0;
                          const ndaBlocked = exp.vessels?.nda_flag === true;
                          const sourceBlocked =
                            exp.vessels?.source !== undefined && exp.vessels.source !== 'curated';
                          const hiddenBlocked = !!exp.vessels?.hidden_at;
                          const currentBlocked = exp.is_current;
                          const blocked =
                            ndaBlocked || sourceBlocked || hiddenBlocked || currentBlocked;
                          if (!blocked) {
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddRefDialogExpId(exp.id);
                                }}
                              >
                                <UserPlus className="h-3 w-3" />
                                Add reference ({refsActive}/{refsCap})
                              </Button>
                            );
                          }
                          // Add is blocked — but the count is still useful
                          // information when references already exist on
                          // this experience. Surface it as a passive badge
                          // with a tooltip explaining why Add is disabled.
                          const reason = currentBlocked
                            ? 'Mark this experience as completed to add references.'
                            : ndaBlocked
                              ? "References on NDA vessels aren't supported yet."
                              : hiddenBlocked
                                ? 'This vessel was hidden by admin — references are unavailable.'
                                : 'References available once admin approves this vessel.';
                          if (refsActive === 0) {
                            return (
                              <span
                                className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] text-muted-foreground"
                                title={reason}
                              >
                                <UserPlus className="h-3 w-3" />
                                References unavailable
                              </span>
                            );
                          }
                          return (
                            <span
                              className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] text-muted-foreground"
                              title={reason}
                            >
                              <UserPlus className="h-3 w-3" />
                              {refsActive}/{refsCap} reference
                              {refsActive === 1 ? '' : 's'}
                            </span>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditExperience(exp.id);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          disabled={deletingExpId === exp.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteExpId(exp.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingExpId === exp.id ? 'Removing...' : 'Remove'}
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

      {dialogExp && (
        <AddReferenceDialog
          open={!!addRefDialogExpId}
          onOpenChange={(o) => {
            if (!o) {
              setAddRefDialogExpId(null);
              onReferencesChanged?.();
            }
          }}
          experienceId={dialogExp.id}
          activeCount={dialogExp.references_active_count ?? 0}
          cap={refsCap}
        />
      )}

      <Dialog open={!!confirmDeleteExpId} onOpenChange={() => setConfirmDeleteExpId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete experience</DialogTitle>
            <DialogDescription>
              This will permanently remove this experience entry from your profile. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteExpId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!deletingExpId}
              onClick={async () => {
                if (confirmDeleteExpId) {
                  await handleDeleteExperience(confirmDeleteExpId);
                  setConfirmDeleteExpId(null);
                }
              }}
            >
              {deletingExpId ? 'Deleting...' : 'Delete'}
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
