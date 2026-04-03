'use client';

import { ChevronLeft, Sparkles, Compass } from 'lucide-react';

type ExperienceLevel = 'green' | 'experienced';

export interface ExperienceForkStepProps {
  onBack: () => void;
  onSelect: (level: ExperienceLevel) => void;
}

export function ExperienceForkStep({ onBack, onSelect }: ExperienceForkStepProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-lg">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight">Your experience level</h1>
          <p className="text-sm text-muted-foreground">
            This helps us tailor your profile and onboarding
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect('green')}
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--success-lo)] text-[var(--success)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">New to yachting</p>
              <p className="text-sm text-muted-foreground">
                No yacht experience yet, looking to get started
              </p>
            </div>
          </button>

          <button
            onClick={() => onSelect('experienced')}
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--accent-lo)] text-[var(--accent)]">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">I have yacht experience</p>
              <p className="text-sm text-muted-foreground">
                I&apos;ve worked on one or more yachts
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
