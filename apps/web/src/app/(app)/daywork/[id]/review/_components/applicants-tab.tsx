'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { MapPin, Award, Briefcase, Calendar, Check, X, User, Star } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import type { Applicant, TabView } from './types';

const SWIPE_THRESHOLD_RATIO = 0.33;
const EXIT_RATIO = 1.3;

export function ApplicantsTab({
  tab,
  loading,
  error,
  applicants,
  shortlisted,
  acting,
  topCard,
  nextCard,
  handleShortlist,
  requestAccept,
  handleReject,
  loadApplicants,
  setTab,
  setViewProfileId,
}: {
  tab: TabView;
  loading: boolean;
  error: string | null;
  applicants: Applicant[];
  shortlisted: Applicant[];
  acting: boolean;
  topCard: Applicant | null;
  nextCard: Applicant | null;
  handleShortlist: (crewId: string) => void;
  requestAccept: (crewId: string) => void;
  handleReject: (crewId: string) => void;
  loadApplicants: () => void;
  setTab: (tab: TabView) => void;
  setViewProfileId: (id: string | null) => void;
}) {
  const currentStack = tab === 'applicants' ? applicants : shortlisted;

  return (
    <>
      {/* Card stack */}
      <div className="relative flex flex-1 items-start justify-center pt-4">
        {/* Loading state */}
        {loading && <LoadingSpinner size="md" text="Loading applicants..." />}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 pt-20 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={loadApplicants}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty states */}
        {!loading && !error && currentStack.length === 0 && (
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                {tab === 'applicants' ? (
                  <User className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Star className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle className="text-base">
                  {tab === 'applicants' ? 'No applicants to review' : 'Shortlist is empty'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {tab === 'applicants'
                  ? 'No new applications to review. Check back later or view your shortlist.'
                  : 'Shortlist crew from the Applicants tab to compare them here.'}
              </p>
              {tab === 'applicants' && (
                <Button variant="outline" size="sm" className="mt-3" onClick={loadApplicants}>
                  Refresh
                </Button>
              )}
              {tab === 'shortlist' && applicants.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setTab('applicants')}
                >
                  View applicants
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && currentStack.length > 0 && (
          <div className="relative mx-auto h-[440px] w-full max-w-md">
            {nextCard && (
              <div className="absolute inset-0 z-0">
                <ApplicantCard applicant={nextCard} isPreview />
              </div>
            )}

            {topCard && (
              <SwipeableApplicant
                key={topCard.crew_person_id}
                applicant={topCard}
                tab={tab}
                onAccept={() => requestAccept(topCard.crew_person_id)}
                onReject={() => handleReject(topCard.crew_person_id)}
                onShortlist={() => handleShortlist(topCard.crew_person_id)}
                disabled={acting}
                onViewProfile={setViewProfileId}
              />
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!loading && topCard && (
        <div className="mx-auto flex max-w-md items-center justify-center gap-6 pb-4">
          <button
            onClick={() => handleReject(topCard.crew_person_id)}
            disabled={acting}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--destructive)] text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)] hover:text-white disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
          {tab === 'applicants' && (
            <button
              onClick={() => handleShortlist(topCard.crew_person_id)}
              disabled={acting}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--warning)] text-[var(--warning)] transition-colors hover:bg-[var(--warning)] hover:text-white disabled:opacity-50"
            >
              <Star className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => requestAccept(topCard.crew_person_id)}
            disabled={acting}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--success)] text-[var(--success)] transition-colors hover:bg-[var(--success)] hover:text-white disabled:opacity-50"
          >
            <Check className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Counter */}
      {!loading && currentStack.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {currentStack.length} {tab === 'applicants' ? 'applicant' : 'shortlisted'}
          {currentStack.length !== 1 ? 's' : ''} to review
        </p>
      )}
    </>
  );
}

