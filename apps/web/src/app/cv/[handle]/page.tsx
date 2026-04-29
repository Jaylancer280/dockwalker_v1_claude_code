'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Anchor,
  Briefcase,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  MapPin,
  Ship,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';

type Tombstone = { tombstone: true };
type CvPayload = {
  tombstone: false;
  stale: boolean;
  cv_generated_at: string | null;
  person_id: string;
  display_name: string;
  deck_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  primary_role: { id: string; name: string; department: string } | null;
  permanent_availability: 'immediate' | 'after_notice' | 'not_looking' | null;
  notice_period_days: number | null;
  currently_employed: boolean;
  smoker: boolean | null;
  visible_tattoos: boolean | null;
  languages: string[];
  location_port: { id: string; name: string; cities?: { name: string } } | null;
  location_city: { id: string; name: string; regions?: { name: string } } | null;
  nationalities: { id: string; name: string; flag_emoji: string }[];
  entry_rights: { id: string; name: string; category: string }[];
  certifications: { id: string; name: string; category: string; subcategory: string | null }[];
  experiences: ExperienceCard[];
  references: ReferenceCard[];
  sea_time: { days: number; nautical_miles: number } | null;
};
type Response = Tombstone | CvPayload;

interface ExperienceCard {
  id: string;
  vessel_name: string | null;
  vessel_imo: string | null;
  vessel_type: string | null;
  nda_masked: boolean;
  role: { id: string; name: string; department: string } | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  vessel_operation: string | null;
  flag_state: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
}

interface ReferenceCard {
  id: string;
  claimed_referee_name: string;
  claimed_referee_role: string;
  comment: string | null;
  consented_at: string | null;
  snapshot_vessel_name: string | null;
  snapshot_start_date: string | null;
  snapshot_end_date: string | null;
  nda_masked: boolean;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
  });
}

function fmtRange(start: string, end: string | null, isCurrent: boolean): string {
  const left = fmtDate(start);
  if (isCurrent && !end) return `${left} – Present`;
  if (!end) return left;
  return `${left} – ${fmtDate(end)}`;
}

function AvailabilityBadge({
  availability,
  noticeDays,
}: {
  availability: CvPayload['permanent_availability'];
  noticeDays: number | null;
}) {
  // Spec §5: PERMANENT availability only on the QR-landing teaser.
  // Daywork's rolling 14-day window is too volatile for a printed CV.
  if (availability === 'immediate') {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        Available now
      </Badge>
    );
  }
  if (availability === 'after_notice') {
    return (
      <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
        Available in {noticeDays ?? '?'} days
      </Badge>
    );
  }
  if (availability === 'not_looking') {
    return <Badge variant="secondary">Not currently looking — open to discuss</Badge>;
  }
  // Spec §5 doesn't cover "no value"; we just hide.
  return null;
}

function StaleBanner({ generatedAt }: { generatedAt: string | null }) {
  if (!generatedAt) return null;
  return (
    <div className="rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      This CV was generated on {fmtDate(generatedAt)}. Profile has been updated since.
    </div>
  );
}

function Tombstone() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="page-width-narrow flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">CV no longer available</h1>
        <p className="text-sm text-muted-foreground">
          This crew member is no longer active on DockWalker. Browse other crew or sign up to find
          similar profiles.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm">
            <a href="/auth/signup">Sign up</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/discover">Browse crew</a>
          </Button>
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="page-width-narrow flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <h1 className="text-xl font-semibold">CV not found</h1>
        <p className="text-sm text-muted-foreground">
          The link may be broken, or this CV has been regenerated. Ask the crew member for an
          updated link.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to DockWalker</Link>
        </Button>
      </div>
    </main>
  );
}

