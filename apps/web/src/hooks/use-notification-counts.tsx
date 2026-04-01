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

  useEffect(() => {
    let cancelled = false;
    safeFetch<{
      notification_count?: number;
      message_count?: number;
      alt_notification_count?: number;
      alt_message_count?: number;
    }>('/api/notifications/count').then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCounts({
          notificationCount: result.data.notification_count ?? 0,
          messageCount: result.data.message_count ?? 0,
          altNotificationCount: result.data.alt_notification_count ?? 0,
          altMessageCount: result.data.alt_message_count ?? 0,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const value: NotificationCounts = { ...counts, refresh };

  return <NotificationCountsContext value={value}>{children}</NotificationCountsContext>;
}

export function useNotificationCounts(): NotificationCounts {
  return useContext(NotificationCountsContext);
}
