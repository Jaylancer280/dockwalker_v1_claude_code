'use client';

import { Briefcase, Clock } from 'lucide-react';

interface PostingTypeSelectorProps {
  onSelect: (type: 'daywork' | 'permanent') => void;
}

export function PostingTypeSelector({ onSelect }: PostingTypeSelectorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-bold">What type of position?</h1>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          onClick={() => onSelect('daywork')}
          className="flex items-center gap-4 rounded-xl border-2 border-border bg-card p-6 text-left transition-colors hover:border-primary"
        >
          <Clock className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <div className="text-lg font-semibold">Daywork</div>
            <div className="text-sm text-muted-foreground">
              Short-term cover, 1-14 days, hire today
            </div>
          </div>
        </button>
        <button
          onClick={() => onSelect('permanent')}
          className="flex items-center gap-4 rounded-xl border-2 border-border bg-card p-6 text-left transition-colors hover:border-primary"
        >
          <Briefcase className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <div className="text-lg font-semibold">Permanent</div>
            <div className="text-sm text-muted-foreground">
              Long-term position, structured hiring with shortlist
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