export default function CvLandingPage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;

  const [data, setData] = useState<Response | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authedHat, setAuthedHat] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // Cheap auth read so we know which render state to use. We don't gate
      // anything on auth here — the route itself returns the same payload.
      try {
        const supabase = createClient();
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes.user) {
          const { data: personRow } = await supabase
            .from('persons')
            .select('current_hat')
            .eq('id', userRes.user.id)
            .single();
          setAuthedHat((personRow?.current_hat as string | null) ?? null);
        }
      } catch {
        // Anon — leave authedHat null.
      }

      const res = await safeFetch<Response>(`/api/cv/${handle}`);
      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true);
        }
        setLoading(false);
        return;
      }
      setData(res.data);
      setLoading(false);
    })();
  }, [handle]);

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (notFound) return <NotFound />;
  if (!data) return <NotFound />;
  if (data.tombstone) return <Tombstone />;

  const cv = data;
  const isSignedOut = authedHat === null;
  const isCrewHat = authedHat === 'crew';
  const isEmployerOrAgent = authedHat === 'employer' || authedHat === 'agent';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Anchor className="h-5 w-5" />
            DockWalker
          </Link>
          {isSignedOut ? (
            <Button size="sm" asChild>
              <a href={`/auth/signup?redirect=${encodeURIComponent(`/cv/${handle}`)}`}>Sign up</a>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
        {cv.stale ? <StaleBanner generatedAt={cv.cv_generated_at} /> : null}

        {/* Identity block — visible to everyone. The teaser/full split below
            controls how much detail follows. */}
        <section className="flex items-start gap-4">
          <Avatar src={cv.avatar_url} name={cv.display_name} size="lg" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{cv.display_name}</h1>
              {cv.nationalities[0]?.flag_emoji ? (
                <span className="text-lg" aria-hidden>
                  {cv.nationalities[0].flag_emoji}
                </span>
              ) : null}
              {cv.primary_role ? (
                <EpauletteBadge
                  roleName={cv.primary_role.name}
                  department={cv.primary_role.department}
                  size="sm"
                />
              ) : null}
            </div>
            {cv.deck_name ? (
              <p className="text-sm italic text-muted-foreground">&ldquo;{cv.deck_name}&rdquo;</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <AvailabilityBadge
                availability={cv.permanent_availability}
                noticeDays={cv.notice_period_days}
              />
              {cv.location_city ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {cv.location_city.name}
                  {cv.location_city.regions ? `, ${cv.location_city.regions.name}` : ''}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* State 1: signed-out → teaser only. Single CTA: sign up. */}
        {isSignedOut ? (
          <section className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <p className="text-sm font-medium">Sign up to view full profile</p>
            <p className="mt-1 text-xs text-muted-foreground">
              See {cv.display_name.split(' ')[0]}&apos;s full experience, certifications, and
              references — and reach out on the platform.
            </p>
            <Button className="mt-4" size="sm" asChild>
              <a href={`/auth/signup?redirect=${encodeURIComponent(`/cv/${handle}`)}`}>
                Create your DockWalker account
              </a>
            </Button>
          </section>
        ) : null}

        {/* State 3: signed-in crew → hat-switch hint + full data fallback. */}
        {isCrewHat ? (
          <section className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
            <p className="font-medium">You&apos;re viewing as crew</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch to your employer hat to hire this crew or contact references.
            </p>
          </section>
        ) : null}

        {/* State 2: signed-in employer/agent → full profile + sticky action bar.
            Phase 5b wires the Hire actions: both navigate to the existing
            post forms with `?invite=<personId>` so the captain reuses the
            proven posting UI (vessel selector, role picker, dates, etc.).
            The form fires the right combination atomically:
              - daywork: POST /api/daywork with inviteCrewPersonId →
                DAYWORK.POSTED + DAYWORK.INVITED in one transaction
              - permanent: POST /api/permanent (creates posting) → POST
                /api/permanent/[id]/invite (PERMANENT.INVITED)
            "Contact a reference" stays inert pending Phase 6 wiring on
            the existing reference-contact API. */}
        {isEmployerOrAgent ? (
          <section className="sticky top-0 z-10 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link
                  href={`/daywork/post?invite=${encodeURIComponent(cv.person_id)}`}
                  prefetch={false}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Hire daywork
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={`/daywork/post?invite=${encodeURIComponent(cv.person_id)}&type=permanent`}
                  prefetch={false}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Hire permanent
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled
                aria-disabled="true"
                title="Contact reference — coming soon"
                className="opacity-60"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact a reference
              </Button>
            </div>
          </section>
        ) : null}

        {/* Bio — shown for signed-in callers (any hat). The teaser hides
            it so signed-out scrapers can't extract free-form data. */}
        {!isSignedOut && cv.bio ? (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </h2>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              {cv.bio}
            </div>
          </section>
        ) : null}

        {/* Experiences — full list for signed-in, hidden for signed-out. */}
        {!isSignedOut && cv.experiences.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Experience
            </h2>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
              {cv.experiences.map((exp, idx) => (
                <div key={exp.id}>
                  {idx > 0 ? <Separator /> : null}
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Ship className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{exp.vessel_name ?? '—'}</span>
                        {exp.nda_masked ? (
                          <Badge variant="secondary" className="text-[10px]">
                            NDA
                          </Badge>
                        ) : null}
                        {exp.role ? (
                          <EpauletteBadge
                            roleName={exp.role.name}
                            department={exp.role.department}
                            size="sm"
                          />
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {fmtRange(exp.start_date, exp.end_date, exp.is_current)}
                      </span>
                      {exp.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{exp.description}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* References — opt-in per-reference. */}
        {!isSignedOut && cv.references.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              References
            </h2>
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
              {cv.references.map((ref, idx) => (
                <div key={ref.id}>
                  {idx > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium">{ref.claimed_referee_name}</span>
                      <span className="text-xs text-muted-foreground">
                        · {ref.claimed_referee_role}
                      </span>
                      {ref.snapshot_vessel_name ? (
                        <span className="text-xs text-muted-foreground">
                          · {ref.snapshot_vessel_name}
                        </span>
                      ) : null}
                    </div>
                    {ref.comment ? (
                      <p className="text-xs italic text-muted-foreground">
                        &ldquo;{ref.comment}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Certifications */}
        {!isSignedOut && cv.certifications.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Certifications
            </h2>
            <div className="flex flex-wrap gap-2">
              {cv.certifications.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-xs">
                  {c.name}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        {/* Languages + Entry rights */}
        {!isSignedOut ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cv.languages.length > 0 ? (
              <div>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  Languages
                </h2>
                <div className="flex flex-wrap gap-2">
                  {cv.languages.map((l) => (
                    <Badge key={l} variant="outline" className="text-xs">
                      {l.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {cv.entry_rights.length > 0 ? (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Right to work
                </h2>
                <div className="flex flex-wrap gap-2">
                  {cv.entry_rights.map((er) => (
                    <Badge key={er.id} variant="outline" className="text-xs">
                      {er.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Sea time totals — opt-in (default OFF) */}
        {!isSignedOut && cv.sea_time ? (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sea time
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-2xl font-semibold">{cv.sea_time.days}</p>
                <p className="text-xs text-muted-foreground">days at sea</p>
              </div>
              <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-2xl font-semibold">
                  {cv.sea_time.nautical_miles.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">nautical miles</p>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="mt-6 flex items-center justify-center gap-2 border-t border-[var(--border)] pt-4 text-xs text-muted-foreground">
          Generated by DockWalker · dockwalker.io
          {cv.cv_generated_at ? <> · {fmtDate(cv.cv_generated_at)}</> : null}
          <Link href="/" className="ml-1 inline-flex items-center gap-1 underline">
            Visit
            <ExternalLink className="h-3 w-3" />
          </Link>
        </footer>
      </div>
    </main>
  );
}
