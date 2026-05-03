'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ClipboardCheck, Archive } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ConversationSkeleton } from '@/components/conversation-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import { Avatar } from '@/components/avatar';
import { NotificationBell } from '@/components/notification-bell';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { createClient } from '@/lib/supabase/client';
import { ConsentPromptsSection } from '@/components/references/consent-prompts-section';
import { ShortlistBundleRow } from './_components/shortlist-bundle-row';

interface ConsentPrompt {
  kind: 'reference_invitation' | 'reference_contact';
  id: string;
  reference_id: string;
  created_at: string;
  requester_display_name: string | null;
  employer_display_name: string | null;
  snapshot_vessel_name: string;
  snapshot_vessel_imo: string;
  snapshot_start_date: string;
  snapshot_end_date: string | null;
  requester_role_at_time: string;
  claimed_referee_role: string;
  question: string | null;
  pending_expires_at: string | null;
}

interface Conversation {
  id: string;
  daywork_id: string | null;
  permanent_posting_id?: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  /** B-011: phase distinguishes pre-selection shortlist chats from
   *  post-acceptance lifecycle engagements. Drives the "Pre-selection
   *  chat" badge in the inbox. */
  phase?: 'shortlist' | 'active' | 'completed' | 'closed';
  cancelled_by?: string | null;
  type?: 'daywork' | 'permanent';
  has_rated: boolean;
  role: 'crew' | 'employer';
  dayworks: { yacht_roles: { name: string } | null; ports: { name: string } | null } | null;
  permanent_postings: {
    id: string;
    yacht_roles: { name: string } | null;
    ports: { name: string } | null;
    vessels: { name: string } | null;
  } | null;
  unread_count?: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
  last_message: {
    content: string;
    created_at: string;
    sender_person_id: string;
  } | null;
}

type TabView = 'active' | 'history';

