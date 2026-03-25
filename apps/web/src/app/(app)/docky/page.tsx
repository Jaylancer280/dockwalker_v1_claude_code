'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Plus, Loader2, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useProfileChips } from '@/hooks/use-profile-chips';
import { useDockyReadiness } from '@/hooks/use-docky-readiness';
import { safeFetch } from '@/lib/safe-fetch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
  preview: string | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DockyPage() {
  const router = useRouter();
  const { showError } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const suggestionChips = useProfileChips();
  const dockyReadiness = useDockyReadiness();
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('dw-docky-nudge-dismissed') === dockyReadiness.missing.sort().join(',')
    );
  });
  const [usagePill, setUsagePill] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await safeFetch<{ conversations?: Conversation[] }>(
        '/api/advisor/conversations',
      );
      if (result.ok) {
        setConversations(result.data.conversations ?? []);
      } else {
        showError('Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();

    // Fetch usage pill data
    async function loadUsage() {
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
    }
    loadUsage();
  }, [load]);

  async function createConversation() {
    setCreating(true);
    const result = await safeFetch<{ id: string }>('/api/advisor/conversations', {
      method: 'POST',
    });
    if (result.ok) {
      router.push(`/docky/${result.data.id}`);
    } else {
      showError('Failed to create conversation');
      setCreating(false);
    }
  }

  async function handleChipTap(chipText: string) {
    setCreating(true);
    const createResult = await safeFetch<{ id: string }>('/api/advisor/conversations', {
      method: 'POST',
    });
    if (!createResult.ok) {
      showError('Failed to start conversation');
      setCreating(false);
      return;
    }
    const { id } = createResult.data;

    await safeFetch(`/api/advisor/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chipText }),
    });

    router.push(`/docky/${id}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await safeFetch(`/api/advisor/conversations/${deleteTarget}`, {
      method: 'DELETE',
    });
    if (result.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget));
      setDeleteTarget(null);
    } else {
      showError('Failed to delete conversation');
    }
    setDeleting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center pb-[var(--nav-height)]">
        <LoadingSpinner size="md" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg pb-[var(--nav-height)]">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-[var(--surface)] px-4 py-3">
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
        </div>
        <button
          onClick={createConversation}
          disabled={creating}
          className="rounded-full p-2 transition-colors hover:bg-[var(--accent-lo)] disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

      {/* Docky profile nudge */}
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

      {conversations.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center px-6 pt-20 text-center">
          <LifeBuoy className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">Ask Docky</h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Your maritime career advisor. Ask about certifications, career paths, and training
            requirements.
          </p>
          <div className="grid w-full grid-cols-2 gap-3">
            {suggestionChips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipTap(chip)}
                disabled={creating}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--accent-lo)] disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Conversation list */
        <div className="flex flex-col">
          {conversations.map((conv) => (
            <div key={conv.id} className="flex items-center border-b border-border">
              <button
                onClick={() => router.push(`/docky/${conv.id}`)}
                className="flex flex-1 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-[var(--accent-lo)]"
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium">{conv.title ?? 'New conversation'}</p>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {relativeTime(conv.updated_at)}
                  </span>
                </div>
                {conv.preview && (
                  <p className="truncate text-xs text-muted-foreground">{conv.preview}</p>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(conv.id)}
                className="p-3 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this conversation and all its messages.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
