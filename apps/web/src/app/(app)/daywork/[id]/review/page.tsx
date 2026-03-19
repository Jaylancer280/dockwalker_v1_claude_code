'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
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
  Star,
  SlidersHorizontal,
  Send,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/avatar';
import { EpauletteBadge } from '@/components/epaulette-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { ProfileOverlay } from '@/components/profile-overlay';
import { MY_JOBS_TAB_STORAGE_KEY } from '@/lib/my-jobs-tab';

interface ApplicantProfile {
  display_name: string;
  avatar_url: string | null;
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
  availability_city: string | null;
  availability_not_available: boolean;
  past_daywork_count: number;
}

interface AvailableCrew {
  person_id: string;
  display_name: string;
  avatar_url: string | null;
  primary_role_id: string;
  certification_ids: string[];
  experience_bracket_id: string;
  vessel_size_exposure_ids: string[];
  bio: string | null;
  location_port_id: string;
  yacht_roles: { name: string; department: string } | null;
  experience_brackets: { label: string } | null;
  ports: {
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  available_days: number;
}

type TabView = 'applicants' | 'shortlist' | 'available';

const SWIPE_THRESHOLD = 100;

export default function ReviewApplicantsPage() {
  const { id: dayworkId } = useParams<{ id: string }>();
  const router = useRouter();
  const { showError } = useToast();
  const [allApplicants, setAllApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [tab, setTab] = useState<TabView>('applicants');
  const [acceptedDialog, setAcceptedDialog] = useState<{
    crewName: string;
    engagementId: string;
  } | null>(null);
  const [pendingAccept, setPendingAccept] = useState<{
    crewId: string;
    crewName: string;
  } | null>(null);

  // Profile overlay
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterCertId, setFilterCertId] = useState('');
  const [filterMinDays, setFilterMinDays] = useState('');
  const [certifications, setCertifications] = useState<{ id: string; name: string }[]>([]);

  // Available crew state
  const [availableCrew, setAvailableCrew] = useState<AvailableCrew[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableLoaded, setAvailableLoaded] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const [invitationLimit, setInvitationLimit] = useState(2);
  const [positionsAvailable, setPositionsAvailable] = useState(1);
  const [positionsFilled, setPositionsFilled] = useState(0);
  const [permanentOpportunity, setPermanentOpportunity] = useState(false);
  const [allRoles, setAllRoles] = useState(false);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<AvailableCrew | null>(null);
  const [dayworkMeta, setDayworkMeta] = useState<{
    job_number: number | null;
    role_name: string | null;
  }>({ job_number: null, role_name: null });

  // Load certifications for filter dropdown + daywork meta for invite dialog
  useEffect(() => {
    const supabase = createClient();
    async function loadCerts() {
      const { data } = await supabase.from('certifications').select('id, name').order('name');
      if (data) setCertifications(data);
    }
    async function loadDayworkMeta() {
      const { data } = await supabase
        .from('dayworks')
        .select('job_number, yacht_roles:role_id(name)')
        .eq('id', dayworkId)
        .single();
      if (data) {
        const role = data.yacht_roles as unknown as { name: string } | null;
        setDayworkMeta({ job_number: data.job_number, role_name: role?.name ?? null });
      }
    }
    loadCerts();
    loadDayworkMeta();
  }, [dayworkId]);

  const applicants = allApplicants.filter((a) => a.status === 'applied' || a.status === 'viewed');
  const shortlisted = allApplicants.filter((a) => a.status === 'shortlisted');

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
      if (filterMinDays) params.set('minAvailableDays', filterMinDays);
      const qs = params.toString();
      const res = await fetch(`/api/daywork/${dayworkId}/applicants${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (data.applicants) setAllApplicants(data.applicants);
      if (data.positions_available !== undefined) setPositionsAvailable(data.positions_available);
      if (data.positions_filled !== undefined) setPositionsFilled(data.positions_filled);
      if (data.permanent_opportunity !== undefined)
        setPermanentOpportunity(data.permanent_opportunity);
      setError(null);
    } catch {
      setError('Failed to load applicants. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dayworkId, filterCertId, filterMinDays]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const loadAvailableCrew = useCallback(async () => {
    setAvailableLoading(true);
    try {
      const params = new URLSearchParams();
      if (allRoles) params.set('allRoles', 'true');
      const qs = params.toString();
      const res = await fetch(`/api/daywork/${dayworkId}/available-crew${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setAvailableCrew(data.crew ?? []);
      setInvitationCount(data.invitation_count ?? 0);
      if (data.invitation_limit !== undefined) setInvitationLimit(data.invitation_limit);
    } catch {
      setAvailableCrew([]);
    } finally {
      setAvailableLoading(false);
      setAvailableLoaded(true);
    }
  }, [dayworkId, allRoles]);