export default function MessagesPage() {
  const {
    data,
    error: fetchError,
    isLoading: loading,
    mutate,
  } = useSafeFetch<{
    conversations?: Conversation[];
    consent_prompts?: ConsentPrompt[];
  }>('/api/messages');
  const conversations = data?.conversations ?? [];
  const consentPrompts = data?.consent_prompts ?? [];
  const error = fetchError ? 'Failed to load messages. Please try again.' : null;

  // Restore scroll position after list content has loaded
  useScrollRestoration(!loading);
  const [tab, setTab] = useState<TabView>(() => {
    if (typeof window === 'undefined') return 'active';
    const stored = sessionStorage.getItem('dockwalker:messages-tab');
    return stored === 'history' ? 'history' : 'active';
  });

  // Unread message counts per engagement
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    async function fetchUnreads() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: counts } = await supabase.rpc('get_unread_counts', { p_person_id: user.id });
      if (counts && !cancelled) {
        const map = new Map<string, number>();
        for (const row of counts as { engagement_id: string; unread_count: number }[]) {
          map.set(row.engagement_id, row.unread_count);
        }
        setUnreadMap(map);
      }
    }
    fetchUnreads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem('dockwalker:messages-tab', tab);
  }, [tab]);

  // Admin-cancelled engagements skip rating — the counterparty may have been
  // deleted, so there's nobody to rate and the row can't leave "needs rating"
  // purgatory. Treat them as terminal → History regardless of has_rated.
  const isAdminCancelled = (c: Conversation) =>
    c.status === 'cancelled' && c.cancelled_by === 'admin';

  // Active: active engagements + completed/cancelled that still need rating
  const active = conversations.filter(
    (c) =>
      c.status === 'active' ||
      (c.status === 'completed' && !c.has_rated) ||
      (c.status === 'cancelled' && !c.has_rated && !isAdminCancelled(c)),
  );
  // History: completed-and-rated + cancelled-and-rated + admin-cancelled +
  // closed (permanent terminal) — read-only
  const history = conversations.filter(
    (c) =>
      (c.status === 'completed' && c.has_rated) ||
      (c.status === 'cancelled' && (c.has_rated || isAdminCancelled(c))) ||
      c.status === 'closed',
  );

  const current = tab === 'active' ? active : history;

  // Group permanent shortlist chats by posting. Active tab bundles
  // phase='shortlist' rows; History tab bundles phase='closed' rows
  // (cascade-closed siblings + WITHDRAWN/REJECTED/CANCELLED closures).
  // Singletons still bundle — consistent UX, no special-case. Non-shortlist
  // permanent + daywork conversations stay as flat rows.
  type RenderItem =
    | { kind: 'flat'; conv: Conversation; sortKey: string }
    | {
        kind: 'bundle';
        postingId: string;
        roleName: string | null;
        vesselName: string | null;
        portName: string | null;
        children: Conversation[];
        sortKey: string;
        hasUnread: boolean;
        unreadCount: number;
      };

  const renderItems = useMemo<RenderItem[]>(() => {
    const flatRows: RenderItem[] = [];
    const bundles = new Map<string, Conversation[]>();
    for (const c of current) {
      const inShortlistGroup =
        !!c.permanent_posting_id && (c.phase === 'shortlist' || c.phase === 'closed');
      if (inShortlistGroup && c.permanent_posting_id) {
        const list = bundles.get(c.permanent_posting_id) ?? [];
        list.push(c);
        bundles.set(c.permanent_posting_id, list);
      } else {
        const sortKey = c.last_message?.created_at ?? c.start_date;
        flatRows.push({ kind: 'flat', conv: c, sortKey });
      }
    }

    const bundleRows: RenderItem[] = [];
    for (const [postingId, children] of bundles) {
      // Inside a bundle, sort children by recency too — fresh activity surfaces first.
      children.sort((a, b) => {
        const aT = a.last_message?.created_at ?? a.start_date;
        const bT = b.last_message?.created_at ?? b.start_date;
        return bT.localeCompare(aT);
      });
      const head = children[0];
      const sortKey = head.last_message?.created_at ?? head.start_date;
      const unreadCount = children.reduce(
        (n, c) => n + ((unreadMap.get(c.id) ?? 0) > 0 ? 1 : 0),
        0,
      );
      bundleRows.push({
        kind: 'bundle',
        postingId,
        roleName: head.permanent_postings?.yacht_roles?.name ?? null,
        vesselName: head.permanent_postings?.vessels?.name ?? null,
        portName: head.permanent_postings?.ports?.name ?? null,
        children,
        sortKey,
        hasUnread: unreadCount > 0,
        unreadCount,
      });
    }

    return [...flatRows, ...bundleRows].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [current, unreadMap]);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 bg-[var(--surface)]">
        <div className="page-width flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Messages</h1>
          <span className="md:hidden">
            <NotificationBell />
          </span>
        </div>
        <div className="page-width border-t border-[var(--border)]">
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

      <div className="page-width-wide flex w-full flex-1 flex-col gap-2 px-4 py-4">
        {error && (
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        )}

        {loading && <ConversationSkeleton />}

        {!loading && tab === 'active' && consentPrompts.length > 0 && (
          <ConsentPromptsSection prompts={consentPrompts} onActionComplete={() => mutate()} />
        )}

        {!loading && current.length === 0 && tab === 'active' && (
          <EmptyState
            imageSrc="/images/empty-states/messages.jpg"
            title="No active messages"
            description="Messages open after a daywork application is accepted. Once you have an active engagement, you can chat here."
            action={
              <Link href="/discover">
                <Button variant="outline">Browse jobs</Button>
              </Link>
            }
          />
        )}

        {!loading && current.length === 0 && tab === 'history' && (
          <EmptyState
            icon={Archive}
            title="No past engagements"
            description="Completed and cancelled engagements will appear here."
          />
        )}

        {renderItems.map((item, index) => {
          const renderRow = (conv: Conversation, opts?: { hideShortlistBadge?: boolean }) => (
            <Link key={conv.id} href={`/messages/${conv.id}`}>
              <div
                className={`flex items-start gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 hover:border-[var(--border-hi)] ${
                  tab === 'history' ? 'opacity-75' : ''
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={conv.profiles?.avatar_url ?? null}
                    name={conv.profiles?.display_name ?? '?'}
                    size="sm"
                  />
                  {(unreadMap.get(conv.id) ?? 0) > 0 && (
                    <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card)]" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[15px] tracking-[-0.3px] truncate ${(unreadMap.get(conv.id) ?? 0) > 0 ? 'font-bold' : 'font-semibold'}`}
                    >
                      {conv.profiles?.display_name ?? 'Unknown'}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!opts?.hideShortlistBadge && conv.phase === 'shortlist' && (
                        <Badge variant="secondary" className="text-[10px]">
                          Pre-selection
                        </Badge>
                      )}
                      {((conv.status === 'completed' && !conv.has_rated) ||
                        (conv.status === 'cancelled' &&
                          !conv.has_rated &&
                          !isAdminCancelled(conv))) && (
                        <Badge variant="status-filling" className="flex items-center gap-1">
                          <ClipboardCheck className="h-3 w-3" />
                          Action needed
                        </Badge>
                      )}
                      {conv.status === 'cancelled' &&
                        (conv.has_rated || isAdminCancelled(conv)) && (
                          <Badge variant="status-cancelled">Cancelled</Badge>
                        )}
                      {conv.status === 'closed' && <Badge variant="status-cancelled">Closed</Badge>}
                      <span className="font-mono text-[11px] text-[var(--tertiary)]">
                        {conv.last_message
                          ? new Date(conv.last_message.created_at).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
                    {(() => {
                      const roleName =
                        conv.dayworks?.yacht_roles?.name ??
                        conv.permanent_postings?.yacht_roles?.name;
                      const portName =
                        conv.dayworks?.ports?.name ?? conv.permanent_postings?.ports?.name;
                      return (
                        <>
                          {roleName && (
                            <span className="flex items-center gap-1">
                              <EpauletteBadge roleName={roleName} size="sm" />
                              {roleName}
                            </span>
                          )}
                          {portName && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {portName}
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" />
                      {conv.end_date
                        ? `${conv.start_date} — ${conv.end_date}`
                        : `Start: ${conv.start_date}`}
                    </span>
                  </div>

                  {conv.status === 'cancelled' && conv.role === 'employer' && conv.daywork_id && (
                    <Link
                      href={`/daywork/post?fromDaywork=${conv.daywork_id}&replacementDates=true`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-fit rounded-md bg-[var(--accent-lo)] px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-md)]"
                    >
                      Post replacement
                    </Link>
                  )}

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
          );

          return (
            <motion.div
              key={item.kind === 'flat' ? item.conv.id : item.postingId}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
            >
              {item.kind === 'flat' ? (
                renderRow(item.conv)
              ) : (
                <ShortlistBundleRow
                  postingId={item.postingId}
                  roleName={item.roleName}
                  vesselName={item.vesselName}
                  portName={item.portName}
                  childCount={item.children.length}
                  hasUnread={item.hasUnread}
                  unreadCount={item.unreadCount}
                  lastActivity={item.sortKey}
                  prefersReducedMotion={prefersReducedMotion}
                >
                  {item.children.map((c) => renderRow(c, { hideShortlistBadge: true }))}
                </ShortlistBundleRow>
              )}
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}
