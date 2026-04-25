'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, CalendarDays, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { useLookups } from '@/hooks/use-lookups';
import { NotificationBell } from '@/components/notification-bell';
import { PushPrompt } from '@/components/push-prompt';
import { DayworkBrowse } from './_components/daywork-browse';
import { type DayworkCard, type SwipeableCardHandle } from './_components/daywork-card';
import type { MyApplication } from './_components/applied-tab';
import type { Invitation } from './_components/invitations-tab';

// Lazy-load heavy components not needed on initial render
const AvailabilityOverlay = dynamic(
  () => import('@/components/availability-overlay').then((m) => m.AvailabilityOverlay),
  { ssr: false },
);
const ProfileOverlay = dynamic(
  () => import('@/components/profile-overlay').then((m) => m.ProfileOverlay),
  { ssr: false },
);
const PermanentJobFeed = dynamic(
  () => import('./_components/permanent-job-feed').then((m) => m.PermanentJobFeed),
  { ssr: false },
);
const AppliedTab = dynamic(() => import('./_components/applied-tab').then((m) => m.AppliedTab), {
  ssr: false,
});
const InvitationsTab = dynamic(
  () => import('./_components/invitations-tab').then((m) => m.InvitationsTab),
  { ssr: false },
);

interface LookupItem {
  id: string;
  name: string;
  category?: string;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<'browse' | 'invitations' | 'applied'>(() => {
    if (typeof window === 'undefined') return 'browse';
    const stored = sessionStorage.getItem('dockwalker:discover-tab');
    if (stored === 'browse' || stored === 'invitations' || stored === 'applied') return stored;
    return 'browse';
  });
  const [browseMode, setBrowseMode] = useState<'daywork' | 'permanent'>(() => {
    if (typeof window === 'undefined') return 'daywork';
    return (localStorage.getItem('dw-browse-mode') as 'daywork' | 'permanent') || 'daywork';
  });
  const [cards, setCards] = useState<DayworkCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [composingMessage, setComposingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const swipeRef = useRef<SwipeableCardHandle | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCertId, setFilterCertId] = useState('');
  const [filterExperienceBracketId, setFilterExperienceBracketId] = useState('');
  const [filterSizeBandId, setFilterSizeBandId] = useState('');

  // Permanent filter state
  const [filterPermanentRoleId, setFilterPermanentRoleId] = useState('');
  const [filterPermanentPortId, setFilterPermanentPortId] = useState('');
  const [filterPermanentSalaryMin, setFilterPermanentSalaryMin] = useState('');
  const [filterPermanentLiveAboard, setFilterPermanentLiveAboard] = useState('any');
  const [filterPermanentCertId, setFilterPermanentCertId] = useState('');
  const [filterPermanentExpBracketId, setFilterPermanentExpBracketId] = useState('');
  const [filterPermanentSizeBandId, setFilterPermanentSizeBandId] = useState('');

  // Applied tab state
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  // Invitations tab state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [confirmAcceptInv, setConfirmAcceptInv] = useState<Invitation | null>(null);
  const [confirmDeclineInv, setConfirmDeclineInv] = useState<Invitation | null>(null);

  // Profile overlay state
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  // Availability gate state
  const [hasAvailability, setHasAvailability] = useState<boolean | null>(null);
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [showAvailOverlay, setShowAvailOverlay] = useState(false);

  // Crew certs for cert pill coloring
  const [crewCertIds, setCrewCertIds] = useState<string[] | null>(null);

  // Crew languages for language pill coloring
  const [crewLangs, setCrewLangs] = useState<string[] | null>(null);

  // Redirecting (employer/agent hit this page via client-side nav)
  const [redirecting, setRedirecting] = useState(false);

  // Discover feed error
  const [feedError, setFeedError] = useState<string | null>(null);

  // Applications error
  const [appsError, setAppsError] = useState<string | null>(null);

  // Lookups from cached context
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certifications = lookups.certifications as LookupItem[];
  const experienceBrackets = lookups.experienceBrackets;
  const sizeBands = lookups.sizeBands;

  // Check crew availability — only 'available' status allows applying
  const lastAvailCheckRef = useRef<number>(0);
  const checkAvailability = useCallback(async () => {
    try {
      const result = await safeFetch<{ status: string }>('/api/availability');
      if (result.ok) {
        setHasAvailability(result.data.status === 'available');
        lastAvailCheckRef.current = Date.now();
      }
      // Network failure — keep cached availability state
    } catch {
      // safeFetch never throws, but try/catch needed for React compiler lint
    }
  }, []);

