'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CloseConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (outcome: string) => void;
  isCrew: boolean;
}

export function CloseConversationDialog({
  open,
  onOpenChange,
  onClose,
  isCrew,
}: CloseConversationDialogProps) {
  const [outcome, setOutcome] = useState<string>('');

  const options = isCrew
    ? [
        { value: 'withdrew', label: 'Withdrew' },
        { value: 'not_successful', label: 'Not successful' },
      ]
    : [
        { value: 'successful_placement', label: 'Placement successful' },
        { value: 'not_successful', label: 'Not successful' },
      ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setOutcome('');
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close conversation</DialogTitle>
          <DialogDescription>
            Close this conversation? It will move to your message history.
            {isCrew && (
              <>
                <br />
                <span className="mt-1 text-xs">
                  If you are withdrawing from this role, select &quot;Withdrew&quot; as the reason.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="outcome"
                value={opt.value}
                checked={outcome === opt.value}
                onChange={() => setOutcome(opt.value)}
                className="h-4 w-4"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!outcome} onClick={() => onClose(outcome)}>
            Close conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
