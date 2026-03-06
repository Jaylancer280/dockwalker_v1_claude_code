'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, MapPin, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Conversation {
  id: string;
  crew_person_id: string;
  employer_person_id: string;
  daywork_id: string;
  start_date: string;
  end_date: string;
  status: string;
  role: 'crew' | 'employer';
  dayworks: { yacht_roles: { name: string } | null; ports: { name: string } | null } | null;
  profiles: { display_name: string } | null;
  last_message: {
    content: string;
    created_at: string;
    sender_person_id: string;
  } | null;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/messages');
    const data = await res.json();
    if (data.conversations) setConversations(data.conversations);
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Messages</h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading conversations...</p>
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">No messages yet</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Messages open after a daywork application is accepted. Once you have an active
                engagement, you can chat here.
              </p>
            </CardContent>
          </Card>
        )}

        {conversations.map((conv) => (
          <Link key={conv.id} href={`/messages/${conv.id}`}>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
              {/* Avatar placeholder */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {(conv.profiles?.display_name ?? '?')[0].toUpperCase()}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {/* Name + role context */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate">
                    {conv.profiles?.display_name ?? 'Unknown'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conv.last_message
                      ? new Date(conv.last_message.created_at).toLocaleDateString()
                      : ''}
                  </span>
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
