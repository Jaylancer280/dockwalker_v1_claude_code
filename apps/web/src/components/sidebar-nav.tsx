'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  MessageSquare,
  User,
  PenSquare,
  Briefcase,
  LifeBuoy,
  LogOut,
  Settings,
} from 'lucide-react';
import { HatSwitcher } from '@/components/hat-switcher';
import { NotificationBell } from '@/components/notification-bell';
import { useNotificationCounts } from '@/hooks/use-notification-counts';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badgeKey?: 'messages';
}

const crewNav: NavItem[] = [
  { icon: Compass, label: 'Discover', href: '/discover' },
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

interface SidebarNavProps {
  currentHat: string;
  identityType: string;
}

export function SidebarNav({ currentHat, identityType }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = currentHat === 'crew' ? crewNav : employerNav;
  const { messageCount } = useNotificationCounts();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar)] md:flex">
      <div className="flex h-14 items-center px-5">
        <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          DockWalker
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.badgeKey === 'messages' && messageCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-primary)]'
                  : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]'
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
        <Link
          href="/settings"
          prefetch={true}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname === '/settings' || pathname.startsWith('/settings/')
              ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-primary)]'
              : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]'
          }`}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </nav>

      <div className="flex flex-col gap-2 border-t border-[var(--sidebar-border)] px-3 py-3">
        <div className="flex items-center justify-between px-1">
          <HatSwitcher currentHat={currentHat} identityType={identityType} />
          <NotificationBell />
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-foreground)] transition-colors hover:bg-[var(--sidebar-accent)]"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
