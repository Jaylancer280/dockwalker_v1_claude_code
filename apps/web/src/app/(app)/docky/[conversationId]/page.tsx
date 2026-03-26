'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, SendHorizontal, LifeBuoy, ChevronDown, Lock } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProfileChips } from '@/hooks/use-profile-chips';
import { useDockyReadiness } from '@/hooks/use-docky-readiness';
import DOMPurify from 'dompurify';
import { safeFetch } from '@/lib/safe-fetch';

interface Source {
  document: string;
  section: string | null;
  url: string | null;
  relevance: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[] | null;
  created_at: string;
}

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>');

  // Paragraphs
  html = html.replace(/\n\n/g, '<br/><br/>');

  return DOMPurify.sanitize(html);
}

export default function DockyConversationPage() {
  const router = useRouter();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { showError } = useToast();

  const suggestionChips = useProfileChips();
  const dockyReadiness = useDockyReadiness();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<'profile' | 'thinking' | null>(null);
  const [input, setInput] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [title, setTitle] = useState('Docky');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Staged thinking indicator: "reading profile" → "thinking"
  useEffect(() => {
    if (sending) {
      setThinkingPhase('profile');
      const timer = setTimeout(() => setThinkingPhase('thinking'), 1000);
      return () => clearTimeout(timer);
    } else {
      setThinkingPhase(null);
    }
  }, [sending]);

  useEffect(() => {
    async function load() {
      try {
        const result = await safeFetch<{ messages?: Message[] }>(
          `/api/advisor/conversations/${conversationId}/messages`,
        );
        if (result.ok) {
          setMessages(result.data.messages ?? []);
        } else {
          showError('Failed to load messages');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId, showError]);

  async function sendMessage(content: string) {
    if (!content.trim() || sending || limitReached) return;

    const trimmed = content.trim();
    setInput('');
    setSending(true);

    // Set title from first message
    if (messages.length === 0) {
      setTitle(trimmed.slice(0, 40));
    }

    const result = await safeFetch<{
      id: string;
      content: string;
      sources?: Source[] | null;
      created_at: string;
    }>(`/api/advisor/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    });

    if (!result.ok && result.error === 'limit_reached') {
      // Don't add user message — it wasn't saved server-side
      setLimitReached(true);
      setSending(false);
      return;
    }

    // User message was saved — add it to local state
    const now = new Date();
    const userMsg: Message = {
      id: `temp-${crypto.randomUUID()}`,
      role: 'user',
      content: trimmed,
      created_at: now.toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (!result.ok) {
      if (result.error.includes('temporarily unavailable')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${crypto.randomUUID()}`,
            role: 'assistant',
            content:
              'Docky is temporarily unavailable. Your question has been saved — try sending again.',
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        showError('Failed to send message');
      }
      setSending(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: result.data.id,
        role: 'assistant',
        content: result.data.content,
        sources: result.data.sources,
        created_at: result.data.created_at,
      },
    ]);
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center pb-[var(--nav-height)]">
        <LoadingSpinner size="md" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pb-[var(--nav-height)]">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-[var(--surface)] px-2 py-3">
        <button
          onClick={() => router.push('/docky')}
          className="rounded-full p-1 transition-colors hover:bg-[var(--accent-lo)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-semibold">{title}</h1>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center pt-12 text-center">
            <LifeBuoy className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-6 text-sm text-muted-foreground">
              Ask Docky about certifications, career paths, or training requirements.
            </p>
            <div className="grid w-full grid-cols-2 gap-2">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--accent-lo)]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm text-white">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="mt-1 shrink-0">
                    <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex max-w-[85%] flex-col gap-1">
                    <div
                      className="rounded-2xl bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 text-sm"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.content),
                      }}
                    />
                    <SourcesCollapsible sources={msg.sources} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-2">
              <div className="mt-1 shrink-0">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1">
                  {thinkingPhase === 'profile'
                    ? !dockyReadiness.ready
                      ? 'Docky works best with a complete profile \u2014 add your certs and role for personalised advice'
                      : 'Docky is reading your profile'
                    : 'Docky is thinking'}
                  <span className="inline-flex gap-0.5">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
                      .
                    </span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
                      .
                    </span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
                      .
                    </span>
                  </span>
                </span>
              </div>
            </div>
          )}

          {limitReached && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6 text-center">
              <div className="relative">
                <LifeBuoy className="h-10 w-10 text-muted-foreground" />
                <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                You&apos;ve used your 3 free questions this month
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade to Crew Pro for unlimited access to Docky
              </p>
              <Button onClick={() => router.push('/billing')} className="w-full">
                Upgrade
              </Button>
              <button
                onClick={() => router.push('/billing')}
                className="text-xs text-muted-foreground underline"
              >
                View plans
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-[var(--nav-height)] border-t border-border bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={limitReached ? 'Upgrade to continue...' : 'Ask Docky...'}
            maxLength={500}
            disabled={sending || limitReached}
            className="flex-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending || limitReached}
            className="rounded-full bg-[var(--accent)] p-2.5 text-white transition-colors hover:brightness-[1.08] disabled:opacity-50"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}

function SourcesCollapsible({ sources }: { sources?: Source[] | null }) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        Sources ({sources.length})
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-0.5 pl-4">
          {sources.map((s, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {s.document}
                  {s.section ? ` — ${s.section}` : ''}
                </a>
              ) : (
                <span>
                  {s.document}
                  {s.section ? ` — ${s.section}` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
