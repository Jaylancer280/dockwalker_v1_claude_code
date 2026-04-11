'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { safeFetch } from '@/lib/safe-fetch';

/**
 * SWR-powered hook wrapping safeFetch for stale-while-revalidate caching.
 * Shows cached data immediately on re-navigation, revalidates in background.
 */
export function useSafeFetch<T = unknown>(url: string | null, options?: SWRConfiguration) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    url,
    async (fetchUrl: string) => {
      const result = await safeFetch<T>(fetchUrl);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      shouldRetryOnError: (err: Error) => {
        // Don't retry on 401 — safeFetch is already redirecting to login
        if (err.message === 'Session expired') return false;
        return true;
      },
      ...options,
    },
  );

  return {
    data: data ?? null,
    error: error ? (error as Error).message : null,
    isLoading,
    isValidating,
    mutate,
  };
}
