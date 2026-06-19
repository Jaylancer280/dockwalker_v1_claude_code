'use client';

import { useState } from 'react';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Input } from '@/components/ui/input';

interface EventRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  person_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export default function AdminEventsPage() {
  const [personId, setPersonId] = useState('');
  const [eventType, setEventType] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 50;

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (personId) params.set('person_id', personId);
  if (eventType) params.set('event_type', eventType);

  const { data, isLoading } = useSafeFetch<{ events: EventRow[]; total: number }>(
    `/api/admin/events?${params}`,
  );

  const events = data?.events ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Event Log</h1>
      <div className="mb-4 flex gap-4">
        <Input
          placeholder="Person ID..."
          value={personId}
          onChange={(e) => {
            setPersonId(e.target.value);
            setOffset(0);
          }}
          className="max-w-xs"
        />
        <Input
          placeholder="Event type (e.g. DAYWORK.POSTED)..."
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setOffset(0);
          }}
          className="max-w-xs"
        />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">{total} events</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Time</th>
                <th className="pb-2">Event</th>
                <th className="pb-2">Aggregate</th>
                <th className="pb-2">Person</th>
                <th className="pb-2">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr
                  key={evt.id}
                  className="cursor-pointer border-b hover:bg-muted/50"
                  onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                >
                  <td className="py-1 whitespace-nowrap">
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                  <td className="py-1 font-mono text-xs">{evt.event_type}</td>
                  <td className="py-1">{evt.aggregate_type}</td>
                  <td className="py-1 font-mono text-xs">{evt.person_id?.slice(0, 8) ?? '—'}</td>
                  <td className="py-1 text-xs text-muted-foreground">
                    {expanded === evt.id ? (
                      <pre className="max-w-lg whitespace-pre-wrap">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    ) : (
                      <span className="max-w-xs truncate block">
                        {JSON.stringify(evt.payload).slice(0, 80)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset <= 0}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <button
              onClick={() => setOffset((o) => o + limit)}
              disabled={offset + limit >= total}
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
