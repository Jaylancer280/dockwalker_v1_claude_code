'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AcceptConfirmDialog({
  pendingAccept,
  setPendingAccept,
  positionsAvailable,
  positionsFilled,
  handleAccept,
}: {
  pendingAccept: { crewId: string; crewName: string } | null;
  setPendingAccept: (v: { crewId: string; crewName: string } | null) => void;
  positionsAvailable: number;
  positionsFilled: number;
  handleAccept: (crewId: string) => void;
}) {
  return (
    <Dialog open={!!pendingAccept} onOpenChange={() => setPendingAccept(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm acceptance</DialogTitle>
          <DialogDescription>
            {positionsAvailable === 1
              ? `Accept ${pendingAccept?.crewName} for this job? This will open a message thread and reject all other applicants.`
              : positionsFilled + 1 >= positionsAvailable
                ? `Accept ${pendingAccept?.crewName}? This will fill the last position and reject remaining applicants.`
                : `Accept ${pendingAccept?.crewName}? (${positionsFilled + 1}/${positionsAvailable} positions will be filled)`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setPendingAccept(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (pendingAccept) {
                handleAccept(pendingAccept.crewId);
                setPendingAccept(null);
              }
            }}
          >
            <Check className="mr-2 h-4 w-4" />
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
