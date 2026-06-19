'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { ConfirmDialog } from '@/components/references/confirm-dialog';

interface RefereeConsentClientProps {
  referenceId: string;
  token: string;
  currentUserAuthed: boolean;
  emailMismatch: boolean;
  claimedEmailMasked: string | null;
  requesterName: string;
}

const COMMENT_MAX = 500;

export function RefereeConsentClient({
  referenceId,
  token,
  currentUserAuthed,
  emailMismatch,
  claimedEmailMasked,
  requesterName,
}: RefereeConsentClientProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [comment, setComment] = useState('');
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!currentUserAuthed) {
    const next = encodeURIComponent(`/ref/${token}`);
    return (
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in or create an account to accept or decline.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <a href={`/auth/signup?next=${next}&referee=1`}>Sign up as a referee</a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <a href={`/auth/login?next=${next}`}>I already have an account</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lightweight signup needs email + name only. You can complete a full crew profile later if
          you&apos;d like.
        </p>
      </section>
    );
  }

  if (emailMismatch && claimedEmailMasked) {
    return (
      <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        <p className="font-medium">This invitation was sent to a different email</p>
        <p className="text-xs">
          The link was generated for <span className="font-mono">{claimedEmailMasked}</span>. Sign
          in with that account to accept.
        </p>
      </section>
    );
  }

  async function handleAccept() {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${referenceId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment.trim().length > 0 ? comment.trim() : null }),
    });
    setSubmitting(false);
    setConfirmAccept(false);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Reference confirmed');
    router.push('/messages');
  }

  async function handleDecline() {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${referenceId}/decline`, {
      method: 'POST',
    });
    setSubmitting(false);
    setConfirmDecline(false);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Invitation declined');
    router.push('/messages');
  }

  return (
    <>
      <section className="space-y-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Add a comment (optional)</span>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            rows={4}
            placeholder={`Write about your professional experience working with ${requesterName}.`}
          />
          {/* H-2 inline hint + counter */}
          <span className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Visible publicly on {requesterName}&apos;s profile. Don&apos;t share salary, medical,
              or other personal details.
            </span>
            <span>
              {comment.length}/{COMMENT_MAX}
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setConfirmAccept(true)} disabled={submitting} className="flex-1">
            Accept reference
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmDecline(true)}
            disabled={submitting}
            className="flex-1"
          >
            Decline
          </Button>
        </div>
      </section>

      {/* W-E — load-bearing consent */}
      <ConfirmDialog
        open={confirmAccept}
        onOpenChange={setConfirmAccept}
        title="Confirm reference"
        description={
          <>
            <p>
              By accepting, you confirm that you worked with {requesterName} on the vessel and dates
              above.
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Your name and role will be shown publicly</strong> on their profile, visible
                to employers, agents, and other crew viewing the profile.
              </li>
              <li>
                <strong>Your comment</strong> (if you write one) will also be visible publicly under
                the same rules.
              </li>
              <li>
                Employers may later request to contact you about this reference. You can accept or
                decline each contact request.
              </li>
              <li>You can revoke this reference at any time from Settings → References.</li>
            </ul>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="I confirm — accept reference"
        loading={submitting}
        onConfirm={handleAccept}
      />

      {/* W-F — silent decline */}
      <ConfirmDialog
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        title="Decline this reference?"
        description={
          <p>
            We won&apos;t tell {requesterName} that you declined. They&apos;ll see the invitation as
            &quot;pending&quot; until it expires in 30 days. This action is final — you&apos;d need
            a fresh invitation to accept later.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Decline silently"
        destructive
        loading={submitting}
        onConfirm={handleDecline}
      />
    </>
  );
}
