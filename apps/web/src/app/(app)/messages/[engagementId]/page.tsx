'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Send, Loader2, MapPin, Calendar, EyeOff, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  sender_person_id: string;
  content: string;
  created_at: string;
}

interface EngagementContext {
  id: string;
  crew_person_id: string;
  employer_person_id: string;
  start_date: string;
  end_date: string;
  dayworks: {
    yacht_roles: { name: string } | null;
    ports: { name: string } | null;
  } | null;
  other_name: string;
}

const POLL_INTERVAL = 5000;

export default function ChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<EngagementContext | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages/${engagementId}`);
    const data = await res.json();
    if (data.messages) setMessages(data.messages);
    setLoading(false);
  }, [engagementId]);

  // Load engagement context, current user, messages, and start polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function init() {
      const [ctxRes, userRes] = await Promise.all([
        fetch(`/api/messages/${engagementId}/context`),
        fetch('/api/auth/me'),
        loadMessages(),
      ]);
      const ctxData = await ctxRes.json().catch(() => ({}));
      const userData = await userRes.json().catch(() => ({}));
      if (ctxData.engagement) setContext(ctxData.engagement);
      if (userData.userId) setUserId(userData.userId);

      // Start polling after initial load
      interval = setInterval(() => void loadMessages(), POLL_INTERVAL);
      pollRef.current = interval;
    }

    void init();
    return () => clearInterval(interval);
  }, [engagementId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const res = await fetch(`/api/messages/${engagementId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.trim() }),
    });

    if (res.ok) {
      setInput('');
      await loadMessages();
    }
    setSending(false);
  }

  async function handleCancelEngagement() {
    if (!context || !userId) return;
    const isCrew = context.crew_person_id === userId;
    const endpoint = isCrew ? 'cancel-crew' : 'cancel-employer';

    if (!confirm('Are you sure you want to cancel this engagement? This cannot be undone.')) {
      return;
    }

    setCancelling(true);
    const res = await fetch(`/api/engagements/${engagementId}/${endpoint}`, { method: 'POST' });
    if (res.ok) {
      router.push('/messages');
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to cancel');
    }
    setCancelling(false);
  }

  async function handleHide(messageId: string) {
    await fetch(`/api/messages/${engagementId}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  return (
    <main className="flex h-[calc(100svh-var(--nav-height)-env(safe-area-inset-bottom))] flex-col bg-background">
      {/* Header with engagement context */}
      <header className="shrink-0 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/messages" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{context?.other_name ?? 'Chat'}</h1>
            {context && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {context.dayworks?.yacht_roles?.name && (
                  <span>{context.dayworks.yacht_roles.name}</span>
                )}
                {context.dayworks?.ports?.name && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {context.dayworks.ports.name}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {context.start_date} — {context.end_date}
                </span>
              </div>
            )}
          </div>
          {context && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEngagement}
              disabled={cancelling}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center pt-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <p className="pt-20 text-center text-sm text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}

          {messages.map((msg) => {
            const isMine = msg.sender_person_id === userId;
            return (
              <div
                key={msg.id}
                className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-accent text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={() => handleHide(msg.id)}
                      className="invisible text-muted-foreground/40 hover:text-muted-foreground group-hover:visible"
                      title="Hide message"
                    >
                      <EyeOff className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-safe">
        <form onSubmit={handleSend} className="mx-auto flex max-w-lg items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-border bg-accent px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
