'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { ConfirmDialog } from './confirm-dialog';

interface ConsentPrompt {
  kind: 'reference_invitation' | 'reference_contact';
  id: string;
  reference_id: string;
  created_at: string;
  requester_display_name: string | null;
  employer_display_name: string | null;
  snapshot_vessel_name: string;
  snapshot_vessel_imo: string;
  snapshot_start_date: string;
  snapshot_end_date: string | null;
  requester_role_at_time: string;
  claimed_referee_role: string;
  question: string | null;
  pending_expires_at: string | null;
}

const COMMENT_MAX = 500;

interface ConsentPromptsSectionProps {
  prompts: ConsentPrompt[];
  onActionComplete: () => void;
}

export function ConsentPromptsSection({ prompts, onActionComplete }: ConsentPromptsSectionProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [confirmAcceptInvite, setConfirmAcceptInvite] = useState<ConsentPrompt | null>(null);
  const [confirmDeclineInvite, setConfirmDeclineInvite] = useState<ConsentPrompt | null>(null);
  const [confirmAcceptContact, setConfirmAcceptContact] = useState<ConsentPrompt | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function formatDates(start: string, end: string | null): string {
    return end ? `${start} — ${end}` : `from ${start}`;
  }

  async function performAcceptInvite(prompt: ConsentPrompt) {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${prompt.reference_id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: commentDraft.trim().length > 0 ? commentDraft.trim() : null,
      }),
    });
    setSubmitting(false);
    setConfirmAcceptInvite(null);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Reference confirmed');
    setCommentDraft('');
    onActionComplete();
  }

  async function performDeclineInvite(prompt: ConsentPrompt) {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${prompt.reference_id}/decline`, {
      method: 'POST',
    });
    setSubmitting(false);
    setConfirmDeclineInvite(null);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Invitation declined');
    onActionComplete();
  }

  async function performAcceptContact(prompt: ConsentPrompt) {
    setSubmitting(true);
    const result = await safeFetch<{ engagementId: string }>(
      `/api/reference-contacts/${prompt.id}/accept`,
      { method: 'POST' },
    );
    setSubmitting(false);
    setConfirmAcceptContact(null);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Contact accepted — chat opened');
    router.push(`/messages/${result.data.engagementId}`);
  }

  async function performDeclineContact(prompt: ConsentPrompt) {
    // Silent decline — single tap, no modal.
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/reference-contacts/${prompt.id}/decline`, {
      method: 'POST',
    });
    setSubmitting(false);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    onActionComplete();
  }

  return (
    <>
      <section className="space-y-2">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Inbox className="h-3 w-3" />
          Consent prompts ({prompts.length})
        </p>
        {prompts.map((p) => (
          <article
            key={p.id}
            className="space-y-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <header className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {p.kind === 'reference_invitation'
                    ? `${p.requester_display_name ?? 'A crew member'} wants you as a reference`
                    : `${p.employer_display_name ?? 'An employer'} wants to chat about ${p.requester_display_name ?? 'a past colleague'}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.snapshot_vessel_name} ·{' '}
                  {formatDates(p.snapshot_start_date, p.snapshot_end_date)}
                </p>
              </div>
            </header>
            {p.question && (
              <p className="rounded-md border border-border bg-background p-2 text-sm italic">
                Their question: &ldquo;{p.question}&rdquo;
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {p.kind === 'reference_invitation' ? (
                <>
                  <Button size="sm" onClick={() => setConfirmAcceptInvite(p)} disabled={submitting}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDeclineInvite(p)}
                    disabled={submitting}
                  >
                    Decline
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setConfirmAcceptContact(p)}
                    disabled={submitting}
                  >
                    Accept and open chat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => performDeclineContact(p)}
                    disabled={submitting}
                  >
                    Decline
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* W-E — Reference invitation accept (re-uses the comment textarea) */}
      <Dialog
        open={!!confirmAcceptInvite}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmAcceptInvite(null);
            setCommentDraft('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm reference</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  By accepting, you confirm that you worked with{' '}
                  {confirmAcceptInvite?.requester_display_name ?? 'this crew member'} on{' '}
                  {confirmAcceptInvite?.snapshot_vessel_name} from{' '}
                  {confirmAcceptInvite?.snapshot_start_date} to{' '}
                  {confirmAcceptInvite?.snapshot_end_date ?? 'present'}.
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    <strong>Your name and role will be shown publicly</strong> on their profile.
                  </li>
                  <li>
                    <strong>Your comment</strong> (if you write one) will be visible publicly.
                  </li>
                  <li>You can revoke this reference at any time from Settings → References.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value.slice(0, COMMENT_MAX))}
            rows={4}
            placeholder="Add a comment (optional)"
          />
          <p className="text-right text-xs text-muted-foreground">
            {commentDraft.length}/{COMMENT_MAX}
          </p>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAcceptInvite(null);
                setCommentDraft('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmAcceptInvite && performAcceptInvite(confirmAcceptInvite)}
              disabled={submitting}
            >
              {submitting ? 'Working…' : 'I confirm — accept reference'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* W-F — Decline invitation silently */}
      <ConfirmDialog
        open={!!confirmDeclineInvite}
        onOpenChange={(o) => !o && setConfirmDeclineInvite(null)}
        title="Decline this reference?"
        description={
          <p>
            We won&apos;t tell {confirmDeclineInvite?.requester_display_name ?? 'them'} that you
            declined. They&apos;ll see the invitation as &quot;pending&quot; until it expires in 30
            days. This action is final — you&apos;d need a fresh invitation to accept later.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Decline silently"
        destructive
        loading={submitting}
        onConfirm={() => confirmDeclineInvite && performDeclineInvite(confirmDeclineInvite)}
      />

      {/* W-I — Accept contact request (opens chat) */}
      <ConfirmDialog
        open={!!confirmAcceptContact}
        onOpenChange={(o) => !o && setConfirmAcceptContact(null)}
        title={`Open a conversation with ${confirmAcceptContact?.employer_display_name ?? 'this employer'}?`}
        description={
          <>
            <p>
              {confirmAcceptContact?.employer_display_name ?? 'This employer'} wants to contact you
              about {confirmAcceptContact?.requester_display_name ?? 'a past colleague'} ·{' '}
              {confirmAcceptContact?.snapshot_vessel_name} ·{' '}
              {confirmAcceptContact?.snapshot_start_date} —{' '}
              {confirmAcceptContact?.snapshot_end_date ?? 'present'}. Accepting opens a chat thread
              between you and the employer.
            </p>
            {confirmAcceptContact?.question && (
              <p className="text-xs">
                Their question: <em>&ldquo;{confirmAcceptContact.question}&rdquo;</em>
              </p>
            )}
            <p className="text-xs">
              Messages are retained on DockWalker&apos;s servers and cannot be deleted by either
              party. You can close the conversation at any time.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Accept and open chat"
        loading={submitting}
        onConfirm={() => confirmAcceptContact && performAcceptContact(confirmAcceptContact)}
      />
    </>
  );
}
