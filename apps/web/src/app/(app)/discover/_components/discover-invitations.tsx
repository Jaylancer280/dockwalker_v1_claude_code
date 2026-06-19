'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InvitationsTab } from './invitations-tab';
import { useDiscoverData } from './discover-data-context';

/**
 * Container for the Invitations tab. Reads invitation state +
 * handlers from the shared DiscoverDataProvider. Renders the
 * presentational <InvitationsTab> plus the two confirm dialogs
 * (accept / decline) — these used to live at the page level but
 * sit naturally next to the state that drives them.
 */
export function DiscoverInvitations({
  onSwitchToBrowse,
  onViewProfile,
}: {
  onSwitchToBrowse: () => void;
  onViewProfile: (personId: string) => void;
}) {
  const {
    invitations,
    loadingInvitations,
    invitationError,
    respondingId,
    confirmAcceptInv,
    confirmDeclineInv,
    setConfirmAcceptInv,
    setConfirmDeclineInv,
    handleAcceptInvitation,
    handleDeclineInvitation,
  } = useDiscoverData();

  return (
    <>
      <InvitationsTab
        invitations={invitations}
        loadingInvitations={loadingInvitations}
        respondingId={respondingId}
        invitationError={invitationError}
        onAccept={(inv) => setConfirmAcceptInv(inv)}
        onDecline={(inv) => setConfirmDeclineInv(inv)}
        onViewProfile={onViewProfile}
        onSwitchToBrowse={onSwitchToBrowse}
      />

      {/* Accept invitation confirmation */}
      <Dialog open={!!confirmAcceptInv} onOpenChange={() => setConfirmAcceptInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this invitation?</DialogTitle>
            <DialogDescription>
              You&apos;ll be added as an applicant for this job.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAcceptInv(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!respondingId}
              onClick={() => {
                if (confirmAcceptInv) handleAcceptInvitation(confirmAcceptInv);
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline invitation confirmation */}
      <Dialog open={!!confirmDeclineInv} onOpenChange={() => setConfirmDeclineInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this invitation?</DialogTitle>
            <DialogDescription>The employer won&apos;t be notified.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeclineInv(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!respondingId}
              onClick={() => {
                if (confirmDeclineInv) handleDeclineInvitation(confirmDeclineInv);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
