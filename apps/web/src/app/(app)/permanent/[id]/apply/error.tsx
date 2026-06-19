'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PermanentApplyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { area: 'permanent-apply' } });
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Could not load this role</h1>
        <p className="text-sm text-muted-foreground">
          The posting may have been removed or filled. Browse other permanent roles in the meantime.
        </p>
        <div className="flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/discover">Browse roles</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
