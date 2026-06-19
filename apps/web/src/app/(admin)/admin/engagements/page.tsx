'use client';

import { useState } from 'react';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Badge } from '@/components/ui/badge';

interface EngagementRow {
  id: string;
  status: string;
  type: string;
  crew_name: string;
  employer_name: string;
  start_date: string;
  end_date: string;
  days_active: number;
  created_at: string;
  cancelled_by: string | null;
}

export default function AdminEngagementsPage() {
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const { data, isLoading } = useSafeFetch<{ engagements: EngagementRow[]; total: number }>(
    `/api/admin/engagements?${params}`,
  );

  const engagements = data?.engagements ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Engagements</h1>
      <div className="mb-4 flex gap-2">
        {['', 'active', 'completed', 'cancelled', 'closed'].map((s) => (
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
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{total} engagements</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Crew</th>
                <th className="pb-2">Employer</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Dates</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Days</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/50">
                  <td className="py-2">{e.crew_name}</td>
                  <td className="py-2">{e.employer_name}</td>
                  <td className="py-2">
                    <Badge variant="outline">{e.type}</Badge>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {e.start_date} — {e.end_date}
                  </td>
                  <td className="py-2">
                    <Badge
                      variant={
                        e.status === 'active'
                          ? 'default'
                          : e.status === 'cancelled'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {e.status}
                      {e.cancelled_by ? ` (${e.cancelled_by})` : ''}
                    </Badge>
                  </td>
                  <td className="py-2">{e.days_active}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
