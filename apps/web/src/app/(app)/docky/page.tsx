'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Plus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfileChips } from '@/hooks/use-profile-chips';
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
  const [usagePill, setUsagePill] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/advisor/conversations');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      showError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load();

    // Fetch usage pill data
    async function loadUsage() {
      try {
        const res = await fetch('/api/advisor/usage');
        if (!res.ok) return;
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (data.plan) {
          setUsagePill('Pro');
        } else if (data.limit != null) {
          setUsagePill(`${data.used ?? 0} of ${data.limit}`);
        }
      } catch {
        // No pill on failure
      }
    }
    loadUsage();
  }, [load]);

  async function createConversation() {
    setCreating(true);
    try {
      const res = await fetch('/api/advisor/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();
      router.push(`/docky/${data.id}`);
    } catch {
      showError('Failed to create conversation');
      setCreating(false);
    }
  }

  async function handleChipTap(chipText: string) {
    setCreating(true);
    try {
      const res = await fetch('/api/advisor/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create');
      const { id } = await res.json();

      const msgRes = await fetch(`/api/advisor/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chipText }),
      });

      if (!msgRes.ok && msgRes.status !== 503) throw new Error('Failed to send');

      router.push(`/docky/${id}`);
    } catch {
      showError('Failed to start conversation');
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/advisor/conversations/${deleteTarget}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete');
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget));
      setDeleteTarget(null);
    } catch {
      showError('Failed to delete conversation');
    } finally {
      setDeleting(false);
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
    <main className="mx-auto min-h-screen max-w-lg pb-[var(--nav-height)]">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Docky</h1>
          {usagePill && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                usagePill === 'Pro'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {usagePill}
            </span>
          )}
        </div>
        <button
          onClick={createConversation}
          disabled={creating}
          className="rounded-full p-2 transition-colors hover:bg-accent disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

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
                className="rounded-xl border border-border bg-card px-3 py-3 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
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
                className="flex flex-1 flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent"
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
