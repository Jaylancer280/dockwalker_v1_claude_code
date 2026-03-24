'use client';

import { type RefObject, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LocationPicker } from '@/components/location-picker';
import { convertSizeBandLabel } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';
import { type DayworkCard, type SwipeableCardHandle, JobCard, SwipeableCard } from './daywork-card';

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

interface DayworkBrowseProps {
  cards: DayworkCard[];
  loading: boolean;
  loadingMore: boolean;
  applying: boolean;
  composingMessage: boolean;
  messageText: string;
  showFilters: boolean;
  profileIncomplete: boolean;
  hasAvailability: boolean | null;
  swipeRef: RefObject<SwipeableCardHandle | null>;
  // Filter state
  filterRoleId: string;
  filterPortId: string;
  filterStartDate: string;
  filterEndDate: string;
  filterCertId: string;
  filterExperienceBracketId: string;
  filterSizeBandId: string;
  // Filter setters
  setFilterRoleId: (v: string) => void;
  setFilterPortId: (v: string) => void;
  setFilterStartDate: (v: string) => void;
  setFilterEndDate: (v: string) => void;
  setFilterCertId: (v: string) => void;
  setFilterExperienceBracketId: (v: string) => void;
  setFilterSizeBandId: (v: string) => void;
  // Lookups
  roles: LookupItem[];
  certifications: LookupItem[];
  experienceBrackets: ExperienceBracketItem[];
  sizeBands: SizeBandItem[];
  // Crew state
  crewCertIds: string[] | null;
  crewLangs: string[] | null;
  // Handlers
  onApply: (dayworkId: string) => void;
  onPass: (dayworkId: string) => void;
  onComposeMessage: () => void;
  onCancelMessage: () => void;
  onMessageSubmit: () => void;
  onMessageTextChange: (text: string) => void;
  onAvailabilityGate: () => void;
  onViewProfile: (personId: string) => void;
  onLoadCards: () => void;
  requireAvailability: () => boolean;
  browseMode: 'daywork' | 'permanent';
  setBrowseMode: (mode: 'daywork' | 'permanent') => void;
  permanentFeed: React.ReactNode;
}