  // Fetch crew certs for cert pill coloring + profile readiness check
  async function loadCrewCerts() {
    const result = await safeFetch<{
      profile?: {
        display_name?: string;
        certification_ids?: string[];
        languages?: string[];
        nationality_id?: string | null;
        primary_role_id?: string | null;
      };
      email?: string;
    }>('/api/profile');
    if (result.ok && result.data.profile?.certification_ids) {
      setCrewCertIds(result.data.profile.certification_ids);
    } else if (result.ok) {
      setCrewCertIds([]);
    }
    if (result.ok) {
      setCrewLangs(result.data.profile?.languages ?? []);
    }
    // Redirect agents to market feed
    if (
      result.ok &&
      (result.data as { person?: { identity_type?: string } }).person?.identity_type === 'agent'
    ) {
      setRedirecting(true);
      window.location.href = '/discover/market';
      return;
    }
    // Redirect employers to mine page (crew-only page)
    if (
      result.ok &&
      (result.data as { person?: { current_hat?: string } }).person?.current_hat === 'employer'
    ) {
      setRedirecting(true);
      window.location.href = '/daywork/mine';
      return;
    }
  }

  useEffect(() => {
    sessionStorage.setItem('dockwalker:discover-tab', activeTab);
  }, [activeTab]);

  // Defer profile + availability fetches — not needed for card rendering, only interaction
  useEffect(() => {
    startTransition(() => {
      loadCrewCerts();
      checkAvailability();
    });
  }, [checkAvailability]);

