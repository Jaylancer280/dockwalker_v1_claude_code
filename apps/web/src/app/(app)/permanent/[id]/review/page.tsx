'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLookups } from '@/hooks/use-lookups';
import { vesselSizeRange } from '@dockwalker/shared';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { ProfileOverlay } from '@/components/profile-overlay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';
import { ExpandableText } from '@/components/expandable-text';

interface Applicant {
  id: string;
  crew_person_id: string;
  status: string;
  message: string | null;
  applied_at: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role_name: string | null;
  role_department: string | null;
  experience_label: string | null;
  certification_ids: string[];
  languages: string[];
  nationality_name: string | null;
  nationality_flag: string | null;
  permanent_availability: string | null;
  notice_period_days: number | null;
  currently_employed: boolean;
  port_name: string | null;
  city_name: string | null;
  vessel_size_exposure_ids: string[];
  shore_experience_categories: string[];
  total_experience_label: string | null;
  cert_match: {
    ok: boolean;
    matched: number;
    total: number;
    missing_count: number;
  } | null;
  cert_extras: number;
}

function availabilityLabel(a: Applicant) {
  if (a.permanent_availability === 'immediate')
    return { text: 'Available immediately', color: 'text-[var(--success)]' };
  if (a.permanent_availability === 'after_notice')
    return { text: `${a.notice_period_days ?? '?'} day notice`, color: 'text-[var(--warning)]' };
  return { text: 'Not specified', color: 'text-muted-foreground' };
}

function daysAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

