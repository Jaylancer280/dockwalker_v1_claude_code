'use client';

import { useState, useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { ConfirmDialog } from './confirm-dialog';

interface ContactReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceId: string;
  refereeDisplayName: string;
  /**
   * Free-tier remaining contact requests this month (null when caller is on
   * Employer Pro — unlimited). Used to render H-3.
   */
  remainingMonthly?: number | null;
}

const QUESTION_MAX = 200;

export function ContactReferenceDialog({
  open,
  onOpenChange,
  referenceId,
  refereeDisplayName,
  remainingMonthly,
}: ContactReferenceDialogProps) {
  const { showSuccess } = useToast();
  const questionId = useId();
  const [question, setQuestion] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const isPro = remainingMonthly === null;

  function handleClose(next: boolean) {
    if (!next) {
      setQuestion('');
      setGateError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirmedSend() {
    setSubmitting(true);
    setGateError(null);
    const result = await safeFetch<{ contactId: string }>(
      `/api/references/${referenceId}/contact`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim().length > 0 ? question.trim() : null }),
      },
    );
    setSubmitting(false);
    setConfirmOpen(false);
    if (!result.ok) {
      // 402 with structured gate payload — surface upgrade path.
      setGateError(result.error);
      return;
    }
    showSuccess('Contact request sent');
    handleClose(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact {refereeDisplayName}</DialogTitle>
            <DialogDescription>
              We&apos;ll notify {refereeDisplayName}. If they accept, a chat opens between you. If
              they decline or don&apos;t reply, you won&apos;t be notified — declines stay private
              so referees feel safe being honest.
            </DialogDescription>
          </DialogHeader>

          {gateError ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                {gateError}
              </div>
              <Button asChild className="w-full">
                <a href="/billing?plan=employer_pro">Upgrade to Employer Pro</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor={questionId}>What would you like to ask? (optional)</Label>
                <Textarea
                  id={questionId}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX))}
                  rows={3}
                  placeholder="e.g. How was their punctuality and attitude on long charter weeks?"
                />
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>Increases the chance the reference accepts your contact.</span>
                  <span>
                    {question.length}/{QUESTION_MAX}
                  </span>
                </p>
              </div>
              {/* H-3 inline hint. Three states:
                   - Pro (remainingMonthly === null): unlimited.
                   - Free with a known count: show the specific number.
                   - Unknown (undefined — call site didn't pass it): show the
                     budget shape generically, never claim "0 remaining" since
                     that misleads users who haven't sent any requests. */}
              <p className="rounded-md border border-border bg-[var(--surface)] p-2 text-xs text-muted-foreground">
                {isPro
                  ? 'Employer Pro · unlimited contact requests.'
                  : typeof remainingMonthly === 'number'
                    ? `You have ${remainingMonthly} contact request${
                        remainingMonthly === 1 ? '' : 's'
                      } remaining this month. Each is consumed only when the referee accepts.`
                    : 'Free plan · up to 5 accepted contacts per 30 days. Requests are only counted once the referee accepts.'}
              </p>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* W-J — employer consent on send */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send contact request?"
        description={
          <>
            <p>
              We&apos;ll notify {refereeDisplayName}. If they accept, a chat opens between you. If
              they decline or don&apos;t reply, you won&apos;t hear back — declines stay private.
            </p>
            {!isPro && typeof remainingMonthly === 'number' && (
              <p className="text-xs">
                This will use 1 of your remaining {remainingMonthly} contact requests this month.
                Upgrade to Employer Pro for unlimited.
              </p>
            )}
            {question.trim().length > 0 && (
              <p className="text-xs">
                Your question will be shown on the consent prompt:{' '}
                <em>&ldquo;{question.trim()}&rdquo;</em>
              </p>
            )}
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Send request"
        loading={submitting}
        onConfirm={handleConfirmedSend}
      />
    </>
  );
}
