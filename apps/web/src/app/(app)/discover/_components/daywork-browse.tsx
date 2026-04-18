'use client';

import { Textarea } from '@/components/ui/textarea';
import { type RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/card-skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { LocationPicker } from '@/components/location-picker';
import { HierarchicalPills, rolesToGroups } from '@/components/hierarchical-pills';
import { convertSizeBandLabel } from '@dockwalker/shared';
import { usePreferences } from '@/hooks/use-preferences';
import { type DayworkCard, type SwipeableCardHandle, JobCard, SwipeableCard } from './daywork-card';

interface LookupItem {
  id: string;
  name: string;
  department?: string;
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
  permanentFeed: React.ReactNode;
  feedError: string | null;
}

export function DayworkBrowse({
  cards,
  loading,
  loadingMore,
  applying,
  composingMessage,
  messageText,
  showFilters,
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
  permanentFeed,
  feedError,
}: DayworkBrowseProps) {
  const prefs = usePreferences();
  const lengthUnit = prefs.lengthUnit;

  const topCard = cards[0] ?? null;
  const nextCard = cards[1] ?? null;

  return (
    <>
      {browseMode === 'permanent' && permanentFeed}

      {browseMode === 'daywork' && (
        <div className="page-width flex w-full flex-1 flex-col gap-3 px-4 pt-4 pb-3">
          {/* Filters panel */}
          {showFilters && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Role</label>
                  <HierarchicalPills
                    groups={rolesToGroups(
                      roles.filter((r): r is typeof r & { department: string } => !!r.department),
                    )}
                    value={filterRoleId === 'all' ? '' : filterRoleId}
                    onValueChange={(v) => setFilterRoleId((v as string) || 'all')}
                    mode="single"
                    placeholder="All roles"
                  />
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
                    <DateInput value={filterStartDate} onChange={setFilterStartDate} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <DateInput value={filterEndDate} onChange={setFilterEndDate} />
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

          {/* Card stack — no flex-1 so the action row sits right below the 420px card, no dead air between */}
          <div className="relative flex items-start justify-center pt-2">
            {loading && (
              <div className="flex w-full max-w-md flex-col gap-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            )}

            {!loading && cards.length === 0 && (
              <EmptyState
                imageSrc="/images/empty-states/discover.jpg"
                title={feedError ? 'Something went wrong' : 'No jobs found'}
                description={
                  feedError ?? 'No daywork postings match your filters. Try widening your search.'
                }
                action={
                  <Button variant="outline" size="sm" onClick={onLoadCards}>
                    Retry
                  </Button>
                }
              />
            )}

            {!loading && cards.length > 0 && (
              <div className="relative mx-auto h-[420px] w-full max-w-md overflow-hidden">
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
              </div>
            )}
          </div>

          {/* Action row: counter + buttons (always visible, swipe still works on the card) */}
          {!loading && topCard && (
            <div className="mx-auto flex w-full max-w-md flex-col gap-2 pb-2">
              {cards.length > 0 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {cards.length} job{cards.length !== 1 ? 's' : ''} available
                  {loadingMore && ' · loading more...'}
                </p>
              )}

              {!composingMessage ? (
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    size="lg"
                    className="h-12 flex-1 text-sm"
                    onClick={() => onPass(topCard.id)}
                    disabled={applying}
                    aria-label="Show next job"
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Show next
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 flex-1 bg-[var(--success)] text-sm text-white hover:brightness-[1.08]"
                    onClick={() => {
                      if (requireAvailability()) onApply(topCard.id);
                    }}
                    disabled={applying}
                    aria-label="Apply to this job"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Textarea
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
            </div>
          )}
        </div>
      )}
    </>
  );
}
