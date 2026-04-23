'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Save + restore `window.scrollY` per pathname, keyed in sessionStorage.
 *
 * Why this exists: Next.js App Router scrolls to top on every client
 * navigation (including programmatic `router.push`), and even on browser
 * back/forward the list content often hasn't hydrated by the time the
 * browser tries to restore scroll — so it clamps to 0. Users scroll a
 * long list, tap into a detail, hit Back, and land at the top. Annoying.
 *
 * Pattern:
 * - On mount, AFTER `ready` flips true, read the saved offset and scroll.
 *   Gate on `ready` so we don't scroll while the list is still skeleton-
 *   rendered (scrollable area would be 0 tall).
 * - On unmount, persist the current `scrollY` so the next visit to the
 *   same pathname can restore it. Saved value is cleared after restore.
 *
 * Scope: handles client-side SPA navigation within the same tab. Browser
 * reloads and forward-nav to the same page start fresh (as intended —
 * you opened it from scratch).
 *
 * Usage:
 *   const { isLoading } = useSafeFetch(...);
 *   useScrollRestoration(!isLoading);
 */
export function useScrollRestoration(ready: boolean) {
  const pathname = usePathname();
  const key = `dw:scroll:${pathname}`;

  // Restore once ready
  useEffect(() => {
    if (!ready) return;
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!Number.isNaN(y) && y > 0) {
        // requestAnimationFrame lets the layout settle once before scrolling.
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
      sessionStorage.removeItem(key);
    }
  }, [ready, key]);

  // Save scroll on unmount (client-side nav away) + on beforeunload (tab close)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const save = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };
    window.addEventListener('beforeunload', save);
    return () => {
      save();
      window.removeEventListener('beforeunload', save);
    };
  }, [key]);
}
