'use client';

import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';

const REASON_OPTIONS = [
  { value: 'vessel_leaving', label: 'Vessel leaving port earlier than expected' },
  { value: 'crew_requirements_changed', label: 'Change in crew requirements' },
  { value: 'vessel_operational', label: 'Vessel operational issues' },
  { value: 'other', label: 'Other' },
];

const RELIST_REASON_OPTIONS = [
  { value: 'wrong_crew', label: 'Accepted the wrong crew member' },
  { value: 'requirements_changed', label: 'Daywork requirements changed' },
  { value: 'different_skills', label: 'Need a different skill set' },
  { value: 'relist_other', label: 'Other' },
];

export function CancelFormOverlay({
  workStarted,
  startDatePassed,
  onSubmit,
  onCancel,
}: {
  workStarted: boolean;
  startDatePassed: boolean;
  onSubmit: (data: {
    reason_category: string;
    reason_text?: string;
    relist_requested: boolean;
    relist_reason_category?: string;
    relist_reason_text?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [relistRequested, setRelistRequested] = useState<boolean | null>(null);
  const [relistReasonCategory, setRelistReasonCategory] = useState('');
  const [relistReasonText, setRelistReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasonValid =
    reasonCategory && (reasonCategory !== 'other' || reasonText.trim().length > 0);
  const relistValid =
    relistRequested === null
      ? false
      : !relistRequested ||
        startDatePassed ||
        (relistReasonCategory &&
          (relistReasonCategory !== 'relist_other' || relistReasonText.trim().length > 0));
  const isValid = reasonValid && relistRequested !== null && relistValid;

  const title = workStarted ? 'Terminate job early' : 'Cancel engagement';

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    // If start date has passed, relist is impossible — send false regardless of UI selection
    const effectiveRelist = relistRequested === true && !startDatePassed;
    await onSubmit({
      reason_category: reasonCategory,
      reason_text: reasonCategory === 'other' ? reasonText.trim() : undefined,
      relist_requested: effectiveRelist,
      relist_reason_category: effectiveRelist ? relistReasonCategory : undefined,
      relist_reason_text:
        effectiveRelist && relistReasonCategory === 'relist_other'
          ? relistReasonText.trim()
          : undefined,
    });
    setSubmitting(false);
  }

  return (
    <BottomSheet open={true} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-4">
        {/* Step 1: Reason */}
        <div>
          <p className="mb-2 text-sm font-medium">Why are you cancelling?</p>
          <div className="flex flex-col gap-1.5">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReasonCategory(opt.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  reasonCategory === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hi)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Free text for "other" */}
        {reasonCategory === 'other' && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Please explain</p>
            <Textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
              rows={2}
              maxLength={250}
            />
          </div>
        )}

        {/* Step 3: Relist? */}
        {reasonCategory && (
          <div>
            <p className="mb-2 text-sm font-medium">Do you still need to fill this role?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRelistRequested(true)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  relistRequested === true
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hi)]'
                }`}
              >
                Yes, relist the job
              </button>
              <button
                type="button"
                onClick={() => setRelistRequested(false)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  relistRequested === false
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hi)]'
                }`}
              >
                No, cancel the posting
              </button>
            </div>
          </div>
        )}

        {/* Relist warning when start date has passed */}
        {relistRequested === true && startDatePassed && (
          <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-lo)] px-3 py-2 text-sm text-[var(--warning)]">
            This job&apos;s start date has already passed. Relisting is not possible — you can
            create a new posting for the remaining days after cancelling.
          </div>
        )}

        {/* Step 4: Relist reason (employer-private) */}
        {relistRequested === true && !startDatePassed && (
          <div>
            <p className="mb-2 text-sm font-medium">What changed? (private, not shown to crew)</p>
            <div className="flex flex-col gap-1.5">
              {RELIST_REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRelistReasonCategory(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    relistReasonCategory === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hi)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {relistReasonCategory === 'relist_other' && (
              <Textarea
                value={relistReasonText}
                onChange={(e) => setRelistReasonText(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                rows={2}
                maxLength={250}
                placeholder="Please explain..."
              />
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button
          className="w-full"
          variant="destructive"
          disabled={!isValid || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-1.5 h-4 w-4" />
          )}
          {title}
        </Button>
      </div>
    </BottomSheet>
  );
}
