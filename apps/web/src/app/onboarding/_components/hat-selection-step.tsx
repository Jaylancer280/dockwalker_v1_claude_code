'use client';

import Image from 'next/image';
import { ChevronLeft, Loader2 } from 'lucide-react';

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
      <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-lg">
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
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)] disabled:opacity-50"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              {loading && hat === 'crew' ? (
                <div className="flex h-full w-full items-center justify-center bg-[var(--accent)]">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              ) : (
                <Image
                  src="/images/onboarding/crew-rope.jpg"
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
                />
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
            className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--border-hi)] disabled:opacity-50"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              {loading && hat === 'employer' ? (
                <div className="flex h-full w-full items-center justify-center bg-[var(--accent)]">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              ) : (
                <Image
                  src="/images/onboarding/vessel-helm-chair.jpg"
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
                />
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
