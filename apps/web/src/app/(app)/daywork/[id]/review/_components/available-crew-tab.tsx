'use client';

import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { MapPin, Award, Calendar, X, User, Send, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import type { AvailableCrew } from './types';

const SWIPE_THRESHOLD = 100;

export function AvailableCrewTab({
  availableLoading,
  availableLoaded,
  visibleAvailable,
  invitationCount,
  invitationLimit,
  inviteLimitReached,
  allRoles,
  setAllRoles,
  setAvailableLoaded,
  inviteError,
  acting,
  topCard,
  nextCard,
  requestInvite,
  handlePass,
  setViewProfileId,
}: {
  availableLoading: boolean;
  availableLoaded: boolean;
  visibleAvailable: AvailableCrew[];
  invitationCount: number;
  invitationLimit: number;
  inviteLimitReached: boolean;
  allRoles: boolean;
  setAllRoles: (v: boolean) => void;
  setAvailableLoaded: (v: boolean) => void;
  inviteError: string | null;
  acting: boolean;
  topCard: AvailableCrew | null;
  nextCard: AvailableCrew | null;
  requestInvite: (crew: AvailableCrew) => void;
  handlePass: (personId: string) => void;
  setViewProfileId: (id: string | null) => void;
}) {
  return (
    <>
      {/* allRoles toggle + invitation usage */}
      {availableLoaded && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allRoles}
              onChange={(e) => {
                setAllRoles(e.target.checked);
                setAvailableLoaded(false);
              }}
              className="h-4 w-4 rounded border-border"
            />
            Show all roles
          </label>
          <p className="text-xs text-muted-foreground">
            {invitationCount} of {invitationLimit} invitations used
          </p>
        </div>
      )}

      {/* Invite error message */}
      {inviteError && <p className="text-center text-sm text-destructive">{inviteError}</p>}

      {/* Card stack area */}
      <div className="relative flex flex-1 items-start justify-center pt-4">
        {/* Loading state */}
        {availableLoading && <LoadingSpinner size="md" text="Finding available crew..." />}

        {/* Empty state */}
        {!availableLoading && availableLoaded && visibleAvailable.length === 0 && (
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  {inviteLimitReached ? 'Invitation limit reached' : 'No available crew nearby'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {inviteLimitReached
                  ? `You\u2019ve used all ${invitationLimit} invitations for this posting.`
                  : 'No crew with matching availability found. Try enabling "Show all roles" to broaden the search.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Crew card stack */}
        {!availableLoading && visibleAvailable.length > 0 && (
          <div className="relative h-[440px] w-full">
            {nextCard && (
              <div className="absolute inset-0 z-0">
                <AvailableCrewCard crew={nextCard} isPreview />
              </div>
            )}

            {topCard && (
              <SwipeableAvailableCrew
                key={topCard.person_id}
                crew={topCard}
                onInvite={() => requestInvite(topCard)}
                onPass={() => handlePass(topCard.person_id)}
                disabled={acting || inviteLimitReached}
                onViewProfile={setViewProfileId}
              />
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!availableLoading && topCard && visibleAvailable.length > 0 && (
        <div className="flex items-center justify-center gap-6 pb-4">
          <button
            onClick={() => handlePass(topCard.person_id)}
            disabled={acting}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            onClick={() => requestInvite(topCard)}
            disabled={acting || inviteLimitReached}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
            title={inviteLimitReached ? 'Invitation limit reached' : 'Invite'}
          >
            <Send className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Counter */}
      {!availableLoading && visibleAvailable.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {visibleAvailable.length} crew member{visibleAvailable.length !== 1 ? 's' : ''} available
        </p>
      )}
    </>
  );
}

function SwipeableAvailableCrew({
  crew,
  onInvite,
  onPass,
  disabled,
  onViewProfile,
}: {
  crew: AvailableCrew;
  onInvite: () => void;
  onPass: () => void;
  disabled: boolean;
  onViewProfile?: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const inviteOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled && info.offset.x > SWIPE_THRESHOLD) {
      // Can't invite when disabled (limit reached) — snap back
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      return;
    }

    if (info.offset.x > SWIPE_THRESHOLD) {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onInvite, 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      hapticLight();
      animate(x, -400, { duration: 0.3 });
      setTimeout(onPass, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-success bg-success/10 px-3 py-1 text-sm font-bold text-success"
        style={{ opacity: inviteOpacity }}
      >
        INVITE
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <AvailableCrewCard crew={crew} onViewProfile={onViewProfile} />
    </motion.div>
  );
}

export function AvailableCrewCard({
  crew,
  isPreview,
  onViewProfile,
}: {
  crew: AvailableCrew;
  isPreview?: boolean;
  onViewProfile?: (id: string) => void;
}) {
  return (
    <div
      className={`h-full w-full rounded-2xl border border-border bg-background shadow-lg ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Name + role */}
        <div className="mb-3 flex items-center gap-3">
          <Avatar src={crew.avatar_url ?? null} name={crew.display_name ?? '?'} size="md" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">
                {crew.nationalities?.flag_emoji && (
                  <span className="mr-1">{crew.nationalities.flag_emoji}</span>
                )}
                {crew.display_name ?? 'Unknown'}
              </h3>
              {!isPreview && onViewProfile && (
                <button
                  className="ml-auto p-2 -m-2 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProfile(crew.person_id);
                  }}
                >
                  <User className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <span>{crew.yacht_roles?.name ?? 'No primary role'}</span>
              {crew.yacht_roles?.name && (
                <EpauletteBadge
                  roleName={crew.yacht_roles.name}
                  department={crew.yacht_roles.department}
                  size="sm"
                />
              )}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5">
          {crew.experience_brackets?.label && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{crew.experience_brackets.label} experience</span>
            </div>
          )}

          {crew.ports && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {crew.ports.name}
                {crew.ports.cities?.name && `, ${crew.ports.cities.name}`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 shrink-0 text-success" />
            <span className="font-medium text-success">
              {crew.available_days} available day{crew.available_days !== 1 ? 's' : ''} in range
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(crew.certification_ids?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {crew.certification_ids.length} cert
              {crew.certification_ids.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {(crew.vessel_size_exposure_ids?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {crew.vessel_size_exposure_ids.length} vessel size
              {crew.vessel_size_exposure_ids.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {(crew.languages?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {crew.languages.length} language
              {crew.languages.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Bio */}
        {crew.bio && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{crew.bio}</p>}

        <div className="flex-1" />
      </div>
    </div>
  );
}
