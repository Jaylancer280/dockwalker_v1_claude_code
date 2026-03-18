'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, SendHorizontal, LifeBuoy, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

const SUGGESTION_CHIPS = [
  'What certs do I need to become a Bosun?',
  'How do I get my STCW?',
  'What is the ENG1 medical?',
  'Deck officer career path',
];

function sanitiseHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=');
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

  return sanitiseHtml(html);
}

export default function DockyConversationPage() {
  const router = useRouter();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { showError } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/advisor/conversations/${conversationId}/messages`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setMessages(data.messages ?? []);
      } catch {
        showError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId, showError]);

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Set title from first message
    if (messages.length === 0) {
      setTitle(content.trim().slice(0, 40));
    }

    try {
      const res = await fetch(`/api/advisor/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (res.status === 503) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content:
              'Docky is temporarily unavailable. Your question has been saved — try sending again.',
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          role: 'assistant',
          content: data.content,
          sources: data.sources,
          created_at: data.created_at,
        },
      ]);
    } catch {
      showError('Failed to send message');
    } finally {
      setSending(false);
    }
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pb-[var(--nav-height)]">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background px-2 py-3">
        <button
          onClick={() => router.push('/docky')}
          className="rounded-full p-1 transition-colors hover:bg-accent"
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
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent"
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
                  <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
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
                      className="rounded-2xl bg-muted px-4 py-2.5 text-sm"
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
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Docky is thinking
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
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-[var(--nav-height)] border-t border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Docky..."
            maxLength={500}
            disabled={sending}
            className="flex-1 rounded-full border border-border bg-muted px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="rounded-full bg-primary p-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
