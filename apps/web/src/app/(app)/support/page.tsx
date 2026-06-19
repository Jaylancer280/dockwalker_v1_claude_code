'use client';

import { useState } from 'react';
import Link from 'next/link';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Thread {
  id: string;
  subject: string | null;
  status: string;
  is_admin_initiated: boolean;
  created_at: string;
  updated_at: string;
}

export default function SupportPage() {
  const { showError } = useToast();
  const { data, isLoading, mutate } = useSafeFetch<{ threads: Thread[] }>('/api/support');
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const threads = data?.threads ?? [];

  async function handleCreate() {
    if (!content.trim()) return;
    setSending(true);
    const res = await safeFetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim() || undefined, content: content.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setShowNew(false);
      setSubject('');
      setContent('');
      mutate();
    } else {
      showError(res.error ?? 'Failed to create thread');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support</h1>
        <Button onClick={() => setShowNew(!showNew)}>{showNew ? 'Cancel' : 'New Message'}</Button>
      </div>

      {showNew && (
        <div className="mb-6 rounded-lg border p-4">
          <Input
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mb-2"
          />
          <textarea
            placeholder="How can we help?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mb-2 w-full rounded border p-2 text-sm"
            rows={4}
          />
          <Button onClick={handleCreate} disabled={sending || !content.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : threads.length === 0 ? (
        <p className="text-muted-foreground">No support threads yet.</p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{t.subject ?? 'Support thread'}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>{t.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
