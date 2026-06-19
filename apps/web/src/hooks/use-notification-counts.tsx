'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { safeFetch } from '@/lib/safe-fetch';

interface NotificationCounts {
  notificationCount: number;
  messageCount: number;
  altNotificationCount: number;
  altMessageCount: number;
  refresh: () => void;
}

const defaultCounts: NotificationCounts = {
  notificationCount: 0,
  messageCount: 0,
  altNotificationCount: 0,
  altMessageCount: 0,
  refresh: () => {},
};

const NotificationCountsContext = createContext<NotificationCounts>(defaultCounts);

export function NotificationCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState({
    notificationCount: 0,
    messageCount: 0,
    altNotificationCount: 0,
    altMessageCount: 0,
  });

  const refresh = useCallback(async () => {
    const result = await safeFetch<{
      notification_count?: number;
      message_count?: number;
      alt_notification_count?: number;
      alt_message_count?: number;
    }>('/api/notifications/count');
    if (result.ok) {
      setCounts({
        notificationCount: result.data.notification_count ?? 0,
        messageCount: result.data.message_count ?? 0,
        altNotificationCount: result.data.alt_notification_count ?? 0,
        altMessageCount: result.data.alt_message_count ?? 0,
      });
    }
  }, []);

  // Defer initial fetch so it doesn't compete with page data loading for network bandwidth
  useEffect(() => {
    let cancelled = false;
    const defer =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 2000);
    const cancel =
      typeof cancelIdleCallback === 'function'
        ? cancelIdleCallback
        : (id: number) => clearTimeout(id);

    const id = defer(() => {
      if (cancelled) return;
      refresh();
    });
    return () => {
      cancelled = true;
      cancel(id as number);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let lastRefreshAt = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    const COOLDOWN_MS = 30_000;

    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const elapsed = now - lastRefreshAt;
      if (elapsed >= COOLDOWN_MS) {
        lastRefreshAt = now;
        refresh();
        return;
      }
      if (pendingTimer) return;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        lastRefreshAt = Date.now();
        refresh();
      }, COOLDOWN_MS - elapsed);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [refresh]);

  const value: NotificationCounts = { ...counts, refresh };

  return <NotificationCountsContext value={value}>{children}</NotificationCountsContext>;
}

export function useNotificationCounts(): NotificationCounts {
  return useContext(NotificationCountsContext);
}
