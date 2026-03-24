'use client';

import { useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';

const REASON_OPTIONS = [
  { value: 'personal_reasons', label: 'Personal circumstances changed' },
  { value: 'found_other_work', label: 'Accepted another job' },
  { value: 'unsafe_conditions', label: 'Safety or working condition concerns' },
  { value: 'other', label: 'Other' },
];

export function CrewCancelFormOverlay({
  workStarted,
  onSubmit,
  onCancel,
}: {
  workStarted: boolean;
  onSubmit: (data: { reason_category: string; reason_text?: string }) => void;
  onCancel: () => void;
}) {
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = reasonCategory && (reasonCategory !== 'other' || reasonText.trim().length > 0);
  const title = workStarted ? 'Terminate job early' : 'Cancel engagement';

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onSubmit({
      reason_category: reasonCategory,
      reason_text: reasonCategory === 'other' ? reasonText.trim() : undefined,
    });
    setSubmitting(false);
  }

  return (
    <BottomSheet open={true} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-4">
        {/* Reason selection */}
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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-accent hover:bg-accent/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Free text for "other" */}
        {reasonCategory === 'other' && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Please explain</p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              rows={2}
              maxLength={250}
            />
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
