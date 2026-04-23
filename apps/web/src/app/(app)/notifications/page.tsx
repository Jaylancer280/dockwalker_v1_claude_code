'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  UserCheck,
  UserX,
  Star,
  Mail,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';
import { useNotificationCounts } from '@/hooks/use-notification-counts';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

interface NotificationGroup {
  group_key: string;
  type: string;
  title: string;
  body: string;
  deep_link: string | null;
  created_at: string;
  read: boolean;
  total_count: number;
  unread_count: number;
  latest_id: string;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  application_received: Mail,
  application_accepted: UserCheck,
  application_rejected: UserX,
  invitation_received: Star,
  application_shortlisted: Star,
  message_received: MessageSquare,
  new_job_posted: Briefcase,
  job_completed: CheckCircle,
  engagement_cancelled: XCircle,
  work_started: Clock,
  work_started_confirmed: CheckCircle,
  postponement_proposed: Clock,
  checklist_updated: ClipboardCheck,
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { refresh: refreshCounts } = useNotificationCounts();
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore scroll position after the list hydrates
  useScrollRestoration(!loading);

  const load = useCallback(async () => {
    try {
      const result = await safeFetch<{ groups?: NotificationGroup[] }>(
        '/api/notifications?grouped=true',
      );
      if (result.ok) {
        setGroups(result.data.groups ?? []);
        setError(null);
      } else {
        setError('Failed to load notifications. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await safeFetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setGroups((prev) => prev.map((g) => ({ ...g, read: true, unread_count: 0 })));
    refreshCounts();
  }

  async function handleTap(group: NotificationGroup) {
    if (group.unread_count > 0) {
      if (group.total_count > 1) {
        // Mark the whole group as read
        void safeFetch('/api/notifications/read-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: group.type, deep_link: group.deep_link }),
        }).then(() => refreshCounts());
      } else {
        void safeFetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds: [group.latest_id] }),
        }).then(() => refreshCounts());
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.group_key === group.group_key ? { ...g, read: true, unread_count: 0 } : g,
        ),
      );
    }
    if (group.deep_link) {
      router.push(group.deep_link);
    }
  }

  const hasUnread = groups.some((g) => g.unread_count > 0);

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex-1 text-[24px] font-bold tracking-[-0.5px]">Notifications</h1>
          {hasUnread && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <div className="page-width flex w-full flex-1 flex-col px-4 py-4">
        {error && (
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {loading && <LoadingSpinner size="md" />}

        {!loading && groups.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll be notified about applications, messages, and job updates."
          />
        )}

        {groups.map((group) => {
          const Icon = typeIcons[group.type] ?? Bell;
          const isUnread = group.unread_count > 0;
          const isGrouped = group.total_count > 1;
          return (
            <button
              key={group.group_key}
              onClick={() => handleTap(group)}
              className={`flex items-start gap-3 border-b border-border px-1 py-3 text-left transition-colors hover:bg-accent ${
                isUnread ? 'bg-accent/30' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">
                <Icon
                  className={`h-5 w-5 ${isUnread ? 'text-[var(--accent)]' : 'text-muted-foreground'}`}
                />
              </div>
              <div className="flex-1">
                <p className={`text-sm ${isUnread ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {group.title}
                  {isGrouped && (
                    <span className="ml-2 rounded-full bg-[var(--accent-lo)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                      {group.total_count}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{group.body}</p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--tertiary)]">
                  {relativeTime(group.created_at)}
                  {isGrouped && group.total_count > 1 && <> · {group.total_count - 1} earlier</>}
                </p>
              </div>
              {isUnread && (
                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}