export default function PermanentReviewPage() {
  const { id: postingId } = useParams<{ id: string }>();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const lookups = useLookups();
  const sizeBandRanges = useMemo(() => {
    const map: Record<string, { min_meters: number; max_meters: number | null }> = {};
    for (const s of lookups.sizeBands) {
      map[s.id] = { min_meters: s.min_meters, max_meters: s.max_meters };
    }
    return map;
  }, [lookups.sizeBands]);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [shortlistCap, setShortlistCap] = useState(5);
  const [shortlistCount, setShortlistCount] = useState(0);
  const [postingStatus, setPostingStatus] = useState('active');
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'applicants' | 'shortlisted'>('applicants');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectConfirm, setSelectConfirm] = useState<Applicant | null>(null);

  // Client-side hat guard: redirect crew away from employer review page
  useEffect(() => {
    const supabase = createClient();
    async function checkHat() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: person } = await supabase
        .from('persons')
        .select('current_hat')
        .eq('id', user.id)
        .single();
      if (person?.current_hat === 'crew') {
        router.push('/discover');
      }
    }
    checkHat();
  }, [router]);

  const fetchReview = useCallback(
    () =>
      safeFetch<{
        applicants?: Applicant[];
        shortlist_cap?: number;
        shortlist_count?: number;
        posting_status?: string;
        selected_crew_id?: string | null;
      }>(`/api/permanent/${postingId}/review`),
    [postingId],
  );

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    const result = await fetchReview();
    if (result.ok) {
      setApplicants(result.data.applicants ?? []);
      setShortlistCap(result.data.shortlist_cap ?? 5);
      setShortlistCount(result.data.shortlist_count ?? 0);
      setPostingStatus(result.data.posting_status ?? 'active');
      setSelectedCrewId(result.data.selected_crew_id ?? null);
    } else {
      showError('Failed to load applicants');
    }
    setLoading(false);
  }, [fetchReview, showError]);

  useEffect(() => {
    let cancelled = false;
    fetchReview().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setApplicants(result.data.applicants ?? []);
        setShortlistCap(result.data.shortlist_cap ?? 5);
        setShortlistCount(result.data.shortlist_count ?? 0);
        setPostingStatus(result.data.posting_status ?? 'active');
        setSelectedCrewId(result.data.selected_crew_id ?? null);
      } else {
        showError('Failed to load applicants');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReview, showError]);

  const applied = applicants.filter((a) => a.status === 'applied');
  const shortlisted = applicants.filter(
    (a) => a.status === 'shortlisted' || a.status === 'selected',
  );

  async function handleShortlist(crewId: string) {
    setActioningId(crewId);
    const result = await safeFetch<{ error?: string }>(
      `/api/permanent/${postingId}/applicants/${crewId}/shortlist`,
      {
        method: 'POST',
      },
    );
    if (result.ok) {
      showSuccess('Candidate shortlisted');
      loadApplicants();
    } else {
      showError('Failed to load applicants');
    }
    setActioningId(null);
  }

  async function handleReject(crewId: string) {
    setActioningId(crewId);
    const result = await safeFetch<{ error?: string }>(
      `/api/permanent/${postingId}/applicants/${crewId}/reject`,
      {
        method: 'POST',
      },
    );
    if (result.ok) {
      showSuccess('Candidate rejected');
      setApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
    } else {
      showError('Failed to load applicants');
    }
    setActioningId(null);
  }

  async function handleSelect(crewId: string) {
    setActioningId(crewId);
    const result = await safeFetch<{ engagementId?: string; error?: string }>(
      `/api/permanent/${postingId}/applicants/${crewId}/select`,
      {
        method: 'POST',
      },
    );
    if (result.ok) {
      showSuccess('Candidate selected — opening conversation');
      if (result.data.engagementId) {
        router.push(`/messages/${result.data.engagementId}`);
      } else {
        loadApplicants();
      }
    } else {
      showError('Failed to load applicants');
    }
    setActioningId(null);
  }

  return (
    <main className="flex min-h-svh flex-col bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-2">
          <Link href="/daywork/mine" className="rounded-full p-1 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Review Applicants</h1>
        </div>
      </div>

      {/* Negotiation banner */}
      {postingStatus === 'in_negotiation' && selectedCrewId && (
        <div className="page-width w-full border-b border-[var(--warning)]/20 bg-[var(--warning-lo)] px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
            <AlertCircle className="h-4 w-4" />
            <span>
              In negotiation with{' '}
              {applicants.find((a) => a.crew_person_id === selectedCrewId)?.display_name ??
                'a candidate'}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="page-width w-full ">
        <UnderlineTabs
          options={[
            { value: 'applicants', label: `Applicants (${applied.length})` },
            { value: 'shortlisted', label: `Shortlisted (${shortlistCount}/${shortlistCap})` },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'applicants' | 'shortlisted')}
        />
      </div>

      {/* Content */}
      <div className="page-width flex w-full flex-1 flex-col gap-3 px-4 py-4">
        {loading && (
          <div className="flex flex-1 items-center justify-center pt-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && activeTab === 'applicants' && applied.length === 0 && (
          <p className="pt-12 text-center text-sm text-muted-foreground">No new applicants</p>
        )}

        {!loading && activeTab === 'shortlisted' && shortlisted.length === 0 && (
          <p className="pt-12 text-center text-sm text-muted-foreground">
            No shortlisted candidates yet
          </p>
        )}

        {!loading && (activeTab === 'applicants' ? applied : shortlisted).length > 0 && (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
            {(activeTab === 'applicants' ? applied : shortlisted).map((app) => (
              <div
                key={app.id}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                {/* Header */}
                <div className="mb-2 flex items-start gap-3">
                  <Avatar src={app.avatar_url} name={app.display_name ?? '?'} size="md" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold tracking-[-0.3px]">
                        {app.display_name ?? 'Unknown'}
                      </span>
                      {app.role_name && <EpauletteBadge roleName={app.role_name} size="sm" />}
                      {app.status === 'selected' && (
                        <Badge variant="status-filling" className="text-xs">
                          In negotiation
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[13px] text-[var(--muted-foreground)]">
                      {app.total_experience_label ? (
                        <span>{app.total_experience_label} sea time</span>
                      ) : (
                        app.experience_label && <span>{app.experience_label}</span>
                      )}
                      {(() => {
                        const sizeRange = vesselSizeRange(
                          app.vessel_size_exposure_ids,
                          sizeBandRanges,
                        );
                        return sizeRange ? <span>· {sizeRange}</span> : null;
                      })()}
                      {app.nationality_flag && <span>{app.nationality_flag}</span>}
                      {app.languages.length > 0 && (
                        <span>
                          {app.languages.length} language{app.languages.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {(app.port_name || app.city_name) && (
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        📍 {[app.port_name, app.city_name].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setProfileId(app.crew_person_id)}
                    className="rounded-full p-1.5 hover:bg-muted"
                  >
                    <User className="h-4 w-4" />
                  </button>
                </div>

                {/* Availability */}
                {(() => {
                  const avail = availabilityLabel(app);
                  return (
                    <p className={`mb-1 text-xs ${avail.color}`}>
                      {avail.text}
                      {app.currently_employed && ' · Currently employed'}
                    </p>
                  );
                })()}

                {/* Cert match indicator — only when posting requires certs.
                    Bundle-aware (Fix 236): a candidate holding AEC 1+2
                    counts as having AEC 1 and AEC 2 individually. The
                    extras pill renders alongside whenever the candidate
                    holds bonus certs not contributing to any requirement
                    — even when requiredCerts is empty (cert_match null). */}
                {(app.cert_match || app.cert_extras > 0) && (
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium">
                    {app.cert_match && (
                      <span
                        className={
                          app.cert_match.ok ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                        }
                      >
                        {app.cert_match.ok
                          ? `✓ All ${app.cert_match.total} required certs`
                          : `⚠ ${app.cert_match.matched}/${app.cert_match.total} certs · ${app.cert_match.missing_count} missing`}
                      </span>
                    )}
                    {app.cert_extras > 0 && (
                      <span className="text-[var(--primary)]">+ {app.cert_extras} additional</span>
                    )}
                  </div>
                )}

                {/* Shore experience categories */}
                {app.shore_experience_categories?.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {app.shore_experience_categories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="rounded-full bg-[var(--success-lo)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]"
                      >
                        {cat}
                      </span>
                    ))}
                    {app.shore_experience_categories.length > 3 && (
                      <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{app.shore_experience_categories.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Bio preview */}
                {app.bio && (
                  <ExpandableText
                    text={app.bio}
                    maxLines={2}
                    className="mb-2 text-xs text-[var(--foreground)]"
                  />
                )}

                {/* Message */}
                {app.message && (
                  <ExpandableText
                    text={`"${app.message}"`}
                    maxLines={2}
                    className="mb-2 rounded-md bg-[var(--surface)] px-2.5 py-1.5 text-xs italic text-[var(--foreground)]"
                  />
                )}

                {/* Applied date */}
                <p className="mb-3 font-mono text-[11px] text-[var(--tertiary)]">
                  Applied {daysAgo(app.applied_at)}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  {activeTab === 'applicants' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningId === app.crew_person_id}
                        onClick={() => handleReject(app.crew_person_id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          actioningId === app.crew_person_id || shortlistCount >= shortlistCap
                        }
                        onClick={() => handleShortlist(app.crew_person_id)}
                      >
                        {shortlistCount >= shortlistCap ? 'Shortlist full' : 'Shortlist'}
                      </Button>
                    </>
                  )}
                  {activeTab === 'shortlisted' && app.status !== 'selected' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actioningId === app.crew_person_id}
                        onClick={() => handleReject(app.crew_person_id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          actioningId === app.crew_person_id || postingStatus === 'in_negotiation'
                        }
                        onClick={() => setSelectConfirm(app)}
                      >
                        {postingStatus === 'in_negotiation' ? 'In negotiation' : 'Select'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Select confirmation dialog */}
      <Dialog open={!!selectConfirm} onOpenChange={() => setSelectConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select {selectConfirm?.display_name}?</DialogTitle>
            <DialogDescription>
              This will open a message thread to negotiate terms. Other shortlisted candidates
              remain on the list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectConfirm(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!actioningId}
              onClick={() => {
                if (selectConfirm) {
                  setSelectConfirm(null);
                  handleSelect(selectConfirm.crew_person_id);
                }
              }}
            >
              Select & open chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile overlay */}
      {profileId && (
        <ProfileOverlay personId={profileId} isOpen={true} onClose={() => setProfileId(null)} />
      )}
    </main>
  );
}
