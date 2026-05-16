'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface UserRow {
  person_id: string;
  email: string | null;
  display_name: string | null;
  identity_type: string | null;
  location_port_id: string | null;
  created_at: string | null;
  onboarding_complete: boolean;
  email_confirmed: boolean;
  auth_banned: boolean;
  persons: {
    current_hat: string;
    is_admin: boolean;
    blocked_at: string | null;
    deactivated_at: string | null;
    last_event_at: string | null;
  } | null;
}

const PER_PAGE = 20;

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);

  const { data, isLoading } = useSafeFetch<{ users: UserRow[]; total: number }>(
    `/api/admin/users?${params}`,
  );

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const isLastPage = page * PER_PAGE >= total;

  function emailPrefix(email: string | null): string {
    if (!email) return 'Unknown';
    return email.split('@')[0];
  }

  function statusBadges(user: UserRow) {
    const badges = [];
    if (!user.onboarding_complete)
      badges.push(
        <Badge key="i" variant="secondary">
          Incomplete onboarding
        </Badge>,
      );
    if (!user.email_confirmed)
      badges.push(
        <Badge key="u" variant="outline">
          Unverified
        </Badge>,
      );
    if (user.persons?.blocked_at)
      badges.push(
        <Badge key="b" variant="destructive">
          Blocked
        </Badge>,
      );
    if (user.persons?.deactivated_at)
      badges.push(
        <Badge key="d" variant="secondary">
          Deleted
        </Badge>,
      );
    if (user.persons?.is_admin) badges.push(<Badge key="a">Admin</Badge>);
    return badges.length > 0 ? <div className="flex flex-wrap gap-1">{badges}</div> : null;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-4 max-w-sm"
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{total} signups</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Hat</th>
                <th className="pb-2">Created</th>
                <th className="pb-2">Last Active</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.person_id}
                  className={`border-b hover:bg-muted/50 ${
                    u.onboarding_complete ? '' : 'opacity-60'
                  }`}
                >
                  <td className="py-2">
                    {u.onboarding_complete ? (
                      <Link href={`/admin/users/${u.person_id}`} className="text-primary underline">
                        {u.display_name ?? emailPrefix(u.email)}
                      </Link>
                    ) : (
                      // No persons/profiles row yet — the detail page would
                      // 404. Render plain text until ADMIN-1 PR2 wires the
                      // detail page to handle auth-only users.
                      <span className="text-muted-foreground">
                        {u.display_name ?? emailPrefix(u.email)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{u.email ?? '—'}</td>
                  <td className="py-2">{u.identity_type ?? '—'}</td>
                  <td className="py-2">{u.persons?.current_hat ?? '—'}</td>
                  <td className="py-2">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2">
                    {u.persons?.last_event_at
                      ? new Date(u.persons.last_event_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-2">{statusBadges(u)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isLastPage}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