  // Lazy load: fetch available crew only when tab is first activated
  useEffect(() => {
    if (tab === 'available' && !availableLoaded) {
      loadAvailableCrew();
    }
  }, [tab, availableLoaded, loadAvailableCrew]);

  // Re-fetch when allRoles changes (only if tab is active)
  useEffect(() => {
    if (tab === 'available' && availableLoaded) {
      loadAvailableCrew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRoles]);

  // Filter out passed crew from the visible stack
  const visibleAvailable = availableCrew.filter((c) => !passedIds.has(c.person_id));

  // Fire DAYWORK.VIEWED when a card is shown
  const viewedRef = useRef<Set<string>>(new Set());
  const applicantStack = tab === 'applicants' ? applicants : shortlisted;
  useEffect(() => {
    const top = applicantStack[0];
    if (top && !viewedRef.current.has(top.crew_person_id)) {
      viewedRef.current.add(top.crew_person_id);
      fetch(`/api/daywork/${dayworkId}/applicants/${top.crew_person_id}/view`, {
        method: 'POST',
      });
    }
  }, [applicantStack, dayworkId]);

  async function handleShortlist(crewId: string) {
    setActing(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants/${crewId}/shortlist`, {
      method: 'POST',
    });
    if (res.ok) {
      setAllApplicants((prev) =>
        prev.map((a) => (a.crew_person_id === crewId ? { ...a, status: 'shortlisted' } : a)),
      );
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? 'Failed to shortlist');
    }
    setActing(false);
  }

  function requestAccept(crewId: string) {
    const applicant = allApplicants.find((a) => a.crew_person_id === crewId);
    const crewName = applicant?.profiles?.display_name ?? 'this crew member';
    setPendingAccept({ crewId, crewName });
  }

  async function handleAccept(crewId: string) {
    setActing(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants/${crewId}/accept`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      const accepted = allApplicants.find((a) => a.crew_person_id === crewId);
      const crewName = accepted?.profiles?.display_name ?? 'the crew member';
      const newFilled = positionsFilled + 1;
      setPositionsFilled(newFilled);

      if (newFilled >= positionsAvailable) {
        // Fully filled — all remaining applicants auto-rejected server-side
        window.sessionStorage.setItem(MY_JOBS_TAB_STORAGE_KEY, 'in_progress');
        setAllApplicants([]);
      } else {
        // Multi-crew with remaining positions — remove accepted, keep others
        setAllApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
      }

      if (data.engagementId) {
        setAcceptedDialog({ crewName, engagementId: data.engagementId });
      }
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? 'Failed to accept');
    }
    setActing(false);
  }

