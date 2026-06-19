'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import Link from 'next/link';
import { ChevronLeft, SlidersHorizontal, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useLookups } from '@/hooks/use-lookups';
import { ProfileOverlay } from '@/components/profile-overlay';
import { MY_JOBS_TAB_STORAGE_KEY } from '@/lib/my-jobs-tab';
import type { Applicant, AvailableCrew, TabView } from './_components/types';
import { ReviewFilterPanel } from './_components/review-filter-panel';
import { ApplicantsTab } from './_components/applicants-tab';
import { AvailableCrewTab } from './_components/available-crew-tab';
import { AcceptConfirmDialog } from './_components/accept-confirm-dialog';
import { RejectConfirmDialog } from './_components/reject-confirm-dialog';
import { InviteConfirmDialog } from './_components/invite-confirm-dialog';

export default function ReviewApplicantsPage() {
  const { id: dayworkId } = useParams<{ id: string }>();
  const router = useRouter();
  const { showError, showSuccess } = useToast();
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
  const [pendingReject, setPendingReject] = useState<{
    crewId: string;
    crewName: string;
  } | null>(null);

  // Profile overlay
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterCertId, setFilterCertId] = useState('');
  const [filterMinDays, setFilterMinDays] = useState('');
  const certifications = useLookups().certifications;

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
    port_name: string | null;
    day_rate: string | null;
    currency: string | null;
  }>({ job_number: null, role_name: null, port_name: null, day_rate: null, currency: null });

  // Client-side hat guard: redirect crew away from employer review page
  // (middleware handles full page loads; this catches client-side navigation)
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

  // Load daywork meta for invite dialog (certs from context)
  useEffect(() => {
    const supabase = createClient();
    async function loadDayworkMeta() {
      const { data } = await supabase
        .from('dayworks')
        .select(
          'job_number, day_rate, currency, yacht_roles:role_id(name), ports:location_port_id(name)',
        )
        .eq('id', dayworkId)
        .single();
      if (data) {
        const role = data.yacht_roles as unknown as { name: string } | null;
        const port = data.ports as unknown as { name: string } | null;
        setDayworkMeta({
          job_number: data.job_number,
          role_name: role?.name ?? null,
          port_name: port?.name ?? null,
          day_rate: data.day_rate ? String(data.day_rate) : null,
          currency: data.currency ?? null,
        });
      }
    }
    loadDayworkMeta();
  }, [dayworkId]);

  const applicants = allApplicants.filter((a) => a.status === 'applied' || a.status === 'viewed');
  const shortlisted = allApplicants.filter((a) => a.status === 'shortlisted');

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
    if (filterMinDays) params.set('minAvailableDays', filterMinDays);
    const qs = params.toString();
    const result = await safeFetch<{
      applicants?: Applicant[];
      positions_available?: number;
      positions_filled?: number;
      permanent_opportunity?: boolean;
    }>(`/api/daywork/${dayworkId}/applicants${qs ? `?${qs}` : ''}`);
    if (result.ok) {
      if (result.data.applicants) setAllApplicants(result.data.applicants);
      if (result.data.positions_available !== undefined)
        setPositionsAvailable(result.data.positions_available);
      if (result.data.positions_filled !== undefined)
        setPositionsFilled(result.data.positions_filled);
      if (result.data.permanent_opportunity !== undefined)
        setPermanentOpportunity(result.data.permanent_opportunity);
      setError(null);
    } else {
      setError('Failed to load applicants. Please try again.');
    }
    setLoading(false);
  }, [dayworkId, filterCertId, filterMinDays]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const loadAvailableCrew = useCallback(async () => {
    setAvailableLoading(true);
    const params = new URLSearchParams();
    if (allRoles) params.set('allRoles', 'true');
    const qs = params.toString();
    const result = await safeFetch<{
      crew?: AvailableCrew[];
      invitation_count?: number;
      invitation_limit?: number;
    }>(`/api/daywork/${dayworkId}/available-crew${qs ? `?${qs}` : ''}`);
    if (result.ok) {
      setAvailableCrew(result.data.crew ?? []);
      setInvitationCount(result.data.invitation_count ?? 0);
      if (result.data.invitation_limit !== undefined)
        setInvitationLimit(result.data.invitation_limit);
    } else {
      setAvailableCrew([]);
    }
    setAvailableLoading(false);
    setAvailableLoaded(true);
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
      void safeFetch(`/api/daywork/${dayworkId}/applicants/${top.crew_person_id}/view`, {
        method: 'POST',
      });
    }
  }, [applicantStack, dayworkId]);

  async function handleShortlist(crewId: string) {
    setActing(true);
    const result = await safeFetch(`/api/daywork/${dayworkId}/applicants/${crewId}/shortlist`, {
      method: 'POST',
    });
    if (result.ok) {
      showSuccess('Added to shortlist');
      setAllApplicants((prev) =>
        prev.map((a) => (a.crew_person_id === crewId ? { ...a, status: 'shortlisted' } : a)),
      );
    } else {
      showError(result.error);
    }
    setActing(false);
  }

  function requestAccept(crewId: string) {
    const applicant = allApplicants.find((a) => a.crew_person_id === crewId);
    const crewName = applicant?.profiles?.display_name ?? 'this crew member';
    setPendingAccept({ crewId, crewName });
  }

  function requestReject(crewId: string) {
    const applicant = allApplicants.find((a) => a.crew_person_id === crewId);
    const crewName = applicant?.profiles?.display_name ?? 'this crew member';
    setPendingReject({ crewId, crewName });
  }

  async function handleAccept(crewId: string) {
    setActing(true);
    const result = await safeFetch<{ engagementId?: string }>(
      `/api/daywork/${dayworkId}/applicants/${crewId}/accept`,
      {
        method: 'POST',
      },
    );
    if (result.ok) {
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

      showSuccess('Crew accepted');
      if (result.data.engagementId) {
        setAcceptedDialog({ crewName, engagementId: result.data.engagementId });
      }
    } else {
      showError(result.error);
    }
    setActing(false);
  }

  async function handleReject(crewId: string) {
    setActing(true);
    const result = await safeFetch(`/api/daywork/${dayworkId}/applicants/${crewId}/reject`, {
      method: 'POST',
    });
    if (result.ok) {
      showSuccess('Applicant rejected');
      setAllApplicants((prev) => prev.filter((a) => a.crew_person_id !== crewId));
    } else {
      showError(result.error);
    }
    setActing(false);
  }

  async function handleInvite(personId: string) {
    setActing(true);
    setInviteError(null);
    const result = await safeFetch(`/api/daywork/${dayworkId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crewPersonId: personId }),
    });
    if (result.ok) {
      showSuccess('Invitation sent');
      setAvailableCrew((prev) => prev.filter((c) => c.person_id !== personId));
      setInvitationCount((prev) => prev + 1);
    } else {
      setInviteError(result.error);
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
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-[24px] font-bold tracking-[-0.5px]">Review</h1>
            {positionsAvailable > 1 && (
              <span className="rounded-full bg-[var(--accent-lo)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
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
      <div className="page-width w-full ">
        <UnderlineTabs
          options={[
            { value: 'applicants', label: 'Applicants', count: applicants.length },
            {
              value: 'shortlist',
              label: 'Shortlist',
              count: shortlisted.length,
              icon: <Star className="h-3.5 w-3.5" />,
            },
            {
              value: 'available',
              label: 'Available',
              count: availableLoaded ? visibleAvailable.length : 0,
            },
          ]}
          value={tab}
          onChange={(v) => setTab(v as TabView)}
        />
      </div>

      <div className="page-width flex w-full flex-1 flex-col gap-4 px-4 py-6">
        {/* Filters panel */}
        {showFilters && (
          <ReviewFilterPanel
            filterCertId={filterCertId}
            setFilterCertId={setFilterCertId}
            filterMinDays={filterMinDays}
            setFilterMinDays={setFilterMinDays}
            certifications={certifications}
          />
        )}

        {tab !== 'available' && (
          <ApplicantsTab
            tab={tab}
            loading={loading}
            error={error}
            applicants={applicants}
            shortlisted={shortlisted}
            acting={acting}
            topCard={topCard as Applicant | null}
            nextCard={nextCard as Applicant | null}
            handleShortlist={handleShortlist}
            requestAccept={requestAccept}
            handleReject={requestReject}
            loadApplicants={loadApplicants}
            setTab={setTab}
            setViewProfileId={setViewProfileId}
            shareData={
              dayworkMeta.job_number
                ? {
                    jobNumber: `DW-${String(dayworkMeta.job_number).padStart(5, '0')}`,
                    roleName: dayworkMeta.role_name ?? 'Crew',
                    location: dayworkMeta.port_name ?? '',
                    rate:
                      dayworkMeta.day_rate && dayworkMeta.currency
                        ? `${dayworkMeta.day_rate} ${dayworkMeta.currency}/day`
                        : '',
                  }
                : undefined
            }
          />
        )}

        {tab === 'available' && (
          <AvailableCrewTab
            availableLoading={availableLoading}
            availableLoaded={availableLoaded}
            visibleAvailable={visibleAvailable}
            invitationCount={invitationCount}
            invitationLimit={invitationLimit}
            inviteLimitReached={inviteLimitReached}
            allRoles={allRoles}
            setAllRoles={setAllRoles}
            setAvailableLoaded={setAvailableLoaded}
            inviteError={inviteError}
            acting={acting}
            topCard={topCard as AvailableCrew | null}
            nextCard={nextCard as AvailableCrew | null}
            requestInvite={requestInvite}
            handlePass={handlePass}
            setViewProfileId={setViewProfileId}
          />
        )}
      </div>

      <AcceptConfirmDialog
        pendingAccept={pendingAccept}
        setPendingAccept={setPendingAccept}
        positionsAvailable={positionsAvailable}
        positionsFilled={positionsFilled}
        handleAccept={handleAccept}
      />

      <RejectConfirmDialog
        pendingReject={pendingReject}
        setPendingReject={setPendingReject}
        handleReject={handleReject}
      />

      <InviteConfirmDialog
        pendingInvite={pendingInvite}
        setPendingInvite={setPendingInvite}
        dayworkMeta={dayworkMeta}
        invitationLimit={invitationLimit}
        acting={acting}
        handleInvite={handleInvite}
      />

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
