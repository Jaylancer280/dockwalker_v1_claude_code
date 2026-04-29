'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Lock, Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface ProfileResponse {
  person: { id: string; identity_type: string; current_hat: string };
  profile: {
    cv_include_sea_time: boolean | null;
    cv_handle: string | null;
    cv_generated_at: string | null;
  };
}

interface ReferenceRow {
  id: string;
  status: string;
  claimed_referee_name: string;
  claimed_referee_role: string;
  snapshot_vessel_name: string | null;
  snapshot_start_date: string | null;
  snapshot_end_date: string | null;
  include_on_cv: boolean | null;
}

interface ExperienceRow {
  id: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  cv_show_full_vessel: boolean | null;
  vessels: {
    id: string;
    name: string | null;
    nda_flag: boolean | null;
  } | null;
  yacht_roles: { name: string } | null;
}

function Toggle({
  checked,
  onClick,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function CvBuilderSettingsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [hat, setHat] = useState<string>('crew');
  const [seaTime, setSeaTime] = useState<boolean>(false);
  const [refs, setRefs] = useState<ReferenceRow[]>([]);
  const [ndaExperiences, setNdaExperiences] = useState<ExperienceRow[]>([]);

  const load = useCallback(async () => {
    const [profileRes, refsRes, expsRes] = await Promise.all([
      safeFetch<ProfileResponse>('/api/profile'),
      safeFetch<{ outbound: ReferenceRow[] }>('/api/references/mine'),
      safeFetch<{ experiences: ExperienceRow[] }>('/api/experiences'),
    ]);

    if (profileRes.ok) {
      setHat(profileRes.data.person.current_hat);
      setSeaTime(profileRes.data.profile.cv_include_sea_time === true);
    }
    if (refsRes.ok) {
      setRefs(refsRes.data.outbound.filter((r) => r.status === 'accepted'));
    }
    if (expsRes.ok) {
      setNdaExperiences(expsRes.data.experiences.filter((e) => e.vessels?.nda_flag === true));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Wrapped in async IIFE — same pattern as /settings/page.tsx — to keep
    // the setState calls inside `load` async (lint rule
    // react-hooks/set-state-in-effect flags direct synchronous-looking
    // setState in effects).
    void (async () => {
      await load();
    })();
  }, [load]);

  // Hat gate (v2.1) — agent CVs are out of scope. Bounce back to /settings
  // so the agent doesn't land on a section that has nothing for them.
  useEffect(() => {
    if (!loading && hat === 'agent') {
      router.replace('/settings');
    }
  }, [loading, hat, router]);

  function handleComingSoon() {
    showSuccess('DockWalker CV — Coming Soon');
  }

  async function handleSeaTimeToggle() {
    const next = !seaTime;
    setSeaTime(next);
    const res = await safeFetch('/api/cv/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvIncludeSeaTime: next }),
    });
    if (!res.ok) {
      setSeaTime(!next);
      showError(`Couldn't save — ${res.error}`);
    }
  }

  async function handleReferenceToggle(refId: string, current: boolean) {
    const next = !current;
    setRefs((prev) => prev.map((r) => (r.id === refId ? { ...r, include_on_cv: next } : r)));
    const res = await safeFetch('/api/cv/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceId: refId, includeOnCv: next }),
    });
    if (!res.ok) {
      setRefs((prev) => prev.map((r) => (r.id === refId ? { ...r, include_on_cv: current } : r)));
      showError(`Couldn't save — ${res.error}`);
    }
  }

  async function handleExperienceToggle(expId: string, current: boolean) {
    const next = !current;
    setNdaExperiences((prev) =>
      prev.map((e) => (e.id === expId ? { ...e, cv_show_full_vessel: next } : e)),
    );
    const res = await safeFetch('/api/cv/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experienceId: expId, cvShowFullVessel: next }),
    });
    if (!res.ok) {
      setNdaExperiences((prev) =>
        prev.map((e) => (e.id === expId ? { ...e, cv_show_full_vessel: current } : e)),
      );
      showError(`Couldn't save — ${res.error}`);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Render null while the hat-gate redirect is in flight.
  if (hat === 'agent') return null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">CV Builder</h1>
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
        {/* Stage-1 Coming-Soon banner — sets expectations + makes toggles useful in advance */}
        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">DockWalker CV — Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                Configure your CV settings now: choose which references to include, decide which NDA
                experiences to disclose, and toggle sea time inclusion. When the PDF generator
                launches, your settings will be ready and your first download will reflect them — no
                re-configuration needed.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleComingSoon}
              aria-disabled="true"
              aria-label="Generate CV — coming soon"
              title="Generate CV — coming soon"
              className="gap-2 opacity-60"
            >
              <Lock className="h-4 w-4" />
              Generate CV
            </Button>
          </div>
        </section>

        {/* Sea time toggle — fully working */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sea time
          </h2>
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Include sea time totals on my CV</span>
              <span className="text-xs text-muted-foreground">
                Sums every experience&apos;s sea time and nautical miles. Off by default for
                privacy.
              </span>
            </div>
            <Toggle
              checked={seaTime}
              onClick={handleSeaTimeToggle}
              ariaLabel="Include sea time totals on my CV"
            />
          </div>
        </section>

        {/* References list */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            References on my CV
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Your referee consented to display on your DockWalker profile. Toggling this on adds them
            to your downloadable CV. Toggle off any time.
          </p>
          {refs.length === 0 ? (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-sm text-muted-foreground">
              You don&apos;t have any accepted references yet. Add one from{' '}
              <a className="underline" href="/settings/references">
                Settings → References
              </a>
              .
            </div>
          ) : (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
              {refs.map((ref, idx) => (
                <div key={ref.id}>
                  {idx > 0 && <Separator />}
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {ref.claimed_referee_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {ref.claimed_referee_role}
                        {ref.snapshot_vessel_name ? ` · ${ref.snapshot_vessel_name}` : ''}
                      </span>
                    </div>
                    <Toggle
                      checked={ref.include_on_cv === true}
                      onClick={() => handleReferenceToggle(ref.id, ref.include_on_cv === true)}
                      ariaLabel={`Include reference from ${ref.claimed_referee_name} on my CV`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* NDA experiences list — only renders when caller has any */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            NDA vessel disclosure
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Some vessels you&apos;ve worked on have an NDA. Industry norm is to disclose the vessel
            name on a CV (the captain you signed with already knows you worked there). Toggle off to
            mask the name as &ldquo;NDA Vessel&rdquo; on your CV instead.
          </p>
          {ndaExperiences.length === 0 ? (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-sm text-muted-foreground">
              You haven&apos;t recorded any NDA-flagged experiences yet — nothing to configure here.
            </div>
          ) : (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
              {ndaExperiences.map((exp, idx) => (
                <div key={exp.id}>
                  {idx > 0 && <Separator />}
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 truncate text-sm font-medium">
                        <Ship className="h-4 w-4 text-muted-foreground" />
                        {exp.vessels?.name ?? 'NDA Vessel'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {exp.yacht_roles?.name ?? 'Role'} · {new Date(exp.start_date).getFullYear()}
                        {exp.end_date
                          ? ` – ${new Date(exp.end_date).getFullYear()}`
                          : exp.is_current
                            ? ' – Present'
                            : ''}
                      </span>
                    </div>
                    <Toggle
                      checked={exp.cv_show_full_vessel === true}
                      onClick={() =>
                        handleExperienceToggle(exp.id, exp.cv_show_full_vessel === true)
                      }
                      ariaLabel={`Show full vessel name on CV for this experience`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
