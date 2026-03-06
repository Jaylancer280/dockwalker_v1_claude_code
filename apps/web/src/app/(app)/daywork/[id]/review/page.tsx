'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import Link from 'next/link';
import {
  ChevronLeft,
  MapPin,
  Award,
  Briefcase,
  Calendar,
  Check,
  X,
  Loader2,
  User,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ApplicantProfile {
  display_name: string;
  bio: string | null;
  yacht_roles: { name: string; department: string } | null;
  experience_brackets: { label: string } | null;
  ports: {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  certification_ids: string[];
  vessel_size_exposure_ids: string[];
}

interface Applicant {
  id: string;
  crew_person_id: string;
  status: string;
  message: string | null;
  created_at: string;
  profiles: ApplicantProfile | null;
  available_days: number;
  past_daywork_count: number;
}

const SWIPE_THRESHOLD = 100;

export default function ReviewApplicantsPage() {
  const { id: dayworkId } = useParams<{ id: string }>();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants`);
    const data = await res.json();
    if (data.applicants) setApplicants(data.applicants);
    setLoading(false);
  }, [dayworkId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fire DAYWORK.VIEWED when a card is shown
  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const top = applicants[0];
    if (top && !viewedRef.current.has(top.crew_person_id)) {
      viewedRef.current.add(top.crew_person_id);
      fetch(`/api/daywork/${dayworkId}/applicants/${top.crew_person_id}/view`, {
        method: 'POST',
      });
    }
  }, [applicants, dayworkId]);

  async function handleAccept(crewId: string) {
    setActing(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants/${crewId}/accept`, {
      method: 'POST',
    });
    if (res.ok) {
      setApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to accept');
    }
    setActing(false);
  }

  async function handleReject(crewId: string) {
    setActing(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants/${crewId}/reject`, {
      method: 'POST',
    });
    if (res.ok) {
      setApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
    }
    setActing(false);
  }

  const topCard = applicants[0] ?? null;
  const nextCard = applicants[1] ?? null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Review Applicants</h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {/* Card stack */}
        <div className="relative flex flex-1 items-start justify-center pt-4">
          {loading && (
            <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading applicants...</p>
            </div>
          )}

          {!loading && applicants.length === 0 && (
            <Card className="w-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">No applicants yet</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No crew have applied to this posting yet. Check back later.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadApplicants}>
                  Refresh
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && applicants.length > 0 && (
            <div className="relative h-[440px] w-full">
              {nextCard && (
                <div className="absolute inset-0 z-0">
                  <ApplicantCard applicant={nextCard} isPreview />
                </div>
              )}

              {topCard && (
                <SwipeableApplicant
                  key={topCard.crew_person_id}
                  applicant={topCard}
                  onAccept={() => handleAccept(topCard.crew_person_id)}
                  onReject={() => handleReject(topCard.crew_person_id)}
                  disabled={acting}
                />
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!loading && topCard && (
          <div className="flex items-center justify-center gap-6 pb-4">
            <button
              onClick={() => handleReject(topCard.crew_person_id)}
              disabled={acting}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => handleAccept(topCard.crew_person_id)}
              disabled={acting}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
            >
              <Check className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Counter */}
        {!loading && applicants.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {applicants.length} applicant{applicants.length !== 1 ? 's' : ''} to review
          </p>
        )}
      </div>
    </main>
  );
}

function SwipeableApplicant({
  applicant,
  onAccept,
  onReject,
  disabled,
}: {
  applicant: Applicant;
  onAccept: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const acceptOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled) return;

    if (info.offset.x > SWIPE_THRESHOLD) {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onAccept, 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      hapticLight();
      animate(x, -400, { duration: 0.3 });
      setTimeout(onReject, 300);
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
        style={{ opacity: acceptOpacity }}
      >
        ACCEPT
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive"
        style={{ opacity: rejectOpacity }}
      >
        REJECT
      </motion.div>

      <ApplicantCard applicant={applicant} />
    </motion.div>
  );
}

function ApplicantCard({ applicant, isPreview }: { applicant: Applicant; isPreview?: boolean }) {
  const profile = applicant.profiles;

  return (
    <div
      className={`h-full w-full rounded-2xl border border-border bg-background shadow-lg ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Name + role */}
        <div className="mb-3">
          <h3 className="text-lg font-bold">{profile?.display_name ?? 'Unknown'}</h3>
          <p className="text-sm text-muted-foreground">
            {profile?.yacht_roles?.name ?? 'No primary role'}
            {profile?.yacht_roles?.department && ` · ${profile.yacht_roles.department}`}
          </p>
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
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {applicant.available_days} available day{applicant.available_days !== 1 ? 's' : ''} in
              range
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
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>
        )}

        {/* Application message */}
        {applicant.message && (
          <div className="mt-3 flex gap-2 rounded-lg bg-accent p-3">
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-sm">{applicant.message}</p>
          </div>
        )}

        <div className="flex-1" />

        {/* Applied date */}
        <p className="mt-2 text-xs text-muted-foreground/60">
          Applied {new Date(applicant.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
