'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, MapPin, Calendar, Loader2, ClipboardCheck, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/avatar';
import { NotificationBell } from '@/components/notification-bell';

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
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (data.conversations) setConversations(data.conversations);
      setError(null);
    } catch {
      setError('Failed to load messages. Please try again.');
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

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Messages</h1>
          <NotificationBell />
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto w-full max-w-lg border-b border-border">
        <div className="flex">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'active'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active{active.length > 0 ? ` (${active.length})` : ''}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'history'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            History{history.length > 0 ? ` (${history.length})` : ''}
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-4 py-4">
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
            <p className="text-sm">Loading conversations...</p>
          </div>
        )}

        {!loading && current.length === 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {tab === 'active' ? (
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Archive className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle className="text-base">
                  {tab === 'active' ? 'No active messages' : 'No past engagements'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {tab === 'active'
                  ? 'Messages open after a daywork application is accepted. Once you have an active engagement, you can chat here.'
                  : 'Completed and cancelled engagements will appear here.'}
              </p>
            </CardContent>
          </Card>
        )}

        {current.map((conv) => (
          <Link key={conv.id} href={`/messages/${conv.id}`}>
            <div
              className={`flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent ${
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
                  <span className="text-sm font-semibold truncate">
                    {conv.profiles?.display_name ?? 'Unknown'}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {((conv.status === 'completed' && !conv.has_rated) ||
                      (conv.status === 'cancelled' && !conv.has_rated)) && (
                      <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                        <ClipboardCheck className="h-3 w-3" />
                        Action needed
                      </Badge>
                    )}
                    {conv.status === 'cancelled' && conv.has_rated && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Cancelled
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {conv.last_message
                        ? new Date(conv.last_message.created_at).toLocaleDateString()
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Job context */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

                {/* Find replacement CTA for cancelled engagements (employer only) */}
                {conv.status === 'cancelled' && conv.role === 'employer' && (
                  <Link
                    href={`/daywork/post?fromDaywork=${conv.daywork_id}&replacementDates=true`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-fit rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    Find replacement
                  </Link>
                )}

                {/* Last message preview */}
                {conv.last_message && (
                  <p className="truncate text-xs text-muted-foreground">
                    {conv.last_message.content}
                  </p>
                )}
                {!conv.last_message && (
                  <p className="text-xs text-muted-foreground/60 italic">No messages yet</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
