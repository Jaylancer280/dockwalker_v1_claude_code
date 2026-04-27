'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/references/confirm-dialog';
import { CopyLinkButton } from '@/components/references/add-reference-dialog';

interface ReferenceRow {
  id: string;
  experience_id: string | null;
  status: string;
  claimed_referee_role: string;
  claimed_referee_name: string;
  claimed_referee_email: string | null;
  token: string;
  comment: string | null;
  comment_updated_at: string | null;
  consented_at: string | null;
  responded_at: string | null;
  expires_at: string;
  pending_expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  snapshot_vessel_name: string;
  snapshot_vessel_imo: string;
  snapshot_start_date: string;
  snapshot_end_date: string | null;
  requester_person_id: string;
  referee_person_id: string | null;
  created_at: string;
}

interface MineResponse {
  outbound: ReferenceRow[];
  inbound_accepted: ReferenceRow[];
  inbound_pending: ReferenceRow[];
}

const COMMENT_MAX = 500;

const REVOKE_REASON_LABELS: Record<string, string> = {
  requester_revoked: 'Crew member revoked',
  referee_revoked: 'You revoked your consent',
  experience_removed: 'Crew member removed this experience',
  requester_deactivated: 'Crew member deactivated their account',
  referee_deactivated: 'Referee deactivated their account',
  expired_pending: 'Pending invitation expired (30 days)',
  expired_accepted: 'Reference reached its 24-month expiry',
};

function formatDates(start: string, end: string | null): string {
  return end ? `${start} — ${end}` : `from ${start}`;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.dockwalker.io';
}

