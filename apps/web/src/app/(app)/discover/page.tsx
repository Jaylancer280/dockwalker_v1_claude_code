'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Compass,
  SlidersHorizontal,
  CalendarDays,
  ClipboardList,
  Mail,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { ProfileOverlay } from '@/components/profile-overlay';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { NotificationBell } from '@/components/notification-bell';
import { PushPrompt } from '@/components/push-prompt';
import { PermanentJobFeed } from './_components/permanent-job-feed';
import { DayworkBrowse } from './_components/daywork-browse';
import { AppliedTab, type MyApplication } from './_components/applied-tab';
import { InvitationsTab, type Invitation } from './_components/invitations-tab';
import { type DayworkCard, type SwipeableCardHandle } from './_components/daywork-card';

interface LookupItem {
  id: string;
  name: string;
  category?: string;
}

interface ExperienceBracketItem {
  id: string;
  label: string;
}

interface SizeBandItem {
  id: string;
  label: string;
}

export default function DiscoverPage() {
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<'browse' | 'invitations' | 'applied'>('browse');
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

  // Profile readiness for nudge card
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Lookups for filters
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certifications, setCertifications] = useState<LookupItem[]>([]);
  const [experienceBrackets, setExperienceBrackets] = useState<ExperienceBracketItem[]>([]);
  const [sizeBands, setSizeBands] = useState<SizeBandItem[]>([]);

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
      window.location.href = '/discover/market';
      return;
    }
    // Profile readiness: check if key fields are missing
    if (result.ok && result.data.profile) {
      const p = result.data.profile;
      const name = p.display_name ?? '';
      const looksLikeEmailPrefix = /^[A-Za-z0-9._+-]+$/.test(name) && !name.includes(' ');
      const incomplete =
        looksLikeEmailPrefix ||
        !p.nationality_id ||
        (!p.primary_role_id && (!p.certification_ids || p.certification_ids.length === 0));
      setProfileIncomplete(incomplete);
    }
  }

  useEffect(() => {
    loadCrewCerts();
  }, []);

  // Re-fetch crew certs when tab regains focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadCrewCerts();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Load filter options
  useEffect(() => {
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, bandsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase
          .from('certifications')
          .select('id, name, category')
          .order('category')
          .order('name'),
        supabase.from('experience_brackets').select('id, label').order('min_months'),
        supabase.from('vessel_size_bands').select('id, label').order('min_meters'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCertifications(certsRes.data);
      if (bracketsRes.data) setExperienceBrackets(bracketsRes.data);
      if (bandsRes.data) setSizeBands(bandsRes.data);
    }
    loadLookups();
  }, []);

  useEffect(() => {
    checkAvailability();
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
        if (result.data.dayworks) setCards(result.data.dayworks);
        setNextCursor(result.data.next_cursor ?? null);
        setHasMore(result.data.has_more ?? false);
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
    const [dwResult, pmResult] = await Promise.all([
      safeFetch<{ applications?: MyApplication[] }>('/api/daywork/applications'),
      safeFetch<{ applications?: MyApplication[] }>('/api/permanent/applications'),
    ]);
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

  // Load applications on mount (for badge count) and when switching to the Applied tab
  useEffect(() => {
    loadApplications();
  }, [activeTab, loadApplications]);

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

  // Load invitations on mount (for badge count) and when switching tabs

  useEffect(() => {
    loadInvitations();
  }, [activeTab, loadInvitations]);

  async function handleAcceptInvitation(inv: Invitation) {
    setRespondingId(inv.id);
    setInvitationError(null);
    const result = await safeFetch<{ error?: string }>(
      `/api/daywork/invitations/${inv.id}/respond`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      },
    );
    if (result.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      showSuccess('Invitation accepted');
      loadApplications();
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

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Discover</h1>
            <NotificationBell />
          </div>
          {activeTab === 'browse' && (
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Filters
            </Button>
          )}
        </div>
        {/* Tabs */}
        <div className="mx-auto flex max-w-lg border-t border-border">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="h-4 w-4" />
            Browse
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-4 w-4" />
            Invitations
            {invitations.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {invitations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('applied')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'applied'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Applied
            {applications.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {applications.length}
              </span>
            )}
          </button>
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
          applications={applications}
          loadingApps={loadingApps}
          withdrawingId={withdrawingId}
          onWithdraw={handleWithdraw}
          onPermanentWithdraw={handlePermanentWithdraw}
          onViewProfile={setViewProfileId}
          onSwitchToBrowse={() => setActiveTab('browse')}
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
          profileIncomplete={profileIncomplete}
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
          setBrowseMode={setBrowseMode}
          permanentFeed={<PermanentJobFeed />}
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
            checkAvailability();
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
