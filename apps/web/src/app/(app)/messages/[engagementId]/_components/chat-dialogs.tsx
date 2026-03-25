'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EngagementContext } from './types';
import { ConfirmPlacementDialog } from '../../../permanent/_components/confirm-placement-dialog';
import { RevertSelectionDialog } from '../../../permanent/_components/revert-selection-dialog';
import { CloseConversationDialog } from '../../../permanent/_components/close-conversation-dialog';

interface ChatDialogsProps {
  context: EngagementContext | null;
  isPermanent: boolean;
  isCrew: boolean;
  // Complete confirm
  showCompleteConfirm: boolean;
  setShowCompleteConfirm: (v: boolean) => void;
  completing: boolean;
  onComplete: () => void;
  // Permanent dialogs
  showConfirmPlacement: boolean;
  setShowConfirmPlacement: (v: boolean) => void;
  onConfirmPlacement: () => void;
  showRevertSelection: boolean;
  setShowRevertSelection: (v: boolean) => void;
  onRevertSelection: () => void;
  showCloseConversation: boolean;
  setShowCloseConversation: (v: boolean) => void;
  onCloseConversation: (outcome: string) => void;
  cancelPostingId: string | null;
  setCancelPostingId: (v: string | null) => void;
  onCancelPosting: () => void;
}

export function ChatDialogs({
  context,
  isPermanent,
  isCrew,
  showCompleteConfirm,
  setShowCompleteConfirm,
  completing,
  onComplete,
  showConfirmPlacement,
  setShowConfirmPlacement,
  onConfirmPlacement,
  showRevertSelection,
  setShowRevertSelection,
  onRevertSelection,
  showCloseConversation,
  setShowCloseConversation,
  onCloseConversation,
  cancelPostingId,
  setCancelPostingId,
  onCancelPosting,
}: ChatDialogsProps) {
  return (
    <>
      {/* Complete confirmation dialog */}
      <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark daywork as completed</DialogTitle>
            <DialogDescription>
              This will mark the daywork as completed for all engaged crew. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCompleteConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={onComplete} disabled={completing}>
              {completing ? 'Completing...' : 'Mark complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent dialogs */}
      {isPermanent && (
        <>
          <ConfirmPlacementDialog
            open={showConfirmPlacement}
            onOpenChange={setShowConfirmPlacement}
            onConfirm={onConfirmPlacement}
            crewName={context?.other_name ?? 'crew member'}
            roleName={context?.permanent_postings?.yacht_roles?.name ?? 'this role'}
          />
          <RevertSelectionDialog
            open={showRevertSelection}
            onOpenChange={setShowRevertSelection}
            onRevert={onRevertSelection}
            crewName={context?.other_name ?? 'this candidate'}
          />
          <CloseConversationDialog
            open={showCloseConversation}
            onOpenChange={setShowCloseConversation}
            onClose={onCloseConversation}
            isCrew={isCrew}
          />
          {/* Cancel posting dialog */}
          <Dialog open={!!cancelPostingId} onOpenChange={() => setCancelPostingId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel posting?</DialogTitle>
                <DialogDescription>
                  This will cancel the posting and reject all pending applicants.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCancelPostingId(null)}>
                  Keep
                </Button>
                <Button variant="destructive" onClick={onCancelPosting}>
                  Cancel posting
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
