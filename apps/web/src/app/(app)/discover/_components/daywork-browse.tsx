'use client';

import { type RefObject } from 'react';
import { Briefcase, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="mx-auto flex max-w-lg gap-1 rounded-lg bg-muted p-1 mt-2 px-4">
        <button
          onClick={() => {
            setBrowseMode('daywork');
            localStorage.setItem('dw-browse-mode', 'daywork');
          }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${browseMode === 'daywork' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Daywork
        </button>
        <button
          onClick={() => {
            setBrowseMode('permanent');
            localStorage.setItem('dw-browse-mode', 'permanent');
          }}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${browseMode === 'permanent' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Permanent
        </button>
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
            {loading && (
              <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Finding jobs...</p>
              </div>
            )}

            {!loading && cards.length === 0 && (
              <Card className="w-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">No jobs found</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    No daywork postings match your filters right now. Try adjusting your filters or
                    check back later.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={onLoadCards}>
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            )}

            {!loading && cards.length > 0 && (
              <div className="relative h-[420px] w-full overflow-hidden">
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

          {/* Action buttons or message compose */}
          {!loading && topCard && !composingMessage && (
            <div className="flex items-center justify-center gap-6 pb-4">
              <button
                onClick={() => onPass(topCard.id)}
                disabled={applying}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
              <button
                onClick={() => {
                  if (requireAvailability()) onApply(topCard.id);
                }}
                disabled={applying}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
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
