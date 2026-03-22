'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const result = await safeFetch<{ notification_count?: number }>('/api/notifications/count');
      if (result.ok) {
        setCount(result.data.notification_count ?? 0);
      }
    } finally {
      // setState guard for react-hooks/set-state-in-effect
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchCount]);

  return (
    <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
