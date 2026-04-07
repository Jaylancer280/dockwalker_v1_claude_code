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
    const rIC =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 0) as unknown as number;
    const cIC = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;
    const id = rIC(() => setMounted(true));
    return () => cIC(id);
  }, []);

  if (!mounted) return null;
  return <>{children}</>;
}