  // Re-fetch on tab focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadCrewCerts();
        checkAvailability();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkAvailability]);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
    if (filterPortId && filterPortId !== 'all') params.set('portId', filterPortId);
    if (filterStartDate) params.set('startDate', filterStartDate);
    if (filterEndDate) params.set('endDate', filterEndDate);
    if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
    if (filterExperienceBracketId && filterExperienceBracketId !== 'all')
      params.set('experienceBracketId', filterExperienceBracketId);
    if (filterSizeBandId && filterSizeBandId !== 'all') params.set('sizeBandId', filterSizeBandId);
    return params;
  }, [
    filterRoleId,
    filterPortId,
    filterStartDate,
    filterEndDate,
    filterCertId,
    filterExperienceBracketId,
    filterSizeBandId,
  ]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildFilterParams();
      const qs = params.toString();
      const result = await safeFetch<{
        dayworks?: DayworkCard[];
        next_cursor?: string;
        has_more?: boolean;
      }>(`/api/daywork/discover${qs ? `?${qs}` : ''}`);
      if (result.ok) {
        setFeedError(null);
        if (result.data.dayworks) setCards(result.data.dayworks);
        setNextCursor(result.data.next_cursor ?? null);
        setHasMore(result.data.has_more ?? false);
      } else {
        setFeedError('Failed to load jobs. Tap Retry to try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMore) return;
    setLoadingMore(true);

    let currentCursor = nextCursor;
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
      const params = buildFilterParams();
      params.set('cursor', currentCursor);
      const qs = params.toString();
      const result = await safeFetch<{
        dayworks?: DayworkCard[];
        next_cursor?: string;
        has_more?: boolean;
      }>(`/api/daywork/discover?${qs}`);

      if (!result.ok) break;

      const newCards = result.data.dayworks ?? [];

      if (newCards.length > 0) {
        setCards((prev) => [...prev, ...newCards]);
        setNextCursor(result.data.next_cursor ?? null);
        setHasMore(result.data.has_more ?? false);
        break;
      }

      // Empty batch (e.g. post-fetch sizeBand filter removed all results)
      if (!result.data.has_more || !result.data.next_cursor) {
        setNextCursor(null);
        setHasMore(false);
        break;
      }

      // Retry with new cursor
      currentCursor = result.data.next_cursor;
      retries++;
    }
    setLoadingMore(false);
  }, [nextCursor, hasMore, loadingMore, buildFilterParams]);

  // Auto-load more when card stack runs low

  useEffect(() => {
    if (cards.length <= 5 && hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [cards.length, hasMore, loadingMore, loading, loadMore]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  /** Gate apply actions behind availability check */
  const AVAIL_RECHECK_MS = 5 * 60 * 1000;

  function requireAvailability(): boolean {
    if (hasAvailability) return true;
    setShowAvailDialog(true);
    return false;
  }

  async function handleApply(dayworkId: string, message?: string) {
    // Re-check availability if last check was more than 5 minutes ago
    const elapsed = Date.now() - lastAvailCheckRef.current;
    if (elapsed > AVAIL_RECHECK_MS) {
      await checkAvailability();
    }
    setApplying(true);
    const opts: RequestInit = { method: 'POST' };
    if (message) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify({ message });
    }
    const result = await safeFetch<{ error?: string }>(`/api/daywork/${dayworkId}/apply`, opts);
    if (result.ok) {
      setCards((prev) => prev.filter((c) => c.id !== dayworkId));
      showSuccess('Application sent');
      // Refresh application count for the badge
      loadApplications();
    } else {
      showError(result.error);
    }
    setComposingMessage(false);
    setMessageText('');
    setApplying(false);
  }

  function handlePass(dayworkId: string) {
    setCards((prev) => prev.filter((c) => c.id !== dayworkId));
  }

  function handleMessageSubmit() {
    const topCard = cards[0] ?? null;
    if (!topCard || applying) return;
    if (!requireAvailability()) return;
    // Trigger the swipe-right animation, then apply with message
    if (swipeRef.current) {
      swipeRef.current.triggerApplySwipe();
    }
    const msg = messageText.trim();
    setTimeout(() => handleApply(topCard.id, msg || undefined), 300);
  }

  function handleCancelMessage() {
    setComposingMessage(false);
    setMessageText('');
  }

  const loadApplications = useCallback(async () => {
    setLoadingApps(true);
    setAppsError(null);
    const [dwResult, pmResult] = await Promise.all([
      safeFetch<{ applications?: MyApplication[] }>('/api/daywork/applications'),
      safeFetch<{ applications?: MyApplication[] }>('/api/permanent/applications'),
    ]);
    if (!dwResult.ok && !pmResult.ok) {
      setAppsError('Failed to load applications. Tap Retry to try again.');
      setLoadingApps(false);
      return;
    }
    const dwApps = dwResult.ok
      ? (dwResult.data.applications ?? []).map((a: MyApplication) => ({
          ...a,
          type: 'daywork' as const,
        }))
      : [];
    const pmApps = pmResult.ok ? (pmResult.data.applications ?? []) : [];
    const merged = [...dwApps, ...pmApps].sort(
      (a: MyApplication, b: MyApplication) =>
        new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
    );
    setApplications(merged);
    setLoadingApps(false);
  }, []);

  // Load applications + invitations on mount so tab counts show immediately
  // (lazy-load was hiding counts until users clicked the tab — bad UX).
  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWithdraw(dayworkId: string) {
    setWithdrawingId(dayworkId);
    const result = await safeFetch<{ error?: string }>(`/api/daywork/${dayworkId}/withdraw`, {
      method: 'POST',
    });
    if (result.ok) {
      setApplications((prev) => prev.filter((a) => a.daywork_id !== dayworkId));
      showSuccess('Application withdrawn');
    } else {
      showError(result.error);
    }
    setWithdrawingId(null);
  }

  async function handlePermanentWithdraw(postingId: string) {
    setWithdrawingId(postingId);
    const result = await safeFetch<{ error?: string }>(`/api/permanent/${postingId}/withdraw`, {
      method: 'POST',
    });
    if (result.ok) {
      setApplications((prev) => prev.filter((a) => a.permanent_posting_id !== postingId));
      showSuccess('Application withdrawn');
    } else {
      showError(result.error);
    }
    setWithdrawingId(null);
  }

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    const result = await safeFetch<{ invitations?: Invitation[] }>('/api/daywork/invitations');
    if (result.ok) {
      setInvitations(result.data.invitations ?? []);
    }
    setLoadingInvitations(false);
  }, []);

  // Load invitations on mount for tab badge count (cheap query, daywork-only).
  useEffect(() => {
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAcceptInvitation(inv: Invitation) {
    setRespondingId(inv.id);
    setInvitationError(null);
    const result = await safeFetch<{ success?: boolean; engagementId?: string; error?: string }>(
      `/api/daywork/invitations/${inv.id}/respond`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      },
    );
    if (result.ok && result.data.engagementId) {
      router.push(`/messages/${result.data.engagementId}`);
      return;
    }
    if (result.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      showSuccess('Invitation accepted — engagement created');
    } else {
      setInvitationError(result.error);
    }
    setRespondingId(null);
    setConfirmAcceptInv(null);
  }

  async function handleDeclineInvitation(inv: Invitation) {
    setRespondingId(inv.id);
    setInvitationError(null);
    const result = await safeFetch<{ error?: string }>(
      `/api/daywork/invitations/${inv.id}/respond`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      },
    );
    if (result.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      showSuccess('Invitation declined');
    } else {
      setInvitationError(result.error);
    }
    setRespondingId(null);
    setConfirmDeclineInv(null);
  }

  const hasDayworkActiveFilters =
    (filterRoleId && filterRoleId !== 'all') ||
    filterPortId ||
    filterStartDate ||
    filterEndDate ||
    (filterCertId && filterCertId !== 'all') ||
    (filterExperienceBracketId && filterExperienceBracketId !== 'all') ||
    (filterSizeBandId && filterSizeBandId !== 'all');

  const hasPermanentActiveFilters =
    (filterPermanentRoleId && filterPermanentRoleId !== 'all') ||
    filterPermanentPortId ||
    filterPermanentSalaryMin ||
    filterPermanentLiveAboard !== 'any' ||
    (filterPermanentCertId && filterPermanentCertId !== 'all') ||
    (filterPermanentExpBracketId && filterPermanentExpBracketId !== 'all') ||
    (filterPermanentSizeBandId && filterPermanentSizeBandId !== 'all');

  const hasActiveFilters =
    browseMode === 'daywork' ? hasDayworkActiveFilters : hasPermanentActiveFilters;

  function clearActiveFilters() {
    if (browseMode === 'daywork') {
      setFilterRoleId('');
      setFilterPortId('');
      setFilterStartDate('');
      setFilterEndDate('');
      setFilterCertId('');
      setFilterExperienceBracketId('');
      setFilterSizeBandId('');
    } else {
      setFilterPermanentRoleId('');
      setFilterPermanentPortId('');
      setFilterPermanentSalaryMin('');
      setFilterPermanentLiveAboard('any');
      setFilterPermanentCertId('');
      setFilterPermanentExpBracketId('');
      setFilterPermanentSizeBandId('');
    }
  }

  if (redirecting) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </main>
    );
  }

  // Applications are filtered by the parent mode toggle so the Applied tab
  // matches what's selected in the header (Daywork ↔ Permanent).
  const filteredApplications = applications.filter((a) =>
    browseMode === 'daywork' ? a.type === 'daywork' : a.type === 'permanent',
  );

  // Invitations is daywork-only by data model. Permanent has no invitation
  // concept, so the tab is hidden on Permanent.
  const subTabOptions =
    browseMode === 'daywork'
      ? [
          { value: 'browse', label: 'Browse' },
          { value: 'invitations', label: 'Invitations', count: invitations.length },
          { value: 'applied', label: 'Applied', count: filteredApplications.length },
        ]
      : [
          { value: 'browse', label: 'Browse' },
          { value: 'applied', label: 'Applied', count: filteredApplications.length },
        ];

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="page-width flex items-center justify-between px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <SegmentedToggle
              options={[
                { value: 'daywork', label: 'Daywork' },
                { value: 'permanent', label: 'Permanent' },
              ]}
              value={browseMode}
              onChange={(v) => {
                const next = v as 'daywork' | 'permanent';
                setBrowseMode(next);
                localStorage.setItem('dw-browse-mode', v);
                // Invitations tab is daywork-only — kick the user to Browse if
                // they were on Invitations and switched to Permanent.
                if (next === 'permanent' && activeTab === 'invitations') {
                  setActiveTab('browse');
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {activeTab === 'browse' && hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearActiveFilters}>
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
            {activeTab === 'browse' && (
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                Filters
                {hasActiveFilters && <span className="ml-1 text-xs">(active)</span>}
              </Button>
            )}
            <span className="md:hidden">
              <NotificationBell />
            </span>
          </div>
        </div>
        {/* Sub-tabs (Browse · Invitations · Applied for daywork; Browse · Applied for permanent) */}
        <div className="page-width border-t border-[var(--border)]">
          <UnderlineTabs
            options={subTabOptions}
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'browse' | 'invitations' | 'applied')}
          />
        </div>
      </header>

      <PushPrompt />

      {/* ───── Invitations tab ───── */}
      {activeTab === 'invitations' && (
        <InvitationsTab
          invitations={invitations}
          loadingInvitations={loadingInvitations}
          respondingId={respondingId}
          invitationError={invitationError}
          onAccept={(inv) => setConfirmAcceptInv(inv)}
          onDecline={(inv) => setConfirmDeclineInv(inv)}
          onViewProfile={setViewProfileId}
          onSwitchToBrowse={() => setActiveTab('browse')}
        />
      )}

      {/* ───── Applied tab ───── */}
      {activeTab === 'applied' && (
        <AppliedTab
          applications={filteredApplications}
          loadingApps={loadingApps}
          withdrawingId={withdrawingId}
          onWithdraw={handleWithdraw}
          onPermanentWithdraw={handlePermanentWithdraw}
          onViewProfile={setViewProfileId}
          onSwitchToBrowse={() => setActiveTab('browse')}
          onRetry={loadApplications}
          appsError={appsError}
        />
      )}

      {/* ───── Browse tab ───── */}
      {activeTab === 'browse' && (
        <DayworkBrowse
          cards={cards}
          loading={loading}
          loadingMore={loadingMore}
          applying={applying}
          composingMessage={composingMessage}
          messageText={messageText}
          showFilters={showFilters}
          hasAvailability={hasAvailability}
          swipeRef={swipeRef}
          filterRoleId={filterRoleId}
          filterPortId={filterPortId}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          filterCertId={filterCertId}
          filterExperienceBracketId={filterExperienceBracketId}
          filterSizeBandId={filterSizeBandId}
          setFilterRoleId={setFilterRoleId}
          setFilterPortId={setFilterPortId}
          setFilterStartDate={setFilterStartDate}
          setFilterEndDate={setFilterEndDate}
          setFilterCertId={setFilterCertId}
          setFilterExperienceBracketId={setFilterExperienceBracketId}
          setFilterSizeBandId={setFilterSizeBandId}
          roles={roles}
          certifications={certifications}
          experienceBrackets={experienceBrackets}
          sizeBands={sizeBands}
          crewCertIds={crewCertIds}
          crewLangs={crewLangs}
          onApply={(id) => handleApply(id)}
          onPass={handlePass}
          onComposeMessage={() => {
            if (!requireAvailability()) return;
            setComposingMessage(true);
            setMessageText('');
          }}
          onCancelMessage={handleCancelMessage}
          onMessageSubmit={handleMessageSubmit}
          onMessageTextChange={setMessageText}
          onAvailabilityGate={() => setShowAvailDialog(true)}
          onViewProfile={setViewProfileId}
          onLoadCards={loadCards}
          requireAvailability={requireAvailability}
          browseMode={browseMode}
          feedError={feedError}
          permanentFeed={
            <PermanentJobFeed
              showFilters={showFilters}
              filterRoleId={filterPermanentRoleId}
              filterPortId={filterPermanentPortId}
              filterSalaryMin={filterPermanentSalaryMin}
              filterLiveAboard={filterPermanentLiveAboard}
              filterCertId={filterPermanentCertId}
              filterExpBracketId={filterPermanentExpBracketId}
              filterSizeBandId={filterPermanentSizeBandId}
              setFilterRoleId={setFilterPermanentRoleId}
              setFilterPortId={setFilterPermanentPortId}
              setFilterSalaryMin={setFilterPermanentSalaryMin}
              setFilterLiveAboard={setFilterPermanentLiveAboard}
              setFilterCertId={setFilterPermanentCertId}
              setFilterExpBracketId={setFilterPermanentExpBracketId}
              setFilterSizeBandId={setFilterPermanentSizeBandId}
              roles={roles}
              certifications={certifications}
              experienceBrackets={experienceBrackets}
              sizeBands={sizeBands}
            />
          }
        />
      )}

      {/* Availability gate dialog */}
      <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Before applying to daywork, you need to set your availability dates and location so
              employers know when and where you&apos;re free.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAvailDialog(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setShowAvailDialog(false);
                setShowAvailOverlay(true);
              }}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Set availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability overlay (opened from gate dialog) */}
      {showAvailOverlay && (
        <AvailabilityOverlay
          onConfirm={() => {
            setShowAvailOverlay(false);
            showSuccess('Availability updated');
            // Optimistic: user just set availability, ungate immediately.
            // Background recheck validates after projection completes.
            setHasAvailability(true);
            setTimeout(() => checkAvailability(), 1000);
          }}
          onCancel={() => setShowAvailOverlay(false)}
        />
      )}

      {/* Accept invitation confirmation */}
      <Dialog open={!!confirmAcceptInv} onOpenChange={() => setConfirmAcceptInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this invitation?</DialogTitle>
            <DialogDescription>
              You&apos;ll be added as an applicant for this job.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAcceptInv(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!respondingId}
              onClick={() => {
                if (confirmAcceptInv) handleAcceptInvitation(confirmAcceptInv);
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline invitation confirmation */}
      <Dialog open={!!confirmDeclineInv} onOpenChange={() => setConfirmDeclineInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this invitation?</DialogTitle>
            <DialogDescription>The employer won&apos;t be notified.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeclineInv(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!respondingId}
              onClick={() => {
                if (confirmDeclineInv) handleDeclineInvitation(confirmDeclineInv);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Profile overlay */}
      {viewProfileId && (
        <ProfileOverlay
          personId={viewProfileId}
          isOpen={true}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </main>
  );
}
