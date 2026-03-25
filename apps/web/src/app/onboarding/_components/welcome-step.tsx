'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ChevronRight } from 'lucide-react';

export interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Image
          src="/images/brand/dw_app_icon_cropped.png"
          alt="DockWalker"
          width={80}
          height={80}
          className="rounded-2xl"
        />

        <div className="w-full overflow-hidden rounded-[14px] border border-[var(--border)]">
          <Image
            src="/images/onboarding/hero-lounge.jpg"
            alt="Yacht interior"
            width={800}
            height={448}
            className="h-[200px] w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
          />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to DockWalker</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The fast, structured dispatch layer for superyacht daywork. We connect crew seeking
            short-term work with employers who need immediate cover — no noise, no politics, no
            hidden algorithms.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
            <span>Apply to daywork in seconds</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
            <span>Structured, transparent hiring</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sea" />
            <span>Built for the superyacht industry</span>
          </div>
        </div>

        <Button onClick={onNext} className="w-full" size="lg">
          Get started
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
