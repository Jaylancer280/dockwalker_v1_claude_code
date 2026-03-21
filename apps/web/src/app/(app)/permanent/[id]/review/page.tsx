'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  nationality_name: string | null;
  nationality_flag: string | null;
  permanent_availability: string | null;
  notice_period_days: number | null;
  currently_employed: boolean;
}

function availabilityLabel(a: Applicant) {
  if (a.permanent_availability === 'immediate')
    return { text: 'Available immediately', color: 'text-green-600' };
  if (a.permanent_availability === 'after_notice')
    return { text: `${a.notice_period_days ?? '?'} day notice`, color: 'text-amber-600' };
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

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/permanent/${postingId}/review`);
      if (res.ok) {
        const data = await res.json();
        setApplicants(data.applicants ?? []);
        setShortlistCap(data.shortlist_cap ?? 5);
        setShortlistCount(data.shortlist_count ?? 0);
        setPostingStatus(data.posting_status ?? 'active');
        setSelectedCrewId(data.selected_crew_id ?? null);
      }
    } catch {
      showError('Failed to load applicants');
    }
    setLoading(false);
  }, [postingId, showError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/permanent/${postingId}/review`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setApplicants(data.applicants ?? []);
          setShortlistCap(data.shortlist_cap ?? 5);
          setShortlistCount(data.shortlist_count ?? 0);
          setPostingStatus(data.posting_status ?? 'active');
          setSelectedCrewId(data.selected_crew_id ?? null);
        }
      } catch {
        if (!cancelled) showError('Failed to load applicants');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postingId]);

  const applied = applicants.filter((a) => a.status === 'applied');
  const shortlisted = applicants.filter(
    (a) => a.status === 'shortlisted' || a.status === 'selected',
  );

  async function handleShortlist(crewId: string) {
    setActioningId(crewId);
    try {
      const res = await fetch(`/api/permanent/${postingId}/applicants/${crewId}/shortlist`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccess('Candidate shortlisted');
        loadApplicants();
      } else {
        showError(data.error ?? 'Failed to shortlist');
      }
    } catch {
      showError('Network error');
    }
    setActioningId(null);
  }

  async function handleReject(crewId: string) {
    setActioningId(crewId);
    try {
      const res = await fetch(`/api/permanent/${postingId}/applicants/${crewId}/reject`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccess('Candidate rejected');
        setApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
      } else {
        showError(data.error ?? 'Failed to reject');
      }
    } catch {
      showError('Network error');
    }
    setActioningId(null);
  }

  async function handleSelect(crewId: string) {
    setActioningId(crewId);
    try {
      const res = await fetch(`/api/permanent/${postingId}/applicants/${crewId}/select`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccess('Candidate selected — opening conversation');
        if (data.engagementId) {
          router.push(`/messages/${data.engagementId}`);
        } else {
          loadApplicants();
        }
      } else {
        showError(data.error ?? 'Failed to select');
      }
    } catch {
      showError('Network error');
    }
    setActioningId(null);
  }

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Link href="/daywork/mine" className="rounded-full p-1 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">Review Applicants</h1>
        </div>
      </div>

      {/* Negotiation banner */}
      {postingStatus === 'in_negotiation' && selectedCrewId && (
        <div className="mx-auto w-full max-w-lg border-b bg-amber-50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-800">
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
      <div className="mx-auto flex w-full max-w-lg border-b">
        <button
          onClick={() => setActiveTab('applicants')}
          className={`flex-1 py-2 text-center text-sm font-medium ${activeTab === 'applicants' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Applicants ({applied.length})
        </button>
        <button
          onClick={() => setActiveTab('shortlisted')}
          className={`flex-1 py-2 text-center text-sm font-medium ${activeTab === 'shortlisted' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Shortlisted ({shortlistCount}/{shortlistCap})
        </button>
      </div>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-4">
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

        {!loading &&
          (activeTab === 'applicants' ? applied : shortlisted).map((app) => (
            <div key={app.id} className="rounded-xl border bg-card p-4">
              {/* Header */}
              <div className="mb-2 flex items-start gap-3">
                <Avatar src={app.avatar_url} name={app.display_name ?? '?'} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{app.display_name ?? 'Unknown'}</span>
                    {app.role_name && <EpauletteBadge roleName={app.role_name} size="sm" />}
                    {app.status === 'selected' && (
                      <Badge variant="default" className="text-xs">
                        In negotiation
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {app.experience_label && <span>{app.experience_label}</span>}
                    {app.nationality_flag && <span>{app.nationality_flag}</span>}
                  </div>
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

              {/* Message */}
              {app.message && (
                <p className="mb-2 line-clamp-2 text-xs text-muted-foreground italic">
                  &quot;{app.message}&quot;
                </p>
              )}

              {/* Applied date */}
              <p className="mb-3 text-xs text-muted-foreground">
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
