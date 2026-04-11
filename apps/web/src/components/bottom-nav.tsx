'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageSquare, User, PenSquare, Briefcase, LifeBuoy } from 'lucide-react';
import { useNotificationCounts } from '@/hooks/use-notification-counts';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badgeKey?: 'messages';
}

const crewNav: NavItem[] = [
  { icon: Compass, label: 'Opportunities', href: '/discover' },
  { icon: MessageSquare, label: 'Messages', href: '/messages', badgeKey: 'messages' },
  { icon: LifeBuoy, label: 'Docky', href: '/docky' },
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
  const { messageCount } = useNotificationCounts();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center justify-around">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.badgeKey === 'messages' && messageCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                isActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--muted-foreground)]'
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-[var(--accent)] px-0.5 font-mono text-[10px] font-bold text-white">
                    {messageCount > 99 ? '99+' : messageCount}
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
