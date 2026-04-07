'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Defers mounting children until after the initial render.
 * Non-critical providers (notification counts, call listener) mount here
 * so they don't block the first paint.
 */
export function DeferredMount({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestIdleCallback(() => setMounted(true), { timeout: 200 });
    return () => cancelIdleCallback(id);
  }, []);

  if (!mounted) return null;
  return <>{children}</>;
}
