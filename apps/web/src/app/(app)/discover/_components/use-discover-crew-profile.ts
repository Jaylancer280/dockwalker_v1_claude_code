'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { safeFetch } from '@/lib/safe-fetch';

/**
 * Loads crew certs / languages (used by Browse cards for pill
 * colouring) AND handles the agent / employer redirect that bounces
 * non-crew off this page. Also owns the availability gate state and
 * the visibility-change refresh listener.
 *
 * Lives outside the DiscoverDataProvider because it touches the
 * window/document APIs and uses startTransition for the initial
 * deferred fetch — keeping it as a hook lets the page mount the
 * provider above its own redirect short-circuit.
 */
export function useDiscoverCrewProfile() {
  const [crewCertIds, setCrewCertIds] = useState<string[] | null>(null);
  const [crewLangs, setCrewLangs] = useState<string[] | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const [hasAvailability, setHasAvailability] = useState<boolean | null>(null);
  const lastAvailCheckRef = useRef<number>(0);

  const checkAvailability = useCallback(async () => {
    try {
      const result = await safeFetch<{ status: string }>('/api/availability');
      if (result.ok) {
        setHasAvailability(result.data.status === 'available');
        lastAvailCheckRef.current = Date.now();
      }
    } catch {
      // safeFetch never throws, but try/catch keeps the React-compiler lint happy
    }
  }, []);

  const loadCrewCerts = useCallback(async () => {
    const result = await safeFetch<{
      profile?: {
        display_name?: string;
        certification_ids?: string[];
        languages?: string[];
        nationality_id?: string | null;
        primary_role_id?: string | null;
      };
      person?: { identity_type?: string; current_hat?: string };
      email?: string;
    }>('/api/profile');
    if (result.ok && result.data.profile?.certification_ids) {
      setCrewCertIds(result.data.profile.certification_ids);
    } else if (result.ok) {
      setCrewCertIds([]);
    }
    if (result.ok) {
      setCrewLangs(result.data.profile?.languages ?? []);
    }
    if (result.ok && result.data.person?.identity_type === 'agent') {
      setRedirecting(true);
      window.location.href = '/discover/market';
      return;
    }
    if (result.ok && result.data.person?.current_hat === 'employer') {
      setRedirecting(true);
      window.location.href = '/daywork/mine';
      return;
    }
  }, []);

  // Initial load — deferred so it doesn't block first paint of the cards
  useEffect(() => {
    startTransition(() => {
      loadCrewCerts();
      checkAvailability();
    });
  }, [loadCrewCerts, checkAvailability]);

  // Re-fetch on tab focus — keeps availability fresh after a user
  // returns to the page from another tab.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadCrewCerts();
        checkAvailability();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadCrewCerts, checkAvailability]);

  return {
    crewCertIds,
    crewLangs,
    redirecting,
    hasAvailability,
    setHasAvailability,
    checkAvailability,
    lastAvailCheckRef,
  };
}
