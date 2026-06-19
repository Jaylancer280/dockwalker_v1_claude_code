'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotificationCounts } from '@/hooks/use-notification-counts';

export function NotificationBell() {
  const { notificationCount } = useNotificationCounts();

  return (
    <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground">
      <Bell className="h-5 w-5" />
      {notificationCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
          {notificationCount > 99 ? '99+' : notificationCount}
        </span>
      )}
    </Link>
  );
}
