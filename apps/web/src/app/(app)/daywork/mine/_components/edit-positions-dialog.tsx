'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface EditPositionsState {
  id: string;
  current: number;
  filled: number;
}

export interface EditPositionsDialogProps {
  editPositions: EditPositionsState | null;
  editPositionsValue: string;
  setEditPositionsValue: (v: string) => void;
  savingPositions: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function EditPositionsDialog({
  editPositions,
  editPositionsValue,
  setEditPositionsValue,
  savingPositions,
  onSave,
  onClose,
}: EditPositionsDialogProps) {
  return (
    <Dialog open={!!editPositions} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit crew count</DialogTitle>
          <DialogDescription>
            {editPositions && editPositions.filled > 0
              ? `${editPositions.filled} position${editPositions.filled !== 1 ? 's' : ''} already filled. Minimum is ${editPositions.filled}.`
              : 'How many crew do you need for this job?'}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="number"
          min={editPositions?.filled ?? 1}
          max={20}
          value={editPositionsValue}
          onChange={(e) => setEditPositionsValue(e.target.value)}
        />
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={savingPositions}>
            {savingPositions ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