export default function ReferencesSettingsPage() {
  const { showError, showSuccess } = useToast();
  const [data, setData] = useState<MineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmRevokeAccepted, setConfirmRevokeAccepted] = useState<ReferenceRow | null>(null);
  const [confirmCancelPending, setConfirmCancelPending] = useState<ReferenceRow | null>(null);
  const [confirmResend, setConfirmResend] = useState<ReferenceRow | null>(null);
  const [confirmRevokeConsent, setConfirmRevokeConsent] = useState<ReferenceRow | null>(null);

  const [editingComment, setEditingComment] = useState<ReferenceRow | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentConfirmOpen, setCommentConfirmOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await safeFetch<MineResponse>('/api/references/mine');
    setLoading(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    setData(result.data);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      reload();
    }, 0);
    return () => clearTimeout(t);
  }, [reload]);

  async function performRevoke(refId: string) {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${refId}/revoke`, {
      method: 'POST',
    });
    setSubmitting(false);
    if (!result.ok) {
      showError(result.error);
      return false;
    }
    showSuccess('Reference revoked');
    await reload();
    return true;
  }

  async function performResend(refId: string) {
    setSubmitting(true);
    const result = await safeFetch<{ id: string; token: string; link: string }>(
      `/api/references/${refId}/resend`,
      { method: 'POST' },
    );
    setSubmitting(false);
    if (!result.ok) {
      showError(result.error);
      return null;
    }
    showSuccess('Fresh invitation created');
    await reload();
    return result.data;
  }

  async function performCommentSave(refId: string, value: string | null) {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(`/api/references/${refId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: value }),
    });
    setSubmitting(false);
    if (!result.ok) {
      showError(result.error);
      return false;
    }
    showSuccess('Comment updated');
    await reload();
    return true;
  }

  const outbound = data?.outbound ?? [];
  const inboundAccepted = data?.inbound_accepted ?? [];

  const outboundPending = outbound.filter((r) => r.status === 'pending');
  const outboundAccepted = outbound.filter((r) => r.status === 'accepted');
  const outboundExpired = outbound.filter((r) => r.status === 'expired');
  const outboundHistory = outbound.filter((r) =>
    ['revoked', 'declined', 'expired'].includes(r.status),
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      <header className="flex items-center gap-2">
        <Link
          href="/settings"
          className="rounded-md p-2 transition-colors hover:bg-[var(--surface)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">References</h1>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading references…</p>}
      {errorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
          <button onClick={reload} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Outbound — pending */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending invitations
            </h2>
            {outboundPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-3">
                {outboundPending.map((r) => (
                  <li key={r.id} className="space-y-2 rounded-xl border bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{r.claimed_referee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.claimed_referee_role} · {r.snapshot_vessel_name} ·{' '}
                          {formatDates(r.snapshot_start_date, r.snapshot_end_date)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        Pending
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CopyLinkButton link={`${siteUrl()}/ref/${r.token}`} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmResend(r)}
                        disabled={submitting}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmCancelPending(r)}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Outbound — accepted */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Accepted references
            </h2>
            {outboundAccepted.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-3">
                {outboundAccepted.map((r) => (
                  <li key={r.id} className="space-y-2 rounded-xl border bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{r.claimed_referee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.claimed_referee_role} · {r.snapshot_vessel_name} ·{' '}
                          {formatDates(r.snapshot_start_date, r.snapshot_end_date)}
                        </p>
                        {r.comment && (
                          <blockquote className="mt-2 border-l-2 border-border pl-2 text-sm italic">
                            &ldquo;{r.comment}&rdquo;
                          </blockquote>
                        )}
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                        Accepted
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmRevokeAccepted(r)}
                        disabled={submitting}
                      >
                        Remove reference
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Outbound — expired (resend allowed) */}
          {outboundExpired.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Expired
              </h2>
              <ul className="space-y-3">
                {outboundExpired.map((r) => (
                  <li key={r.id} className="space-y-2 rounded-xl border bg-[var(--surface)] p-3">
                    <p className="font-medium">{r.claimed_referee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.snapshot_vessel_name} · expired {r.revoked_at?.slice(0, 10) ?? '—'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmResend(r)}
                      disabled={submitting}
                    >
                      Resend
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Inbound accepted (caller is the referee) */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              References you&apos;ve given
            </h2>
            {inboundAccepted.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-3">
                {inboundAccepted.map((r) => (
                  <li key={r.id} className="space-y-2 rounded-xl border bg-[var(--surface)] p-3">
                    <div>
                      <p className="font-medium">{r.snapshot_vessel_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDates(r.snapshot_start_date, r.snapshot_end_date)} · IMO{' '}
                        {r.snapshot_vessel_imo}
                      </p>
                    </div>
                    {r.comment ? (
                      <blockquote className="border-l-2 border-border pl-2 text-sm italic">
                        &ldquo;{r.comment}&rdquo;
                      </blockquote>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">No comment yet.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingComment(r);
                          setCommentDraft(r.comment ?? '');
                        }}
                      >
                        {r.comment ? 'Edit comment' : 'Add comment'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmRevokeConsent(r)}
                        disabled={submitting}
                      >
                        Revoke consent
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Inbound history (audit) */}
          {outboundHistory.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                History
              </h2>
              <ul className="space-y-2">
                {outboundHistory.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-[var(--surface)] p-2 text-xs"
                  >
                    <span>
                      {r.claimed_referee_name} · {r.snapshot_vessel_name}
                    </span>
                    <span className="text-muted-foreground">
                      {r.revoke_reason
                        ? (REVOKE_REASON_LABELS[r.revoke_reason] ?? r.revoke_reason)
                        : r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* W-B — Crew revokes accepted */}
      <ConfirmDialog
        open={!!confirmRevokeAccepted}
        onOpenChange={(o) => !o && setConfirmRevokeAccepted(null)}
        title="Remove this reference?"
        description={
          <p>
            {confirmRevokeAccepted?.claimed_referee_name}&apos;s reference and comment will be
            removed from your profile permanently. The audit log keeps a record but the reference
            will no longer be visible to anyone.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Remove reference"
        destructive
        loading={submitting}
        onConfirm={async () => {
          const ref = confirmRevokeAccepted;
          if (!ref) return;
          const ok = await performRevoke(ref.id);
          if (ok) setConfirmRevokeAccepted(null);
        }}
      />

      {/* W-C — Crew cancels pending */}
      <ConfirmDialog
        open={!!confirmCancelPending}
        onOpenChange={(o) => !o && setConfirmCancelPending(null)}
        title="Cancel this invitation?"
        description={
          <p>
            {confirmCancelPending?.claimed_referee_name} won&apos;t be notified. The link you shared
            will stop working.
          </p>
        }
        cancelLabel="Keep invitation"
        confirmLabel="Cancel invitation"
        destructive
        loading={submitting}
        onConfirm={async () => {
          const ref = confirmCancelPending;
          if (!ref) return;
          const ok = await performRevoke(ref.id);
          if (ok) setConfirmCancelPending(null);
        }}
      />

      {/* W-D — Resend */}
      <ConfirmDialog
        open={!!confirmResend}
        onOpenChange={(o) => !o && setConfirmResend(null)}
        title="Send a fresh invitation?"
        description={
          <p>
            We&apos;ll generate a new link and the old one will stop working. The previous
            invitation will be cancelled in your audit log.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Send fresh invitation"
        loading={submitting}
        onConfirm={async () => {
          const ref = confirmResend;
          if (!ref) return;
          const data = await performResend(ref.id);
          if (data) setConfirmResend(null);
        }}
      />

      {/* W-H — Referee revokes consent */}
      <ConfirmDialog
        open={!!confirmRevokeConsent}
        onOpenChange={(o) => !o && setConfirmRevokeConsent(null)}
        title="Revoke your consent?"
        description={
          <p>
            The crew member will lose this reference and your comment from their profile. The change
            is immediate. The audit log preserves a record.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Revoke consent"
        destructive
        loading={submitting}
        onConfirm={async () => {
          const ref = confirmRevokeConsent;
          if (!ref) return;
          const ok = await performRevoke(ref.id);
          if (ok) setConfirmRevokeConsent(null);
        }}
      />

      {/* Edit comment dialog (referee side) — W-G consent on save */}
      <Dialog
        open={!!editingComment}
        onOpenChange={(o) => {
          if (!o) {
            setEditingComment(null);
            setCommentDraft('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit reference comment</DialogTitle>
            <DialogDescription>
              Visible publicly on the crew member&apos;s profile. Don&apos;t include salary or
              medical details.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value.slice(0, COMMENT_MAX))}
            rows={5}
          />
          <p className="text-right text-xs text-muted-foreground">
            {commentDraft.length}/{COMMENT_MAX}
          </p>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditingComment(null);
                setCommentDraft('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setCommentConfirmOpen(true)}
              disabled={submitting || commentDraft.trim() === (editingComment?.comment ?? '')}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* W-G — comment update consent */}
      <ConfirmDialog
        open={commentConfirmOpen}
        onOpenChange={setCommentConfirmOpen}
        title="Update reference comment?"
        description={
          <p>
            This comment is visible publicly on the crew member&apos;s profile. Your previous
            comment will be replaced. Don&apos;t include personal information like salary or medical
            details.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Update comment"
        loading={submitting}
        onConfirm={async () => {
          if (!editingComment) return;
          const value = commentDraft.trim().length > 0 ? commentDraft.trim() : null;
          const ok = await performCommentSave(editingComment.id, value);
          if (ok) {
            setCommentConfirmOpen(false);
            setEditingComment(null);
            setCommentDraft('');
          }
        }}
      />
    </main>
  );
}
