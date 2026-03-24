'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AvailableCrew } from './types';

export function InviteConfirmDialog({
  pendingInvite,
  setPendingInvite,
  dayworkMeta,
  invitationLimit,
  acting,
  handleInvite,
}: {
  pendingInvite: AvailableCrew | null;
  setPendingInvite: (v: AvailableCrew | null) => void;
  dayworkMeta: { job_number: number | null; role_name: string | null };
  invitationLimit: number;
  acting: boolean;
  handleInvite: (personId: string) => void;
}) {
  return (
    <Dialog open={!!pendingInvite} onOpenChange={() => setPendingInvite(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {pendingInvite?.display_name}?</DialogTitle>
          <DialogDescription>
            Invite {pendingInvite?.display_name} for {dayworkMeta.role_name ?? 'this role'}
            {dayworkMeta.job_number
              ? ` — DW-${String(dayworkMeta.job_number).padStart(5, '0')}`
              : ''}
            . This will use 1 of your {invitationLimit} invitations for this posting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setPendingInvite(null)}>
            Cancel
          </Button>
          <Button
            disabled={acting}
            onClick={() => {
              if (pendingInvite) {
                handleInvite(pendingInvite.person_id);
                setPendingInvite(null);
              }
            }}
          >
            <Send className="mr-2 h-4 w-4" />
            Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
