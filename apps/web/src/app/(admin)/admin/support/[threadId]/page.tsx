'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  sender_person_id: string | null;
  is_platform: boolean;
  content: string;
  created_at: string;
}

interface Thread {
  id: string;
  person_id: string;
  user_name: string;
  subject: string | null;
  status: string;
}

export default function AdminSupportThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { showSuccess, showError } = useToast();
  const { data, isLoading, mutate } = useSafeFetch<{ thread: Thread; messages: Message[] }>(
    `/api/admin/support/${threadId}`,
  );
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const thread = data?.thread;
  const messages = data?.messages ?? [];
  const isClosed = thread?.status === 'closed';

  async function handleSend() {
    if (!content.trim() || isClosed) return;
    setSending(true);
    const res = await safeFetch(`/api/admin/support/${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setContent('');
      mutate();
    } else {
      showError('Failed to send');
    }
  }

  async function handleClose() {
    const res = await safeFetch(`/api/admin/support/${threadId}/close`, { method: 'POST' });
    if (res.ok) {
      showSuccess('Thread closed');
      mutate();
    } else {
      showError('Failed to close');
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!thread) return <p className="text-destructive">Thread not found</p>;

  return (
    <div className="flex max-w-4xl flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{thread.subject ?? 'Support'}</h1>
          <p className="text-sm text-muted-foreground">
            User:{' '}
            <Link href={`/admin/users/${thread.person_id}`} className="text-primary underline">
              {thread.user_name}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isClosed ? 'secondary' : 'default'}>{thread.status}</Badge>
          {!isClosed && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              Close Thread
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-3 overflow-auto rounded border p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg p-3 text-sm ${
              m.is_platform ? 'ml-auto bg-primary text-primary-foreground' : 'mr-auto bg-muted'
            }`}
          >
            <p className="mb-1 text-xs opacity-70">
              {m.is_platform ? 'DockWalker (you)' : thread.user_name} ·{' '}
              {new Date(m.created_at).toLocaleTimeString()}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>

      {isClosed ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">Thread closed.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <textarea
            placeholder="Reply as DockWalker..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 rounded border p-2 text-sm"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={sending || !content.trim()}>
            {sending ? 'Sending...' : 'Send as DockWalker'}
          </Button>
        </div>
      )}
    </div>
  );
}
