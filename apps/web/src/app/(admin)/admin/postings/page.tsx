'use client';

import { useState } from 'react';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Badge } from '@/components/ui/badge';

interface PostingRow {
  type: string;
  id: string;
  status: string;
  created_at: string;
  poster_name: string;
}

export default function AdminPostingsPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);

  const { data, isLoading } = useSafeFetch<{ postings: PostingRow[] }>(
    `/api/admin/postings?${params}`,
  );

  const postings = data?.postings ?? [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Postings</h1>
      <div className="mb-4 flex gap-4">
        <div className="flex gap-2">
          {['', 'daywork', 'permanent'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded border px-3 py-1 text-sm ${type === t ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {t || 'All types'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['', 'active', 'in_progress', 'completed', 'cancelled', 'filled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded border px-3 py-1 text-sm ${status === s ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {s || 'All statuses'}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Type</th>
              <th className="pb-2">Poster</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Created</th>
              <th className="pb-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((p) => (
              <tr key={`${p.type}-${p.id}`} className="border-b hover:bg-muted/50">
                <td className="py-2">
                  <Badge variant="outline">{p.type}</Badge>
                </td>
                <td className="py-2">{p.poster_name}</td>
                <td className="py-2">
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                </td>
                <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="py-2 font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
