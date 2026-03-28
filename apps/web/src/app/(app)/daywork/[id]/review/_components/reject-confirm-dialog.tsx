'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function RejectConfirmDialog({
  pendingReject,
  setPendingReject,
  handleReject,
}: {
  pendingReject: { crewId: string; crewName: string } | null;
  setPendingReject: (v: { crewId: string; crewName: string } | null) => void;
  handleReject: (crewId: string) => void;
}) {
  return (
    <Dialog open={!!pendingReject} onOpenChange={() => setPendingReject(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject applicant</DialogTitle>
          <DialogDescription>
            Reject {pendingReject?.crewName}? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setPendingReject(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (pendingReject) handleReject(pendingReject.crewId);
              setPendingReject(null);
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
