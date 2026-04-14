'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface UserRow {
  person_id: string;
  display_name: string;
  identity_type: string;
  persons: {
    current_hat: string;
    is_admin: boolean;
    blocked_at: string | null;
    last_event_at: string | null;
  };
  created_at: string;
}

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

  function statusBadge(user: UserRow) {
    if (user.persons?.blocked_at) return <Badge variant="destructive">Blocked</Badge>;
    if (user.persons?.is_admin) return <Badge>Admin</Badge>;
    return null;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <Input
        placeholder="Search by name..."
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
          <p className="mb-2 text-sm text-muted-foreground">{total} users</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Hat</th>
                <th className="pb-2">Created</th>
                <th className="pb-2">Last Active</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.person_id} className="border-b hover:bg-muted/50">
                  <td className="py-2">
                    <Link href={`/admin/users/${u.person_id}`} className="text-primary underline">
                      {u.display_name}
                    </Link>
                  </td>
                  <td className="py-2">{u.identity_type}</td>
                  <td className="py-2">{u.persons?.current_hat}</td>
                  <td className="py-2">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2">
                    {u.persons?.last_event_at
                      ? new Date(u.persons.last_event_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-2">{statusBadge(u)}</td>
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
              disabled={users.length < 20}
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