  async function handleReject(crewId: string) {
    setActing(true);
    const res = await fetch(`/api/daywork/${dayworkId}/applicants/${crewId}/reject`, {
      method: 'POST',
    });
    if (res.ok) {
      setAllApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? 'Failed to reject');
    }
    setActing(false);
  }

  async function handleInvite(personId: string) {
    setActing(true);
    setInviteError(null);
    const res = await fetch(`/api/daywork/${dayworkId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crewPersonId: personId }),
    });
    if (res.ok) {
      setAvailableCrew((prev) => prev.filter((c) => c.person_id !== personId));
      setInvitationCount((prev) => prev + 1);
    } else {
      const data = await res.json().catch(() => ({}));
      setInviteError(data.error ?? 'Failed to send invitation');
    }
    setActing(false);
  }

  function requestInvite(crew: AvailableCrew) {
    setPendingInvite(crew);
  }

  function handlePass(personId: string) {
    setPassedIds((prev) => new Set(prev).add(personId));
  }

  const currentStack = tab === 'available' ? [] : tab === 'applicants' ? applicants : shortlisted;
  const topCard = tab === 'available' ? (visibleAvailable[0] ?? null) : (currentStack[0] ?? null);
  const nextCard = tab === 'available' ? (visibleAvailable[1] ?? null) : (currentStack[1] ?? null);
  const inviteLimitReached = invitationCount >= invitationLimit;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Review</h1>
            {positionsAvailable > 1 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {positionsFilled}/{positionsAvailable} filled
              </span>
            )}
            {permanentOpportunity && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                Could go permanent
              </span>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Filters
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto w-full max-w-lg border-b border-border">
        <div className="flex">
          <button
            onClick={() => setTab('applicants')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'applicants'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Applicants{applicants.length > 0 ? ` (${applicants.length})` : ''}
          </button>
          <button
            onClick={() => setTab('shortlist')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'shortlist'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Shortlist{shortlisted.length > 0 ? ` (${shortlisted.length})` : ''}
          </button>
          <button
            onClick={() => setTab('available')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'available'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Available
            {availableLoaded && visibleAvailable.length > 0 ? ` (${visibleAvailable.length})` : ''}
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {/* Filters panel */}
        {showFilters && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Certification</label>
                <Select value={filterCertId} onValueChange={setFilterCertId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All certs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All certs</SelectItem>
                    {certifications.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Min available days
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={filterMinDays}
                  onChange={(e) => setFilterMinDays(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available tab: allRoles toggle + invitation usage */}
        {tab === 'available' && availableLoaded && (
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

        {/* Card stack */}
        <div className="relative flex flex-1 items-start justify-center pt-4">
          {/* Loading states */}
          {((tab !== 'available' && loading) || (tab === 'available' && availableLoading)) && (
            <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">
                {tab === 'available' ? 'Finding available crew...' : 'Loading applicants...'}
              </p>
            </div>
          )}

          {tab !== 'available' && !loading && error && (
            <div className="flex flex-col items-center gap-2 pt-20 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadApplicants}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty states */}
          {tab !== 'available' && !loading && !error && currentStack.length === 0 && (
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

          {tab === 'available' &&
            !availableLoading &&
            availableLoaded &&
            visibleAvailable.length === 0 && (
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

          {/* Applicant/Shortlist card stack */}
          {tab !== 'available' && !loading && currentStack.length > 0 && (
            <div className="relative h-[440px] w-full">
              {nextCard && (
                <div className="absolute inset-0 z-0">
                  <ApplicantCard applicant={nextCard as Applicant} isPreview />
                </div>
              )}

              {topCard && (
                <SwipeableApplicant
                  key={(topCard as Applicant).crew_person_id}
                  applicant={topCard as Applicant}
                  tab={tab}
                  onAccept={() => requestAccept((topCard as Applicant).crew_person_id)}
                  onReject={() => handleReject((topCard as Applicant).crew_person_id)}
                  onShortlist={() => handleShortlist((topCard as Applicant).crew_person_id)}
                  disabled={acting}
                  onViewProfile={setViewProfileId}
                />
              )}
            </div>
          )}

          {/* Available crew card stack */}
          {tab === 'available' && !availableLoading && visibleAvailable.length > 0 && (
            <div className="relative h-[440px] w-full">
              {nextCard && (
                <div className="absolute inset-0 z-0">
                  <AvailableCrewCard crew={nextCard as AvailableCrew} isPreview />
                </div>
              )}

              {topCard && (
                <SwipeableAvailableCrew
                  key={(topCard as AvailableCrew).person_id}
                  crew={topCard as AvailableCrew}
                  onInvite={() => requestInvite(topCard as AvailableCrew)}
                  onPass={() => handlePass((topCard as AvailableCrew).person_id)}
                  disabled={acting || inviteLimitReached}
                />
              )}
            </div>
          )}
        </div>

        {/* Action buttons — applicant/shortlist tabs */}
        {tab !== 'available' && !loading && topCard && (
          <div className="flex items-center justify-center gap-6 pb-4">
            <button
              onClick={() => handleReject((topCard as Applicant).crew_person_id)}
              disabled={acting}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
            {tab === 'applicants' && (
              <button
                onClick={() => handleShortlist((topCard as Applicant).crew_person_id)}
                disabled={acting}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-500 text-amber-500 transition-colors hover:bg-amber-500 hover:text-white disabled:opacity-50"
              >
                <Star className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => requestAccept((topCard as Applicant).crew_person_id)}
              disabled={acting}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
            >
              <Check className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Action buttons — available tab */}
        {tab === 'available' && !availableLoading && topCard && visibleAvailable.length > 0 && (
          <div className="flex items-center justify-center gap-6 pb-4">
            <button
              onClick={() => handlePass((topCard as AvailableCrew).person_id)}
              disabled={acting}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => requestInvite(topCard as AvailableCrew)}
              disabled={acting || inviteLimitReached}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-success text-success transition-colors hover:bg-success hover:text-white disabled:opacity-50"
              title={inviteLimitReached ? 'Invitation limit reached' : 'Invite'}
            >
              <Send className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Counter */}
        {tab !== 'available' && !loading && currentStack.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {currentStack.length} {tab === 'applicants' ? 'applicant' : 'shortlisted'}
            {currentStack.length !== 1 ? 's' : ''} to review
          </p>
        )}
        {tab === 'available' && !availableLoading && visibleAvailable.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {visibleAvailable.length} crew member{visibleAvailable.length !== 1 ? 's' : ''}{' '}
            available
          </p>
        )}
      </div>

      <Dialog open={!!pendingAccept} onOpenChange={() => setPendingAccept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm acceptance</DialogTitle>
            <DialogDescription>
              {positionsAvailable === 1
                ? `Accept ${pendingAccept?.crewName} for this job? This will open a message thread and reject all other applicants.`
                : positionsFilled + 1 >= positionsAvailable
                  ? `Accept ${pendingAccept?.crewName}? This will fill the last position and reject remaining applicants.`
                  : `Accept ${pendingAccept?.crewName}? (${positionsFilled + 1}/${positionsAvailable} positions will be filled)`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingAccept(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingAccept) {
                  handleAccept(pendingAccept.crewId);
                  setPendingAccept(null);
                }
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingInvite} onOpenChange={() => setPendingInvite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite {pendingInvite?.display_name}?</DialogTitle>
            <DialogDescription>
              Invite {pendingInvite?.display_name} for {dayworkMeta.role_name ?? 'this role'}
              {dayworkMeta.job_number
                ? ` — DW-${String(dayworkMeta.job_number).padStart(5, '0')}`
                : ''}
              . This will use 1 of your {invitationLimit} invitations for this posting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingInvite(null)}>
              Cancel
            </Button>
            <Button
              disabled={acting}
              onClick={() => {
                if (pendingInvite) {
                  handleInvite(pendingInvite.person_id);
                  setPendingInvite(null);
                }
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!acceptedDialog}
        onOpenChange={() => {
          setAcceptedDialog(null);
          if (positionsFilled >= positionsAvailable) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(MY_JOBS_TAB_STORAGE_KEY, 'in-progress');
            }
            router.push('/daywork/mine');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crew member accepted</DialogTitle>
            <DialogDescription>
              A messaging thread has been opened with {acceptedDialog?.crewName}.
              {positionsFilled < positionsAvailable
                ? ` ${positionsAvailable - positionsFilled} position${positionsAvailable - positionsFilled !== 1 ? 's' : ''} remaining.`
                : ' All positions are now filled.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            {positionsFilled < positionsAvailable && (
              <Button variant="outline" onClick={() => setAcceptedDialog(null)}>
                Continue reviewing
              </Button>
            )}
            <Button
              onClick={() => {
                if (acceptedDialog) {
                  router.push(`/messages/${acceptedDialog.engagementId}`);
                }
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Go to messages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile overlay */}
      {viewProfileId && (
        <ProfileOverlay
          personId={viewProfileId}
          isOpen={true}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </main>
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
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const acceptOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const shortlistOpacity = useTransform(y, [-SWIPE_THRESHOLD, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled) return;

    // Upward swipe = shortlist (only on applicants tab)
    if (
      tab === 'applicants' &&
      info.offset.y < -SWIPE_THRESHOLD &&
      Math.abs(info.offset.x) < SWIPE_THRESHOLD
    ) {
      hapticLight();
      animate(y, -400, { duration: 0.3 });
      setTimeout(onShortlist, 300);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onAccept, 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      hapticLight();
      animate(x, -400, { duration: 0.3 });
      setTimeout(onReject, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
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
      {tab === 'applicants' && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border-2 border-amber-500 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-500"
          style={{ opacity: shortlistOpacity }}
        >
          SHORTLIST
        </motion.div>
      )}

      <ApplicantCard applicant={applicant} onViewProfile={onViewProfile} />
    </motion.div>
  );
}

function SwipeableAvailableCrew({
  crew,
  onInvite,
  onPass,
  disabled,
}: {
  crew: AvailableCrew;
  onInvite: () => void;
  onPass: () => void;
  disabled: boolean;
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

      <AvailableCrewCard crew={crew} />
    </motion.div>
  );
}

function AvailableCrewCard({ crew, isPreview }: { crew: AvailableCrew; isPreview?: boolean }) {
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
          <div>
            <h3 className="text-lg font-bold">{crew.display_name ?? 'Unknown'}</h3>
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
        </div>

        {/* Bio */}
        {crew.bio && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{crew.bio}</p>}

        <div className="flex-1" />
      </div>
    </div>
  );
}

function ApplicantCard({
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
      className={`h-full w-full rounded-2xl border border-border bg-background shadow-lg ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Name + role */}
        <div className="mb-3 flex items-center gap-3">
          <Avatar src={profile?.avatar_url ?? null} name={profile?.display_name ?? '?'} size="md" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{profile?.display_name ?? 'Unknown'}</h3>
              {applicant.status === 'shortlisted' && (
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              )}
              {!isPreview && (
                <button
                  className="ml-auto text-muted-foreground hover:text-primary"
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