function SwipeableApplicant({
  applicant,
  tab,
  onAccept,
  onReject,
  onShortlist,
  disabled,
  onViewProfile,
}: {
  applicant: Applicant;
  tab: TabView;
  onAccept: () => void;
  onReject: () => void;
  onShortlist: () => void;
  disabled: boolean;
  onViewProfile?: (personId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const getWidth = () => containerRef.current?.offsetWidth ?? 300;
  const getThreshold = () => getWidth() * SWIPE_THRESHOLD_RATIO;
  const getExit = () => getWidth() * EXIT_RATIO;
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const acceptOpacity = useTransform(x, [0, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);
  const shortlistOpacity = useTransform(y, [-100, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled) return;
    const threshold = getThreshold();
    const exit = getExit();

    // Upward swipe = shortlist (only on applicants tab)
    if (tab === 'applicants' && info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      hapticLight();
      animate(y, -exit, { duration: 0.3 });
      setTimeout(onShortlist, 300);
    } else if (info.offset.x > threshold) {
      hapticMedium();
      animate(x, exit, { duration: 0.3 });
      setTimeout(onAccept, 300);
    } else if (info.offset.x < -threshold) {
      hapticLight();
      animate(x, -exit, { duration: 0.3 });
      setTimeout(onReject, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      ref={containerRef}
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-[var(--success)] bg-[var(--success-lo)] px-3 py-1 text-sm font-bold text-[var(--success)]"
        style={{ opacity: acceptOpacity }}
      >
        ACCEPT
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-[var(--destructive)] bg-[var(--destructive-lo)] px-3 py-1 text-sm font-bold text-[var(--destructive)]"
        style={{ opacity: rejectOpacity }}
      >
        REJECT
      </motion.div>
      {tab === 'applicants' && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border-2 border-[var(--warning)] bg-[var(--warning-lo)] px-3 py-1 text-sm font-bold text-[var(--warning)]"
          style={{ opacity: shortlistOpacity }}
        >
          SHORTLIST
        </motion.div>
      )}

      <ApplicantCard applicant={applicant} onViewProfile={onViewProfile} />
    </motion.div>
  );
}

export function ApplicantCard({
  applicant,
  isPreview,
  onViewProfile,
}: {
  applicant: Applicant;
  isPreview?: boolean;
  onViewProfile?: (personId: string) => void;
}) {
  const profile = applicant.profiles;

  return (
    <div
      className={`h-full w-full rounded-[14px] border border-[var(--border)] bg-[var(--card)] ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Name + role */}
        <div className="mb-3 flex items-center gap-3">
          <Avatar src={profile?.avatar_url ?? null} name={profile?.display_name ?? '?'} size="md" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-[-0.3px]">
                {profile?.nationalities?.flag_emoji && (
                  <span className="mr-1">{profile.nationalities.flag_emoji}</span>
                )}
                {profile?.display_name ?? 'Unknown'}
                {profile?.deck_name && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({'\u201C'}
                    {profile.deck_name}
                    {'\u201D'})
                  </span>
                )}
              </h3>
              {applicant.status === 'shortlisted' && (
                <Star className="h-4 w-4 fill-[var(--warning)] text-[var(--warning)]" />
              )}
              {applicant.source === 'invitation' && (
                <span className="rounded-full bg-[var(--accent-lo)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                  Invited
                </span>
              )}
              {!isPreview && (
                <button
                  className="ml-auto p-2 -m-2 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProfile?.(applicant.crew_person_id);
                  }}
                >
                  <User className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <span>{profile?.yacht_roles?.name ?? 'No primary role'}</span>
              {profile?.yacht_roles?.name && (
                <EpauletteBadge
                  roleName={profile.yacht_roles.name}
                  department={profile.yacht_roles.department}
                  size="sm"
                />
              )}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5">
          {profile?.experience_brackets?.label && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{profile.experience_brackets.label} experience</span>
            </div>
          )}

          {profile?.ports && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {profile.ports.name}
                {profile.ports.cities?.name && `, ${profile.ports.cities.name}`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Calendar
              className={`h-4 w-4 shrink-0 ${applicant.availability_not_available ? 'text-destructive' : 'text-muted-foreground'}`}
            />
            <span className={applicant.availability_not_available ? 'text-destructive' : ''}>
              {applicant.availability_not_available
                ? 'Not available'
                : `${applicant.available_days} available day${applicant.available_days !== 1 ? 's' : ''} in range`}
              {applicant.availability_city && ` \u00B7 ${applicant.availability_city}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {applicant.past_daywork_count} past daywork
              {applicant.past_daywork_count !== 1 ? 's' : ''} completed
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(profile?.certification_ids?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {profile!.certification_ids.length} cert
              {profile!.certification_ids.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {(profile?.vessel_size_exposure_ids?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {profile!.vessel_size_exposure_ids.length} vessel size
              {profile!.vessel_size_exposure_ids.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {(profile?.languages?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {profile!.languages.length} language
              {profile!.languages.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>
        )}

        {/* Smoker / Tattoos */}
        {(profile?.smoker != null || profile?.visible_tattoos != null) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {profile?.smoker != null && <span>{profile.smoker ? 'Smoker' : 'Non-smoker'}</span>}
            {profile?.visible_tattoos != null && (
              <span>{profile.visible_tattoos ? 'Visible tattoos' : 'No visible tattoos'}</span>
            )}
          </div>
        )}

        {/* Application message */}
        {applicant.message && (
          <div className="mt-3 rounded-md bg-[var(--surface)] px-2.5 py-1.5">
            <p className="text-xs italic text-[var(--foreground)]">
              &ldquo;{applicant.message}&rdquo;
            </p>
          </div>
        )}

        <div className="flex-1" />

        {/* Applied date */}
        <p className="mt-2 font-mono text-[11px] text-[var(--tertiary)]">
          Applied {new Date(applicant.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
