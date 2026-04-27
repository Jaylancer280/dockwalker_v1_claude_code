'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { DayworkBrowse } from './daywork-browse';
import { type DayworkCard, type SwipeableCardHandle } from './daywork-card';
import { useDiscoverData } from './discover-data-context';

const PermanentJobFeed = dynamic(
  () => import('./permanent-job-feed').then((m) => m.PermanentJobFeed),
  { ssr: false },
);

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

export interface DiscoverBrowseHandle {
  /** Clear filters for the currently-active browseMode. Called from
   *  the page-level "Clear" button in the header. */
  clear: () => void;
}

interface DiscoverBrowseProps {
  browseMode: 'daywork' | 'permanent';
  showFilters: boolean;
  hasAvailability: boolean | null;
  requireAvailability: () => boolean;
  onAvailabilityGate: () => void;
  onViewProfile: (personId: string) => void;
  /** Called whenever `hasActiveFilters` changes for the current
   *  browseMode. The page uses this to show/hide the "Clear" button
   *  in the header. */
  onActiveFiltersChange: (has: boolean) => void;
  /** Crew lookups + their own profile signals — needed for cert /
   *  language pill colouring on cards. */
  crewCertIds: string[] | null;
  crewLangs: string[] | null;
  roles: LookupItem[];
  certifications: LookupItem[];
  experienceBrackets: ExperienceBracketItem[];
  sizeBands: SizeBandItem[];
}

/**
 * Container for the Browse tab. Owns all card-feed state, all
 * filter values (both daywork and permanent), and the apply /
 * compose-message flow. Renders the presentational <DayworkBrowse>
 * (or <PermanentJobFeed>) component, and forwards a ref so the
 * page-level "Clear" button can clear the right set of filters.
 *
 * After a successful apply, calls `loadApplications()` from the
 * shared DiscoverDataProvider so the Applied tab badge count
 * updates without the user opening the tab.
 */
export const DiscoverBrowse = forwardRef<DiscoverBrowseHandle, DiscoverBrowseProps>(
  function DiscoverBrowse(
    {
      browseMode,
      showFilters,
      hasAvailability,
      requireAvailability,
      onAvailabilityGate,
      onViewProfile,
      onActiveFiltersChange,
      crewCertIds,
      crewLangs,
      roles,
      certifications,
      experienceBrackets,
      sizeBands,
    },
    ref,
  ) {
    const { showError, showSuccess } = useToast();
    const { loadApplications } = useDiscoverData();

    // Card feed state (daywork)
    const [cards, setCards] = useState<DayworkCard[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [feedError, setFeedError] = useState<string | null>(null);

    // Apply flow
    const [applying, setApplying] = useState(false);
    const [composingMessage, setComposingMessage] = useState(false);
    const [messageText, setMessageText] = useState('');
    const swipeRef = useRef<SwipeableCardHandle | null>(null);

    // Daywork filter state
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

    // Compute hasActiveFilters per mode and report up to the parent
    // so the header's "Clear" button knows when to render.
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

    const hasActiveFilters = !!(browseMode === 'daywork'
      ? hasDayworkActiveFilters
      : hasPermanentActiveFilters);

    useEffect(() => {
      onActiveFiltersChange(hasActiveFilters);
    }, [hasActiveFilters, onActiveFiltersChange]);

    // Imperative clear — called by the page-level "Clear" button.
    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
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
        },
      }),
      [browseMode],
    );

    const buildFilterParams = useCallback(() => {
      const params = new URLSearchParams();
      if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
      if (filterPortId && filterPortId !== 'all') params.set('portId', filterPortId);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
      if (filterExperienceBracketId && filterExperienceBracketId !== 'all')
        params.set('experienceBracketId', filterExperienceBracketId);
      if (filterSizeBandId && filterSizeBandId !== 'all')
        params.set('sizeBandId', filterSizeBandId);
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

    async function handleApply(dayworkId: string, message?: string) {
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
        // Refresh shared application count for the tab badge
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
      // Trigger swipe-right animation, then apply with message
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

    return (
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
        onAvailabilityGate={onAvailabilityGate}
        onViewProfile={onViewProfile}
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
    );
  },
);
