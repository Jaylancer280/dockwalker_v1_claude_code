'use client';

import { useState } from 'react';
import { Loader2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export function PostponementFormOverlay({
  currentStartDate,
  currentEndDate,
  currentWorkingDays,
  onSubmit,
  onCancel,
}: {
  currentStartDate: string;
  currentEndDate: string;
  currentWorkingDays: number;
  onSubmit: (data: {
    start_date: string;
    end_date: string;
    working_days: number;
    confirm_conflict?: boolean;
  }) => Promise<{ outcome: string }>;
  onCancel: () => void;
}) {
  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);
  const [workingDays, setWorkingDays] = useState(currentWorkingDays);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflictDetected, setConflictDetected] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const spanDays = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);

  const datesValid =
    startDate >= today && endDate >= startDate && workingDays >= 1 && workingDays <= spanDays;

  async function handlePropose(confirmConflict?: boolean) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await onSubmit({
        start_date: startDate,
        end_date: endDate,
        working_days: workingDays,
        confirm_conflict: confirmConflict,
      });
      if (result.outcome === 'conflict') {
        setConflictDetected(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propose');
    }
    setSubmitting(false);
  }

  return (
    <BottomSheet open={true} onClose={onCancel} title="Propose date change">
      <div className="flex flex-col gap-4">
        {!conflictDetected ? (
          <>
            <p className="text-xs text-muted-foreground">
              This can only be used once per engagement. The crew member will be asked to approve or
              reject the new dates.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium">New start date</label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">New end date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Working days{spanDays > 0 ? ` (max ${spanDays})` : ''}
              </label>
              <input
                type="number"
                value={workingDays}
                min={1}
                max={spanDays || undefined}
                onChange={(e) => setWorkingDays(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium">Scheduling conflict</p>
                <p className="mt-1 text-muted-foreground">
                  The crew member has another engagement during these dates. If you proceed, this
                  engagement will be cancelled and the job will be relisted with the new dates.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="border-t border-border px-4 py-3">
        {!conflictDetected ? (
          <Button
            className="w-full"
            disabled={!datesValid || submitting}
            onClick={() => handlePropose()}
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Clock className="mr-1.5 h-4 w-4" />
            )}
            Propose new dates
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={submitting}
              onClick={() => handlePropose(true)}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-4 w-4" />
              )}
              Cancel & relist
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
