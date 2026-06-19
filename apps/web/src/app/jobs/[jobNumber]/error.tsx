'use client';

import { useEffect } from 'react';

export default function JobPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Public job page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        This job page couldn&apos;t be loaded. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
