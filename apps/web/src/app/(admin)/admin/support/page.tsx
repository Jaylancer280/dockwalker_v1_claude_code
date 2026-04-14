'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Badge } from '@/components/ui/badge';

interface SupportThread {
  id: string;
  person_id: string;
  user_name: string;
  subject: string | null;
  status: string;
  is_admin_initiated: boolean;
  updated_at: string;
}

export default function AdminSupportPage() {
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const { data, isLoading } = useSafeFetch<{ threads: SupportThread[] }>(
    `/api/admin/support?${params}`,
  );

  const threads = data?.threads ?? [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Support Inbox</h1>
      <div className="mb-4 flex gap-2">
        {['', 'open', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 text-sm ${
              status === s ? 'bg-primary text-primary-foreground' : ''
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : threads.length === 0 ? (
        <p className="text-muted-foreground">No support threads.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">User</th>
              <th className="pb-2">Subject</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id} className="border-b hover:bg-muted/50">
                <td className="py-2">
                  <Link href={`/admin/users/${t.person_id}`} className="text-primary underline">
                    {t.user_name}
                  </Link>
                </td>
                <td className="py-2">
                  <Link href={`/admin/support/${t.id}`} className="underline">
                    {t.subject ?? 'Support thread'}
                  </Link>
                  {t.is_admin_initiated && (
                    <span className="ml-2 text-xs text-muted-foreground">(admin initiated)</span>
                  )}
                </td>
                <td className="py-2">
                  <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>{t.status}</Badge>
                </td>
                <td className="py-2">{new Date(t.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
