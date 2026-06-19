'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { safeFetch } from '@/lib/safe-fetch';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  sender_person_id: string | null;
  is_platform: boolean;
  content: string;
  created_at: string;
}

interface Thread {
  id: string;
  subject: string | null;
  status: string;
}

export default function SupportThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { data, isLoading, mutate } = useSafeFetch<{ thread: Thread; messages: Message[] }>(
    `/api/support/${threadId}`,
  );
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const thread = data?.thread;
  const messages = data?.messages ?? [];
  const isClosed = thread?.status === 'closed';

  async function handleSend() {
    if (!content.trim() || isClosed) return;
    setSending(true);
    await safeFetch(`/api/support/${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim() }),
    });
    setSending(false);
    setContent('');
    mutate();
  }

  if (isLoading) return <p className="p-6 text-muted-foreground">Loading...</p>;
  if (!thread) return <p className="p-6 text-destructive">Thread not found</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col p-6" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{thread.subject ?? 'Support'}</h1>
        <Badge variant={isClosed ? 'secondary' : 'default'}>{thread.status}</Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg p-3 text-sm ${
              m.is_platform ? 'mr-auto bg-muted' : 'ml-auto bg-primary text-primary-foreground'
            }`}
          >
            <p className="mb-1 text-xs opacity-70">
              {m.is_platform ? 'DockWalker' : 'You'} · {new Date(m.created_at).toLocaleTimeString()}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>

      {isClosed ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">This thread is closed.</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <textarea
            placeholder="Type your message..."
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
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
