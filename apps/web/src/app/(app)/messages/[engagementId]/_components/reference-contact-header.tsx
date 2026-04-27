'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { ConfirmDialog } from '@/components/references/confirm-dialog';

export interface ReferenceContext {
  reference_contact_id: string;
  reference_id: string;
  reference_status: string;
  revoke_reason: string | null;
  requester_display_name: string | null;
  snapshot_vessel_name: string;
  snapshot_vessel_imo: string;
  snapshot_start_date: string;
  snapshot_end_date: string | null;
  requester_role_at_time: string;
  claimed_referee_role: string;
  comment: string | null;
}

interface ReferenceContactHeaderProps {
  engagementId: string;
  refContext: ReferenceContext;
  otherName: string;
  engagementStatus: string;
}

const REVOKE_REASON_BANNER_COPY: Record<string, string> = {
  experience_removed: 'The crew member removed this experience from their profile.',
  requester_revoked: 'The crew member revoked this reference.',
  referee_revoked: 'You revoked your consent for this reference.',
  requester_deactivated: 'The crew member deactivated their account.',
  referee_deactivated: 'The referee account has been deactivated.',
  expired_pending: 'The pending invitation expired.',
  expired_accepted: 'This reference reached its 24-month expiry.',
};

/**
 * Reference-contact chat header (Phase 4) — replaces the daywork/permanent
 * header when active_engagements.reference_contact_id IS NOT NULL. Shows
 * the snapshot context + the referee's comment + a "Close conversation"
 * affordance (W-K). Surfaces a banner when the underlying reference is
 * revoked or expired (Fix A).
 */
export function ReferenceContactHeader({
  engagementId,
  refContext,
  otherName,
  engagementStatus,
}: ReferenceContactHeaderProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const refRevoked =
    refContext.reference_status === 'revoked' || refContext.reference_status === 'expired';
  const bannerCopy = refContext.revoke_reason
    ? (REVOKE_REASON_BANNER_COPY[refContext.revoke_reason] ?? 'This reference was withdrawn.')
    : 'This reference was withdrawn.';

  function dates(): string {
    return refContext.snapshot_end_date
      ? `${refContext.snapshot_start_date} — ${refContext.snapshot_end_date}`
      : `from ${refContext.snapshot_start_date}`;
  }

  async function handleClose() {
    setSubmitting(true);
    const result = await safeFetch<{ ok: true }>(
      `/api/engagements/${engagementId}/close-reference-contact`,
      { method: 'POST' },
    );
    setSubmitting(false);
    setConfirmCloseOpen(false);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    showSuccess('Conversation closed');
    router.push('/messages');
  }

  return (
    <>
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="page-width-wide flex items-center gap-3 px-4 py-3">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-[-0.3px]">{otherName}</p>
            <p className="truncate text-xs text-muted-foreground">
              Reference for {refContext.requester_display_name ?? 'a crew member'} ·{' '}
              {refContext.snapshot_vessel_name} · {dates()}
            </p>
          </div>
          {engagementStatus === 'active' && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActionMenu((v) => !v)}
                aria-label="Conversation actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showActionMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md border border-border bg-background shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionMenu(false);
                      setConfirmCloseOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface)]"
                  >
                    <X className="h-4 w-4" />
                    Close conversation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reference snapshot context banner — always visible */}
        <div className="border-t border-border bg-background px-4 py-2 text-xs">
          <p className="text-muted-foreground">
            IMO {refContext.snapshot_vessel_imo} ·{' '}
            <span className="capitalize">{refContext.requester_role_at_time}</span> referenced as{' '}
            <span className="capitalize">{refContext.claimed_referee_role}</span>
          </p>
          {refContext.comment && (
            <blockquote className="mt-1 border-l-2 border-border pl-2 italic">
              &ldquo;{refContext.comment}&rdquo;
            </blockquote>
          )}
        </div>

        {/* Fix A — revoked/expired underlying reference */}
        {refRevoked && !bannerDismissed && (
          <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="flex-1">
              <strong>This reference was withdrawn.</strong> {bannerCopy} The conversation remains
              open for closure but no new context will appear from the reference.
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss banner"
              className="text-amber-900 hover:text-amber-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* W-K — Close conversation */}
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Close this conversation?"
        description={
          <p>
            Messages stay in your history. The other party can send a fresh contact request later if
            they want to re-open.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Close conversation"
        destructive
        loading={submitting}
        onConfirm={handleClose}
      />
    </>
  );
}
