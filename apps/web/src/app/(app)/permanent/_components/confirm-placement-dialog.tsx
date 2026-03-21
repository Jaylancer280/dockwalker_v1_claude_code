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

interface ConfirmPlacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  crewName: string;
  roleName: string;
}

export function ConfirmPlacementDialog({
  open,
  onOpenChange,
  onConfirm,
  crewName,
  roleName,
}: ConfirmPlacementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm placement</DialogTitle>
          <DialogDescription>
            Confirm that {crewName} has been placed as {roleName}? This will close the posting and
            notify other shortlisted candidates.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm placement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
