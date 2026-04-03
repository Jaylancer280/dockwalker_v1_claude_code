'use client';

import { Anchor, Building2, ChevronLeft } from 'lucide-react';

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
          <h1 className="text-xl font-bold tracking-tight">Tell us about yourself</h1>
          <p className="text-sm text-muted-foreground">
            This determines your onboarding experience
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setIdentityType('crew');
              onSelectCrew();
            }}
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Anchor className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">I&apos;m Crew</p>
              <p className="text-sm text-muted-foreground">
                Currently onboard or looking for daywork
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setIdentityType('agent');
              setExperienceLevel(null);
              onSelectAgent();
            }}
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">I&apos;m an Agency Agent</p>
              <p className="text-sm text-muted-foreground">I hire crew on behalf of vessels</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                You&apos;ll post jobs on behalf of vessels. This cannot be changed — agents cannot
                apply for jobs or switch to a crew profile.
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
