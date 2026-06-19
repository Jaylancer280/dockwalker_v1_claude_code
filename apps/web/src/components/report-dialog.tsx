'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

const REASON_CATEGORIES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'fraud', label: 'Fraud / scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'spam', label: 'Spam' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'duplicate_account', label: 'Duplicate account' },
  { value: 'other', label: 'Other' },
] as const;

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  reportedPersonId: string;
  reportedName?: string;
  engagementId?: string;
}

export function ReportDialog({
  open,
  onClose,
  reportedPersonId,
  reportedName,
  engagementId,
}: ReportDialogProps) {
  useBodyScrollLock(open);
  const { showSuccess, showError } = useToast();
  const [category, setCategory] = useState<string>('other');
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    const trimmed = reasonText.trim();
    if (!trimmed) {
      showError('Please describe the issue');
      return;
    }
    if (trimmed.length > 1000) {
      showError('Please keep your message under 1000 characters');
      return;
    }
    setSubmitting(true);
    const res = await safeFetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reported_person_id: reportedPersonId,
        engagement_id: engagementId,
        reason_category: category,
        reason_text: trimmed,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      showSuccess("Report submitted. We'll review it shortly.");
      setReasonText('');
      setCategory('other');
      onClose();
    } else {
      showError(res.error ?? 'Failed to submit report');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-[14px] bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Report {reportedName ?? 'user'}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          We review every report. Abuse of this tool may result in your account being suspended.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Reason</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border bg-transparent p-2 text-sm"
          >
            {REASON_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">What happened?</span>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="Please describe the issue in detail…"
            className="rounded-md border bg-transparent p-2 text-sm"
          />
          <span className="text-[10px] text-muted-foreground">{reasonText.length}/1000</span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reasonText.trim()}>
            {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
