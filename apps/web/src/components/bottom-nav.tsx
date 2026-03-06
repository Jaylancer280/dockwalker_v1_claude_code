'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageSquare, User, PenSquare, Briefcase } from 'lucide-react';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const crewNav: NavItem[] = [
  { icon: Compass, label: 'Discover', href: '/discover' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: User, label: 'Profile', href: '/profile' },
];

const employerNav: NavItem[] = [
  { icon: PenSquare, label: 'Post Job', href: '/daywork/post' },
  { icon: Briefcase, label: 'My Jobs', href: '/daywork/mine' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: User, label: 'Profile', href: '/profile' },
];

interface BottomNavProps {
  currentHat: string;
  identityType: string;
}

export function BottomNav({ currentHat }: BottomNavProps) {
  const pathname = usePathname();
  const items = currentHat === 'crew' ? crewNav : employerNav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center justify-around">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] transition-colors ${
                isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
