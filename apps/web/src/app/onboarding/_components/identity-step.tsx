'use client';

import { Anchor, Building2, ChevronLeft, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type IdentityType = 'crew' | 'agent';

export interface IdentityStepProps {
  onBack: () => void;
  onSelectCrew: () => void;
  onSelectAgent: () => void;
  setIdentityType: (type: IdentityType) => void;
  setExperienceLevel: (level: null) => void;
}

export function IdentityStep({
  onBack,
  onSelectCrew,
  onSelectAgent,
  setIdentityType,
  setExperienceLevel,
}: IdentityStepProps) {
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
          <h1 className="text-xl font-bold tracking-tight">How will you use DockWalker?</h1>
          <p className="text-sm text-muted-foreground">
            Pick the one that fits. Crew can switch between applying for work and hiring crew —
            agents cannot switch to crew.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Crew card */}
          <button
            onClick={() => {
              setIdentityType('crew');
              onSelectCrew();
            }}
            className="flex w-full items-start gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Anchor className="h-6 w-6" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <p className="font-semibold">I work on yachts</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  <span>Apply for daywork and permanent jobs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  <span>Hire crew if you run a vessel (switch hats anytime)</span>
                </li>
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Best for: deckhands, stews, mates, engineers, captains
              </p>
            </div>
          </button>

          {/* Agent card */}
          <button
            onClick={() => {
              setIdentityType('agent');
              setExperienceLevel(null);
              onSelectAgent();
            }}
            className="flex w-full items-start gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">I hire crew on behalf of others</p>
                <Badge
                  variant="outline"
                  className="shrink-0 border-[var(--warning)]/40 bg-[var(--warning-lo)] text-[var(--warning)]"
                >
                  One-way choice
                </Badge>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  <span>Post daywork and permanent roles</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                  <span>Review and shortlist candidates</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                  <span className="text-muted-foreground">
                    You won&apos;t be applying for jobs — ever
                  </span>
                </li>
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Best for: crew agencies, recruiters, yacht management firms
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
