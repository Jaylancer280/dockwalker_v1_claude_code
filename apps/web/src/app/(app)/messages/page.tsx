'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ClipboardCheck, Archive } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import { Avatar } from '@/components/avatar';
import { NotificationBell } from '@/components/notification-bell';
import { safeFetch } from '@/lib/safe-fetch';

interface Conversation {
  id: string;
  daywork_id: string;
  start_date: string;
  end_date: string;
  status: string;
  has_rated: boolean;
  role: 'crew' | 'employer';
  dayworks: { yacht_roles: { name: string } | null; ports: { name: string } | null } | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
  last_message: {
    content: string;
    created_at: string;
    sender_person_id: string;
  } | null;
}

type TabView = 'active' | 'history';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabView>('active');

  const load = useCallback(async () => {
    try {
      const result = await safeFetch<{ conversations?: Conversation[] }>('/api/messages');
      if (result.ok) {
        if (result.data.conversations) setConversations(result.data.conversations);
        setError(null);
      } else {
        setError('Failed to load messages. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Active: active engagements + completed/cancelled that still need rating
  const active = conversations.filter(
    (c) =>
      c.status === 'active' ||
      (c.status === 'completed' && !c.has_rated) ||
      (c.status === 'cancelled' && !c.has_rated),
  );
  // History: completed-and-rated + cancelled-and-rated — read-only
  const history = conversations.filter(
    (c) => (c.status === 'completed' && c.has_rated) || (c.status === 'cancelled' && c.has_rated),
  );

  const current = tab === 'active' ? active : history;

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 bg-[var(--surface)]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Messages</h1>
          <NotificationBell />
        </div>
        <div className="mx-auto max-w-lg border-t border-[var(--border)]">
          <UnderlineTabs
            options={[
              { value: 'active', label: 'Active', count: active.length },
              { value: 'history', label: 'History', count: history.length },
            ]}
            value={tab}
            onChange={(v) => setTab(v as TabView)}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-4 py-4">
        {error && (
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {loading && <LoadingSpinner size="md" text="Loading conversations..." />}

        {!loading && current.length === 0 && tab === 'active' && (
          <EmptyState
            imageSrc="/images/empty-states/messages.jpg"
            title="No active messages"
            description="Messages open after a daywork application is accepted. Once you have an active engagement, you can chat here."
          />
        )}

        {!loading && current.length === 0 && tab === 'history' && (
          <EmptyState
            icon={Archive}
            title="No past engagements"
            description="Completed and cancelled engagements will appear here."
          />
        )}

        {current.map((conv, index) => (
          <motion.div
            key={conv.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
          >
            <Link href={`/messages/${conv.id}`}>
              <div
                className={`flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 hover:border-[var(--border-hi)] ${
                  tab === 'history' ? 'opacity-75' : ''
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={conv.profiles?.avatar_url ?? null}
                  name={conv.profiles?.display_name ?? '?'}
                  size="sm"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {/* Name + status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold tracking-[-0.3px] truncate">
                      {conv.profiles?.display_name ?? 'Unknown'}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {((conv.status === 'completed' && !conv.has_rated) ||
                        (conv.status === 'cancelled' && !conv.has_rated)) && (
                        <Badge variant="status-filling" className="flex items-center gap-1">
                          <ClipboardCheck className="h-3 w-3" />
                          Action needed
                        </Badge>
                      )}
                      {conv.status === 'cancelled' && conv.has_rated && (
                        <Badge variant="status-cancelled">Cancelled</Badge>
                      )}
                      <span className="font-mono text-[11px] text-[var(--tertiary)]">
                        {conv.last_message
                          ? new Date(conv.last_message.created_at).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                  </div>

                  {/* Job context */}
                  <div className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                    {conv.dayworks?.yacht_roles?.name && (
                      <span>{conv.dayworks.yacht_roles.name}</span>
                    )}
                    {conv.dayworks?.ports?.name && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {conv.dayworks.ports.name}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" />
                      {conv.start_date} — {conv.end_date}
                    </span>
                  </div>

                  {/* Post replacement CTA for cancelled engagements (employer only) */}
                  {conv.status === 'cancelled' && conv.role === 'employer' && (
                    <Link
                      href={`/daywork/post?fromDaywork=${conv.daywork_id}&replacementDates=true`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-fit rounded-md bg-[var(--accent-lo)] px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-md)]"
                    >
                      Post replacement
                    </Link>
                  )}

                  {/* Last message preview */}
                  {conv.last_message && (
                    <p className="truncate text-[13px] text-[var(--muted-foreground)]">
                      {conv.last_message.content}
                    </p>
                  )}
                  {!conv.last_message && (
                    <p className="text-[13px] text-[var(--tertiary)] italic">No messages yet</p>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
