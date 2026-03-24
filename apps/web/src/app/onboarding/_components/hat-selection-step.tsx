'use client';

import { ChevronLeft, Loader2, Ship, User } from 'lucide-react';

type HatType = 'crew' | 'employer' | 'agent';

export interface HatSelectionStepProps {
  loading: boolean;
  error: string | null;
  hat: HatType | null;
  skipping: boolean;
  experienceLevel: 'green' | 'experienced' | null;

  setHat: (v: HatType | null) => void;
  setSkipping: (v: boolean) => void;
  onBack: () => void;
  onSelect: (hat: HatType) => void;
}

export function HatSelectionStep(props: HatSelectionStepProps) {
  const { loading, error, hat, skipping, setHat, setSkipping, onBack, onSelect } = props;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <button
          onClick={() => {
            if (skipping) {
              setSkipping(false);
              onBack();
            } else {
              onBack();
            }
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div>
          <h1 className="text-xl font-bold tracking-tight">How are you using DockWalker?</h1>
          <p className="text-sm text-muted-foreground">You can switch between these anytime</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setHat('crew');
              onSelect('crew');
            }}
            disabled={loading}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sea text-white">
              {loading && hat === 'crew' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold">Looking for daywork</p>
              <p className="text-sm text-muted-foreground">
                {loading && hat === 'crew'
                  ? 'Setting up your profile...'
                  : 'Browse and apply to jobs'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setHat('employer');
              onSelect('employer');
            }}
            disabled={loading}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-light text-white">
              {loading && hat === 'employer' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Ship className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold">Looking to hire crew</p>
              <p className="text-sm text-muted-foreground">
                {loading && hat === 'employer'
                  ? 'Setting up your profile...'
                  : 'Post daywork and find crew'}
              </p>
            </div>
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
