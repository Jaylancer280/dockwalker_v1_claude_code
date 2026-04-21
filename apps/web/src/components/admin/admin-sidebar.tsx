'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/engagements', label: 'Engagements' },
  { href: '/admin/postings', label: 'Postings' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/canonical', label: 'Canonical' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-muted/40 p-4">
      <Link href="/admin" className="mb-6 text-lg font-bold">
        DW Admin
      </Link>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-4 border-t">
        <Link
          href="/discover"
          className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Back to App
        </Link>
      </div>
    </nav>
  );
}
