'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, SlidersHorizontal, X } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { ProfileOverlay } from '@/components/profile-overlay';
import { PermanentJobCard, type PermanentPosting } from './permanent-job-card';
import { PermanentJobDetail } from './permanent-job-detail';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
}

export function PermanentJobFeed() {
  const { showSuccess, showError } = useToast();

  // Data
  const [postings, setPostings] = useState<PermanentPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Crew certs + languages for client-side pill coloring
  const [crewCertIds, setCrewCertIds] = useState<string[]>([]);
  const [crewLangs, setCrewLangs] = useState<string[]>([]);

  // Detail view
  const [selectedPosting, setSelectedPosting] = useState<PermanentPosting | null>(null);

  // Profile overlay
  const [profilePersonId, setProfilePersonId] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');
  const [filterSalaryMin, setFilterSalaryMin] = useState('');
  const [filterLiveAboard, setFilterLiveAboard] = useState('any');
  const [filterCertId, setFilterCertId] = useState('');
  const [filterExpBracketId, setFilterExpBracketId] = useState('');
  const [filterSizeBandId, setFilterSizeBandId] = useState('');

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [sizeBands, setSizeBands] = useState<LookupItem[]>([]);

  // Scroll sentinel ref
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Entrance animation — check reduced motion once
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Load lookups on mount
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name').order('name'),
      supabase.from('certifications').select('id, name').order('name'),
      supabase.from('experience_brackets').select('id, label').order('id'),
      supabase.from('vessel_size_bands').select('id, label').order('id'),
    ]).then(([rolesRes, certsRes, bracketsRes, bandsRes]) => {
      setRoles((rolesRes.data ?? []) as LookupItem[]);
      setCerts((certsRes.data ?? []) as LookupItem[]);
      setBrackets((bracketsRes.data ?? []) as LookupItem[]);
      setSizeBands((bandsRes.data ?? []) as LookupItem[]);
    });

    // Fetch crew's certs for client-side cert gate
    loadCrewCerts();
  }, []);

  async function loadCrewCerts() {
    const result = await safeFetch<{
      profile?: { certification_ids?: string[]; languages?: string[] };
    }>('/api/profile');
    if (result.ok && result.data.profile?.certification_ids) {
      setCrewCertIds(result.data.profile.certification_ids);
    }
    if (result.ok) {
      setCrewLangs(result.data.profile?.languages ?? []);
    }
  }

  // Re-fetch crew certs when tab regains focus (handles stale data after profile edit)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadCrewCerts();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const loadPostings = useCallback(
    async (cursorParam?: string) => {
      const isLoadMore = !!cursorParam;
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
        if (filterPortId) params.set('portId', filterPortId);
        if (filterSalaryMin) params.set('salaryMin', filterSalaryMin);
        if (filterLiveAboard !== 'any') params.set('liveAboard', filterLiveAboard);
        if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
        if (filterExpBracketId && filterExpBracketId !== 'all')
          params.set('experienceBracketId', filterExpBracketId);
        if (filterSizeBandId && filterSizeBandId !== 'all')
          params.set('sizeBandId', filterSizeBandId);
        if (cursorParam) params.set('cursor', cursorParam);

        const result = await safeFetch<{
          postings?: PermanentPosting[];
          has_more?: boolean;
          next_cursor?: string | null;
        }>(`/api/permanent/discover?${params.toString()}`);

        if (result.ok) {
          if (isLoadMore) {
            setPostings((prev) => [...prev, ...(result.data.postings ?? [])]);
          } else {
            setPostings(result.data.postings ?? []);
          }
          setHasMore(result.data.has_more ?? false);
          setNextCursor(result.data.next_cursor ?? null);
        }
        // Silent fail — feed shows what we have
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      filterRoleId,
      filterPortId,
      filterSalaryMin,
      filterLiveAboard,
      filterCertId,
      filterExpBracketId,
      filterSizeBandId,
    ],
  );

  // Load on mount and filter changes
  useEffect(() => {
    loadPostings();
  }, [loadPostings]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor && !loadingMore) {
          loadPostings(nextCursor);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, loadingMore, loadPostings]);

  function clearFilters() {
    setFilterRoleId('');
    setFilterPortId('');
    setFilterSalaryMin('');
    setFilterLiveAboard('any');
    setFilterCertId('');
    setFilterExpBracketId('');
    setFilterSizeBandId('');
  }

  async function handleApply(postingId: string) {
    setApplying(true);
    const result = await safeFetch<Record<string, unknown>>(`/api/permanent/${postingId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (result.ok) {
      setPostings((prev) => prev.filter((p) => p.id !== postingId));
      if (selectedPosting?.id === postingId) setSelectedPosting(null);
      showSuccess('Application submitted');
    } else {
      showError(result.error);
    }
    setApplying(false);
  }

  const hasActiveFilters =
    (filterRoleId && filterRoleId !== 'all') ||
    filterPortId ||
    filterSalaryMin ||
    filterLiveAboard !== 'any' ||
    (filterCertId && filterCertId !== 'all') ||
    (filterExpBracketId && filterExpBracketId !== 'all') ||
    (filterSizeBandId && filterSizeBandId !== 'all');

  if (selectedPosting) {
    return (
      <PermanentJobDetail
        posting={selectedPosting}
        onClose={() => setSelectedPosting(null)}
        onApply={handleApply}
        crewCertIds={crewCertIds}
        crewLangs={crewLangs}
        applying={applying}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-4">
      {/* Filter toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="mr-1 h-4 w-4" />
          Filters
          {hasActiveFilters && <span className="ml-1 text-xs">(active)</span>}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={filterRoleId} onValueChange={setFilterRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <LocationPicker
                mode="port-required"
                value={filterPortId ? { portId: filterPortId } : null}
                onValueChange={(v: LocationValue) => setFilterPortId(v.portId ?? '')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Min salary expectation
              </label>
              <Input
                type="number"
                placeholder="e.g. 3000"
                value={filterSalaryMin}
                onChange={(e) => setFilterSalaryMin(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Live aboard</label>
              <div className="flex gap-1">
                {['any', 'true', 'false'].map((val) => (
                  <button
                    key={val}
                    className={`rounded-full px-3 py-1 text-xs ${
                      filterLiveAboard === val ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                    onClick={() => setFilterLiveAboard(val)}
                  >
                    {val === 'any' ? 'Any' : val === 'true' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Certification</label>
              <Select value={filterCertId} onValueChange={setFilterCertId}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="none">No certs required</SelectItem>
                  {certs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Experience level</label>
              <Select value={filterExpBracketId} onValueChange={setFilterExpBracketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  {brackets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label ?? b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vessel size</label>
              <Select value={filterSizeBandId} onValueChange={setFilterSizeBandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  {sizeBands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label ?? b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner size="lg" />}

      {/* Empty state */}
      {!loading && postings.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No permanent positions found"
          description="Try widening your filters."
        />
      )}

      {/* Postings list */}
      {!loading && postings.length > 0 && (
        <div className="flex flex-col gap-3">
          {postings.map((posting, index) => (
            <motion.div
              key={posting.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
            >
              <PermanentJobCard
                posting={posting}
                onTap={() => setSelectedPosting(posting)}
                onApply={handleApply}
                onPosterTap={(pid) => setProfilePersonId(pid)}
                crewCertIds={crewCertIds}
                crewLangs={crewLangs}
                applying={applying}
              />
            </motion.div>
          ))}

          {/* Scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {loadingMore && <LoadingSpinner size="md" />}

          {!hasMore && postings.length > 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No more positions to show
            </p>
          )}
        </div>
      )}

      {/* Profile overlay */}
      {profilePersonId && (
        <ProfileOverlay
          personId={profilePersonId}
          isOpen={true}
          onClose={() => setProfilePersonId(null)}
        />
      )}
    </div>
  );
}
