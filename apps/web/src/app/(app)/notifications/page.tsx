'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Loader2,
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
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  deep_link: string | null;
  read: boolean;
  created_at: string;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await safeFetch<{ notifications?: Notification[] }>('/api/notifications');
      if (result.ok) {
        setNotifications(result.data.notifications ?? []);
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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleTap(notif: Notification) {
    if (!notif.read) {
      void safeFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notif.id] }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    }
    if (notif.deep_link) {
      router.push(notif.deep_link);
    }
  }

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">Notifications</h1>
          {hasUnread && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
        {error && (
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
            <Bell className="h-8 w-8" />
            <p className="text-sm">No notifications yet</p>
          </div>
        )}

        {notifications.map((notif) => {
          const Icon = typeIcons[notif.type] ?? Bell;
          return (
            <button
              key={notif.id}
              onClick={() => handleTap(notif)}
              className={`flex items-start gap-3 border-b border-border px-1 py-3 text-left transition-colors hover:bg-accent ${
                !notif.read ? 'bg-accent/30' : ''
              }`}
            >
              <div className="mt-0.5 shrink-0">
                <Icon
                  className={`h-5 w-5 ${!notif.read ? 'text-primary' : 'text-muted-foreground'}`}
                />
              </div>
              <div className="flex-1">
                <p className={`text-sm ${!notif.read ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {notif.title}
                </p>
                <p className="text-xs text-muted-foreground">{notif.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  {relativeTime(notif.created_at)}
                </p>
              </div>
              {!notif.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </main>
  );
}
