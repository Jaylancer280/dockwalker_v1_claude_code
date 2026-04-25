'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { SendHorizontal, LifeBuoy, ChevronDown, Lock, RotateCcw, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { uuid } from '@/lib/uuid';
import { Button } from '@/components/ui/button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useProfileChips } from '@/hooks/use-profile-chips';
import { useDockyReadiness } from '@/hooks/use-docky-readiness';
import { safeFetch } from '@/lib/safe-fetch';
import DOMPurify from 'dompurify';

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

interface Thread {
  id: string;
  created_at: string;
}

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>');
  html = html.replace(/\n\n/g, '<br/><br/>');
  return DOMPurify.sanitize(html);
}

function formatExpiry(createdAt: string): string | null {
  const expiresAt = new Date(createdAt).getTime() + 72 * 60 * 60 * 1000;
  const remaining = expiresAt - Date.now();
  if (remaining < 60_000) return null; // <1 min — hide
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 0) return `Expires in ${hours}h ${mins}m`;
  return `Expires in ${mins}m`;
}

export default function DockyPage() {
  const router = useRouter();
  const { showError } = useToast();
  const suggestionChips = useProfileChips();
  const dockyReadiness = useDockyReadiness();

  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | null>(null);
  const [input, setInput] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [usagePill, setUsagePill] = useState<string | null>(null);
  const [expiryText, setExpiryText] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Thinking indicator
  useEffect(() => {
    setThinkingPhase(sending ? 'thinking' : null);
  }, [sending]);

  // Expiry countdown timer
  useEffect(() => {
    if (!thread) {
      setExpiryText(null);
      return;
    }
    const update = () => setExpiryText(formatExpiry(thread.created_at));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [thread]);

  // Check nudge dismissed state after readiness loads
  useEffect(() => {
    if (dockyReadiness.loaded) {
      const key = dockyReadiness.missing.sort().join(',');
      setNudgeDismissed(
        typeof window !== 'undefined' && localStorage.getItem('dw-docky-nudge-dismissed') === key,
      );
    }
  }, [dockyReadiness.loaded, dockyReadiness.missing]);

  const refreshUsage = useCallback(async () => {
    const result = await safeFetch<{ plan?: string; limit?: number; used?: number }>(
      '/api/advisor/usage',
    );
    if (result.ok) {
      if (result.data.plan) {
        setUsagePill('Pro');
      } else if (result.data.limit != null) {
        setUsagePill(`${result.data.used ?? 0} of ${result.data.limit}`);
      }
    }
  }, []);

  // Load thread + usage on mount
  useEffect(() => {
    async function loadThread() {
      try {
        const result = await safeFetch<{
          thread: Thread | null;
          messages: Message[];
        }>('/api/advisor/thread');
        if (result.ok) {
          setThread(result.data.thread);
          setMessages(result.data.messages ?? []);
        } else {
          showError('Failed to load conversation');
        }
      } finally {
        setLoading(false);
      }
    }

    loadThread();
    refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  async function sendMessage(content: string) {
    if (!content.trim() || sending || limitReached) return;

    const trimmed = content.trim();
    setInput('');
    setSending(true);

    // Optimistically add user message
    const userMsg: Message = {
      id: `temp-${uuid()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    // Raw fetch for streaming (safeFetch doesn't support ReadableStream)
    let res: Response;
    try {
      res = await fetch('/api/advisor/thread/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
    } catch {
      showError('Network error');
      setSending(false);
      return;
    }

    // Non-streaming error responses (JSON)
    if (!res.ok) {
      const text = await res.text();
      const parsed = (() => {
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      })();
      if (parsed.error === 'limit_reached') {
        setLimitReached(true);
        setSending(false);
        return;
      }
      if (res.status === 503) {
        setMessages((prev) => [
          ...prev,
          userMsg,
          {
            id: `err-${uuid()}`,
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

    // User message was saved — add it to local state
    setMessages((prev) => [...prev, userMsg]);

    // If this was first message, reload thread metadata
    if (!thread) {
      const threadResult = await safeFetch<{ thread: Thread | null }>('/api/advisor/thread');
      if (threadResult.ok && threadResult.data.thread) {
        setThread(threadResult.data.thread);
      }
    }

    // Read SSE stream
    const assistantId = `stream-${uuid()}`;
    let streamedContent = '';
    let streamedSources: Source[] | null = null;

    // Add empty assistant message that we'll update incrementally
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      },
    ]);

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6);
            try {
              const event = JSON.parse(json);
              if (event.type === 'delta') {
                streamedContent += event.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: streamedContent } : m)),
                );
                requestAnimationFrame(scrollToBottom);
              } else if (event.type === 'done') {
                streamedSources = event.sources ?? null;
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch {
        // Stream interrupted — keep whatever was received
      }
    }

    // Final update with sources
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: streamedContent, sources: streamedSources } : m,
      ),
    );
    setSending(false);
    refreshUsage();
  }

  async function handleClear() {
    setClearing(true);
    const result = await safeFetch('/api/advisor/thread/clear', { method: 'POST' });
    if (result.ok) {
      setThread(null);
      setMessages([]);
      setLimitReached(false);
      setClearDialogOpen(false);
    } else {
      showError('Failed to clear conversation');
    }
    setClearing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <LoadingSpinner size="md" />
      </main>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="flex min-h-svh flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Docky</h1>
          {usagePill && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                usagePill === 'Pro'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]'
              }`}
            >
              {usagePill}
            </span>
          )}
          {expiryText && <span className="text-xs text-muted-foreground">{expiryText}</span>}
        </div>
        {hasMessages && (
          <button
            onClick={() => setClearDialogOpen(true)}
            disabled={sending}
            aria-label="New conversation"
            className="rounded-full p-2 transition-colors hover:bg-[var(--accent-lo)] disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Profile nudge */}
      {dockyReadiness.loaded && !dockyReadiness.ready && !nudgeDismissed && (
        <div className="mx-4 mt-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm">
              {dockyReadiness.missing.includes('role') &&
              dockyReadiness.missing.includes('certifications')
                ? 'Docky gives better advice when it knows your background. Add your role and certifications to get personalised career guidance and cert gap analysis.'
                : dockyReadiness.missing.includes('certifications')
                  ? 'Add your certifications so Docky can identify gaps and suggest what to work on next.'
                  : 'Set your current role so Docky can tailor career path advice to where you are now.'}
            </p>
            <button
              onClick={() => {
                const key = dockyReadiness.missing.sort().join(',');
                localStorage.setItem('dw-docky-nudge-dismissed', key);
                setNudgeDismissed(true);
              }}
              aria-label="Dismiss"
              className="ml-2 shrink-0 text-muted-foreground"
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="mt-2 text-sm font-medium text-[var(--accent)]"
          >
            {dockyReadiness.missing.includes('role') &&
            dockyReadiness.missing.includes('certifications')
              ? 'Complete your profile \u2192'
              : dockyReadiness.missing.includes('certifications')
                ? 'Add certifications \u2192'
                : 'Set your role \u2192'}
          </button>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {!hasMessages && !sending && (
          <div className="flex flex-col items-center pt-12 text-center">
            <div className="mb-4 overflow-hidden rounded-[14px] border border-[var(--border)]">
              <Image
                src="/images/empty-states/docky.jpg"
                alt=""
                width={400}
                height={267}
                sizes="400px"
                className="h-[180px] w-auto object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
              />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Ask Docky</h2>
            {usagePill === 'Pro' ? (
              <p className="mb-8 text-sm text-muted-foreground">
                Docky can give you personalised career advice based on your profile, certifications,
                and work history.
              </p>
            ) : (
              <div className="mb-8 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Docky can answer questions and cite MCA documentation.
                </p>
                <p className="text-xs text-muted-foreground">
                  <a href="/billing" className="text-[var(--accent)] underline">
                    Upgrade to Crew Pro
                  </a>{' '}
                  for personalised advice — Docky will read your profile, certifications, and work
                  history to give tailored guidance.
                </p>
              </div>
            )}
            <div className="grid w-full grid-cols-2 gap-3">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={sending}
                  className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--accent-lo)] disabled:opacity-50"
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
                      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm"
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
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--muted-foreground)]">
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

          {limitReached && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6 text-center">
              <div className="relative">
                <LifeBuoy className="h-10 w-10 text-muted-foreground" />
                <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                You&apos;ve reached your question limit this month
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade to Crew Pro for 500 questions per month
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
      <div className="sticky bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] border-t border-border bg-[var(--surface)] px-4 py-3 md:bottom-0">
        <div className="flex items-center gap-2">
          <AutoGrowTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={limitReached ? 'Upgrade to continue...' : 'Ask Docky...'}
            maxLength={500}
            disabled={sending || limitReached}
            className="flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm leading-5 outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            maxRows={6}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending || limitReached}
            className="rounded-full bg-[var(--accent)] p-2.5 text-white transition-colors hover:brightness-[1.08] disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* New conversation confirmation dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Current messages will be cleared. This cannot be undone.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleClear} disabled={clearing}>
              {clearing ? 'Clearing...' : 'New conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        aria-expanded={open}
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