export function DayworkBrowse({
  cards,
  loading,
  loadingMore,
  applying,
  composingMessage,
  messageText,
  showFilters,
  profileIncomplete,
  hasAvailability,
  swipeRef,
  filterRoleId,
  filterPortId,
  filterStartDate,
  filterEndDate,
  filterCertId,
  filterExperienceBracketId,
  filterSizeBandId,
  setFilterRoleId,
  setFilterPortId,
  setFilterStartDate,
  setFilterEndDate,
  setFilterCertId,
  setFilterExperienceBracketId,
  setFilterSizeBandId,
  roles,
  certifications,
  experienceBrackets,
  sizeBands,
  crewCertIds,
  crewLangs,
  onApply,
  onPass,
  onComposeMessage,
  onCancelMessage,
  onMessageSubmit,
  onMessageTextChange,
  onAvailabilityGate,
  onViewProfile,
  onLoadCards,
  requireAvailability,
  browseMode,
  setBrowseMode,
  permanentFeed,
}: DayworkBrowseProps) {
  const prefs = usePreferences();
  const lengthUnit = prefs.lengthUnit;

  // Entrance animation — check reduced motion once on mount
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const topCard = cards[0] ?? null;
  const nextCard = cards[1] ?? null;

  return (
    <>
      {/* Profile completion nudge */}
      {profileIncomplete && (
        <div className="mx-auto mt-2 w-full max-w-lg px-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium">Complete your profile to start applying</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Employers see your role, certifications, and experience when you apply. Add these to
              your profile so you can apply for jobs.
            </p>
            <a
              href="/profile"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Go to profile →
            </a>
          </div>
        </div>
      )}

      {/* Daywork / Permanent toggle */}
      <div className="mx-auto max-w-lg mt-2 px-4">
        <SegmentedToggle
          options={[
            { value: 'daywork', label: 'Daywork' },
            { value: 'permanent', label: 'Permanent' },
          ]}
          value={browseMode}
          onChange={(v) => {
            setBrowseMode(v as 'daywork' | 'permanent');
            localStorage.setItem('dw-browse-mode', v);
          }}
        />
      </div>

      {browseMode === 'permanent' && permanentFeed}

      {browseMode === 'daywork' && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
          {/* Filters panel */}
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
                    onValueChange={(v) => setFilterPortId(v.portId ?? '')}
                    placeholder="All locations"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <Input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <Input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Certification
                    </label>
                    <Select value={filterCertId} onValueChange={setFilterCertId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All certs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All certs</SelectItem>
                        <SelectItem value="none">No certs required</SelectItem>
                        {certifications.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Experience</label>
                    <Select
                      value={filterExperienceBracketId}
                      onValueChange={setFilterExperienceBracketId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All levels</SelectItem>
                        {experienceBrackets.map((eb) => (
                          <SelectItem key={eb.id} value={eb.id}>
                            {eb.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Vessel size</label>
                  <Select value={filterSizeBandId} onValueChange={setFilterSizeBandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sizes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sizes</SelectItem>
                      {sizeBands.map((sb) => (
                        <SelectItem key={sb.id} value={sb.id}>
                          {convertSizeBandLabel(sb.label, lengthUnit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card stack */}
          <div className="relative flex flex-1 items-start justify-center pt-4">
            {loading && <LoadingSpinner size="md" text="Finding jobs..." />}

            {!loading && cards.length === 0 && (
              <EmptyState
                icon={Briefcase}
                title="No jobs found"
                description="No daywork postings match your filters. Try widening your search."
                action={
                  <Button variant="outline" size="sm" onClick={onLoadCards}>
                    Refresh
                  </Button>
                }
              />
            )}

            {!loading && cards.length > 0 && (
              <motion.div
                className="relative h-[420px] w-full overflow-hidden"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Next card preview (underneath) */}
                {nextCard && (
                  <div className="absolute inset-0 z-0">
                    <JobCard
                      card={nextCard}
                      isPreview
                      lengthUnit={lengthUnit}
                      onViewProfile={onViewProfile}
                      crewCertIds={crewCertIds}
                      crewLangs={crewLangs}
                    />
                  </div>
                )}

                {/* Top card (swipeable) */}
                {topCard && (
                  <SwipeableCard
                    ref={swipeRef}
                    key={topCard.id}
                    card={topCard}
                    onApply={() => {
                      if (requireAvailability()) onApply(topCard.id);
                    }}
                    onPass={() => onPass(topCard.id)}
                    onComposeMessage={() => {
                      if (!requireAvailability()) return;
                      onComposeMessage();
                    }}
                    canApply={!!hasAvailability}
                    onAvailabilityGate={onAvailabilityGate}
                    composing={composingMessage}
                    disabled={applying}
                    lengthUnit={lengthUnit}
                    onViewProfile={onViewProfile}
                    crewCertIds={crewCertIds}
                    crewLangs={crewLangs}
                  />
                )}
              </motion.div>
            )}
          </div>

          {/* Action buttons or message compose */}
          {!loading && topCard && !composingMessage && (
            <div className="flex items-center justify-center gap-6 pb-4">
              <button
                onClick={() => onPass(topCard.id)}
                disabled={applying}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--destructive)] text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)] hover:text-white disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
              <button
                onClick={() => {
                  if (requireAvailability()) onApply(topCard.id);
                }}
                disabled={applying}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--success)] text-[var(--success)] transition-colors hover:bg-[var(--success)] hover:text-white disabled:opacity-50"
              >
                <Check className="h-6 w-6" />
              </button>
            </div>
          )}

          {!loading && topCard && composingMessage && (
            <div className="flex flex-col gap-2 pb-4">
              <div className="relative">
                <textarea
                  value={messageText}
                  onChange={(e) => onMessageTextChange(e.target.value.slice(0, 250))}
                  placeholder="Why are you a great fit for this job?"
                  className="w-full rounded-lg border border-border bg-accent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  maxLength={250}
                  autoFocus
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60">
                  {messageText.length}/250
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onCancelMessage}
                  disabled={applying}
                >
                  Cancel message
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={onMessageSubmit}
                  disabled={applying || !messageText.trim()}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Submit & apply
                </Button>
              </div>
            </div>
          )}

          {/* Counter + loading more */}
          {!loading && cards.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {cards.length} job{cards.length !== 1 ? 's' : ''} available
              {loadingMore && ' · loading more...'}
            </p>
          )}
        </div>
      )}
    </>
  );
}
