'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EpauletteBadge } from '@/components/epaulette-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContactReferenceDialog } from './contact-reference-dialog';

/**
 * B-003: per-reference info the picker needs to render a chooser when an
 * applicant has more than one reference. Mirrors the field set returned by
 * the profile API's `experiences[i].references[]` projection plus the
 * shortlist-applicant API extension. Keep the shape minimal — anything we
 * don't render here doesn't need to flow into this component.
 */
export interface ReferenceForPicker {
  id: string;
  referee_display_name: string | null;
  claimed_referee_name: string;
  claimed_referee_role: string | null;
  referee_role_name: string | null;
  referee_role_department: string | null;
  snapshot_vessel_name: string | null;
}

interface ContactReferencesButtonProps {
  references: ReferenceForPicker[];
  /** Free-tier remaining contact requests this month. null = Employer Pro. */
  remainingMonthly?: number | null;
  /** Render override — pass children to use a custom button label. */
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * One-stop drop-in for the "Contact reference" trigger on shortlist cards
 * (B-003). Handles three cases:
 *
 *   0 references  → caller should not render this; we no-op silently.
 *   1 reference   → opens ContactReferenceDialog directly.
 *   2+ references → opens a picker dialog listing referee name + role +
 *                   vessel snapshot. On select, opens ContactReferenceDialog
 *                   for the chosen reference.
 *
 * The shortlist gate (B-003 server-side derivation in
 * `/api/references/[id]/contact`) is enforced API-side, so this component
 * doesn't repeat the check — pre-shortlist applicants simply shouldn't
 * render it (parent decides).
 */
export function ContactReferencesButton({
  references,
  remainingMonthly,
  children,
  className,
  variant = 'outline',
  size = 'sm',
}: ContactReferencesButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialogFor, setDialogFor] = useState<ReferenceForPicker | null>(null);

  if (references.length === 0) return null;

  function handleClick() {
    if (references.length === 1) {
      setDialogFor(references[0]);
      return;
    }
    setPickerOpen(true);
  }

  function refereeDisplay(ref: ReferenceForPicker): string {
    return ref.referee_display_name ?? ref.claimed_referee_name;
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={handleClick}>
        {children ?? (
          <>
            <MessageSquarePlus className="mr-1 h-3 w-3" />
            Contact reference{references.length > 1 ? 's' : ''}
          </>
        )}
      </Button>

      {/* Picker — only rendered for 2+ references. Lists each with a tap
          target showing referee name, role, and vessel snapshot for
          disambiguation. */}
      {references.length > 1 && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Which reference?</DialogTitle>
              <DialogDescription>
                Pick the referee you&rsquo;d like to reach out to.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {references.map((ref) => (
                <li key={ref.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(false);
                      setDialogFor(ref);
                    }}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-lo)]"
                  >
                    {ref.referee_role_name && (
                      <EpauletteBadge
                        roleName={ref.referee_role_name}
                        department={ref.referee_role_department ?? undefined}
                        size="sm"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{refereeDisplay(ref)}</p>
                      <p className="text-xs text-muted-foreground">
                        {ref.referee_role_name ?? ref.claimed_referee_role ?? 'Referee'}
                        {ref.snapshot_vessel_name && ` · ${ref.snapshot_vessel_name}`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {/* Contact dialog — opens for the picked reference (or directly when
          there's only one). Reuses the existing ContactReferenceDialog. */}
      {dialogFor && (
        <ContactReferenceDialog
          open={dialogFor !== null}
          onOpenChange={(next) => {
            if (!next) setDialogFor(null);
          }}
          referenceId={dialogFor.id}
          refereeDisplayName={refereeDisplay(dialogFor)}
          remainingMonthly={remainingMonthly}
        />
      )}
    </>
  );
}
