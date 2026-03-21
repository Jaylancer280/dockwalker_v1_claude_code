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

interface RevertSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevert: () => void;
  crewName: string;
}

export function RevertSelectionDialog({
  open,
  onOpenChange,
  onRevert,
  crewName,
}: RevertSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Not proceeding</DialogTitle>
          <DialogDescription>
            Not proceeding with {crewName}? This will close the conversation and return you to the
            shortlist.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onRevert}>
            Not proceeding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
