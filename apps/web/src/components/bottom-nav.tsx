'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageSquare, User, PenSquare, Briefcase } from 'lucide-react';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badgeKey?: 'messages';
}

const crewNav: NavItem[] = [
  { icon: Compass, label: 'Discover', href: '/discover' },
  { icon: MessageSquare, label: 'Messages', href: '/messages', badgeKey: 'messages' },
  { icon: User, label: 'Profile', href: '/profile' },
];

const employerNav: NavItem[] = [
  { icon: PenSquare, label: 'Post Job', href: '/daywork/post' },
  { icon: Briefcase, label: 'My Jobs', href: '/daywork/mine' },
  { icon: MessageSquare, label: 'Messages', href: '/messages', badgeKey: 'messages' },
  { icon: User, label: 'Profile', href: '/profile' },
];

interface BottomNavProps {
  currentHat: string;
  identityType: string;
}

export function BottomNav({ currentHat }: BottomNavProps) {
  const pathname = usePathname();
  const items = currentHat === 'crew' ? crewNav : employerNav;
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {
      // swallow — badge is non-critical
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center justify-around">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.badgeKey === 'messages' && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] transition-colors ${
                isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
