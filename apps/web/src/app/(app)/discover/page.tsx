'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin,
  Calendar,
  Compass,
  DollarSign,
  Briefcase,
  Award,
  Check,
  X,
  SlidersHorizontal,
  Loader2,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  Mail,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { ProfileOverlay } from '@/components/profile-overlay';
import { LocationPicker } from '@/components/location-picker';
import { createClient } from '@/lib/supabase/client';
import { currencySymbol, convertSizeBandLabel } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';
import { NotificationBell } from '@/components/notification-bell';

interface DayworkCard {
  id: string;
  job_number: number;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  status: string;
  created_at: string;
  yacht_roles: { id: string; name: string; department: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
  vessels: {
    name: string;
    nda_flag: boolean;
    vessel_type: string;
    vessel_size_bands: { label: string } | null;
  } | null;
  experience_brackets: { label: string } | null;
  required_certification_ids: string[] | null;
  poster_person_id: string;
  poster_name: string | null;
  positions_available: number;
  positions_filled: number;
  positions_remaining: number;
  permanent_opportunity: boolean;
}

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

interface MyApplication {
  id: string;
  daywork_id: string;
  status: string;
  message: string | null;
  applied_at: string;
  daywork: {
    job_number: number;
    start_date: string;
    end_date: string;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    daywork_status: string;
    poster_person_id: string | null;
    poster_name: string | null;
    role_name: string | null;
    port_name: string | null;
    city_name: string | null;
    region_name: string | null;
    experience_label: string | null;
    vessel_name: string | null;
    vessel_type: string | null;
    vessel_size_label: string | null;
    positions_available: number | null;
    positions_filled: number | null;
    permanent_opportunity: boolean;
  } | null;
}

interface Invitation {
  id: string;
  daywork_id: string;
  employer_person_id: string;
  employer_name: string | null;
  created_at: string;
  daywork: {
    job_number: number;
    start_date: string;
    end_date: string;
    working_days: number;
    day_rate: number;
    currency: string;
    meals: string[];
    notes: string | null;
    daywork_status: string;
    role_name: string | null;
    port_name: string | null;
    city_name: string | null;
    region_name: string | null;
    experience_label: string | null;
    vessel_name: string | null;
    vessel_type: string | null;
    vessel_size_label: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  applied: { label: 'Applied', className: 'bg-primary/10 text-primary' },
  viewed: {
    label: 'Under review',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  shortlisted: { label: 'Shortlisted', className: 'bg-success/10 text-success' },
};

const SWIPE_THRESHOLD = 100;

export default function DiscoverPage() {
  const { showError } = useToast();
  const prefs = usePreferences();
  const [activeTab, setActiveTab] = useState<'browse' | 'invitations' | 'applied'>('browse');
  const [cards, setCards] = useState<DayworkCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [composingMessage, setComposingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const swipeRef = useRef<{ triggerApplySwipe: () => void } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCertId, setFilterCertId] = useState('');
  const [filterExperienceBracketId, setFilterExperienceBracketId] = useState('');
  const [filterSizeBandId, setFilterSizeBandId] = useState('');

  // Applied tab state
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  // Invitations tab state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [confirmAcceptInv, setConfirmAcceptInv] = useState<Invitation | null>(null);
  const [confirmDeclineInv, setConfirmDeclineInv] = useState<Invitation | null>(null);

  // Profile overlay state
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  // Availability gate state
  const [hasAvailability, setHasAvailability] = useState<boolean | null>(null);
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [showAvailOverlay, setShowAvailOverlay] = useState(false);

  // Lookups for filters
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certifications, setCertifications] = useState<LookupItem[]>([]);
  const [experienceBrackets, setExperienceBrackets] = useState<ExperienceBracketItem[]>([]);
  const [sizeBands, setSizeBands] = useState<SizeBandItem[]>([]);

  // Check crew availability on mount — only 'available' status allows applying
  const checkAvailability = useCallback(async () => {
    const res = await fetch('/api/availability');
    if (res.ok) {
      const data = await res.json();
      setHasAvailability(data.status === 'available');
    }
  }, []);

  // Load filter options
  useEffect(() => {
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, bandsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase
          .from('certifications')
          .select('id, name, category')
          .order('category')
          .order('name'),
        supabase.from('experience_brackets').select('id, label').order('min_months'),
        supabase.from('vessel_size_bands').select('id, label').order('min_meters'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCertifications(certsRes.data);
      if (bracketsRes.data) setExperienceBrackets(bracketsRes.data);
      if (bandsRes.data) setSizeBands(bandsRes.data);
    }
    loadLookups();
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterRoleId && filterRoleId !== 'all') params.set('roleId', filterRoleId);
    if (filterPortId && filterPortId !== 'all') params.set('portId', filterPortId);
    if (filterStartDate) params.set('startDate', filterStartDate);
    if (filterEndDate) params.set('endDate', filterEndDate);
    if (filterCertId && filterCertId !== 'all') params.set('certificationId', filterCertId);
    if (filterExperienceBracketId && filterExperienceBracketId !== 'all')
      params.set('experienceBracketId', filterExperienceBracketId);
    if (filterSizeBandId && filterSizeBandId !== 'all') params.set('sizeBandId', filterSizeBandId);
    return params;
  }, [
    filterRoleId,
    filterPortId,
    filterStartDate,
    filterEndDate,
    filterCertId,
    filterExperienceBracketId,
    filterSizeBandId,
  ]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const params = buildFilterParams();
    const qs = params.toString();
    const res = await fetch(`/api/daywork/discover${qs ? `?${qs}` : ''}`);
    const data = await res.json();
    if (data.dayworks) setCards(data.dayworks);
    setNextCursor(data.next_cursor ?? null);
    setHasMore(data.has_more ?? false);
    setLoading(false);
  }, [buildFilterParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMore) return;
    setLoadingMore(true);

    let currentCursor = nextCursor;
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries < MAX_RETRIES) {
      const params = buildFilterParams();
      params.set('cursor', currentCursor);
      const qs = params.toString();
      const res = await fetch(`/api/daywork/discover?${qs}`);
      const data = await res.json();
      const newCards = data.dayworks ?? [];

      if (newCards.length > 0) {
        setCards((prev) => [...prev, ...newCards]);
        setNextCursor(data.next_cursor ?? null);
        setHasMore(data.has_more ?? false);
        break;
      }

      // Empty batch (e.g. post-fetch sizeBand filter removed all results)
      if (!data.has_more || !data.next_cursor) {
        setNextCursor(null);
        setHasMore(false);
        break;
      }

      // Retry with new cursor
      currentCursor = data.next_cursor;
      retries++;
    }

    setLoadingMore(false);
  }, [nextCursor, hasMore, loadingMore, buildFilterParams]);

  // Auto-load more when card stack runs low
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (cards.length <= 5 && hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [cards.length, hasMore, loadingMore, loading, loadMore]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadCards();
  }, [loadCards]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Gate apply actions behind availability check */
  function requireAvailability(): boolean {
    if (hasAvailability) return true;
    setShowAvailDialog(true);
    return false;
  }

  async function handleApply(dayworkId: string, message?: string) {
    setApplying(true);
    const opts: RequestInit = { method: 'POST' };
    if (message) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify({ message });
    }
    const res = await fetch(`/api/daywork/${dayworkId}/apply`, opts);
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== dayworkId));
      // Refresh application count for the badge
      loadApplications();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? 'Failed to apply');
    }
    setComposingMessage(false);
    setMessageText('');
    setApplying(false);
  }

  function handlePass(dayworkId: string) {
    setCards((prev) => prev.filter((c) => c.id !== dayworkId));
  }

  function handleMessageSubmit() {
    if (!topCard || applying) return;
    if (!requireAvailability()) return;
    // Trigger the swipe-right animation, then apply with message
    if (swipeRef.current) {
      swipeRef.current.triggerApplySwipe();
    }
    const msg = messageText.trim();
    setTimeout(() => handleApply(topCard.id, msg || undefined), 300);
  }

  function handleCancelMessage() {
    setComposingMessage(false);
    setMessageText('');
  }

  const loadApplications = useCallback(async () => {
    setLoadingApps(true);
    const res = await fetch('/api/daywork/applications');
    if (res.ok) {
      const data = await res.json();
      setApplications(data.applications ?? []);
    }
    setLoadingApps(false);
  }, []);

  // Load applications on mount (for badge count) and when switching to the Applied tab
  useEffect(() => {
    loadApplications();
  }, [activeTab, loadApplications]);

  async function handleWithdraw(dayworkId: string) {
    setWithdrawingId(dayworkId);
    const res = await fetch(`/api/daywork/${dayworkId}/withdraw`, { method: 'POST' });
    if (res.ok) {
      setApplications((prev) => prev.filter((a) => a.daywork_id !== dayworkId));
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? 'Failed to withdraw');
    }
    setWithdrawingId(null);
  }

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    const res = await fetch('/api/daywork/invitations');
    if (res.ok) {
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    }
    setLoadingInvitations(false);
  }, []);

  // Load invitations on mount (for badge count) and when switching tabs
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadInvitations();
  }, [activeTab, loadInvitations]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleAcceptInvitation(inv: Invitation) {
    setRespondingId(inv.id);
    setInvitationError(null);
    const res = await fetch(`/api/daywork/invitations/${inv.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    if (res.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      loadApplications();
    } else {
      const data = await res.json().catch(() => ({}));
      setInvitationError(data.error ?? 'Failed to accept invitation');
    }
    setRespondingId(null);
    setConfirmAcceptInv(null);
  }

  async function handleDeclineInvitation(inv: Invitation) {
    setRespondingId(inv.id);
    setInvitationError(null);
    const res = await fetch(`/api/daywork/invitations/${inv.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    });
    if (res.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    } else {
      const data = await res.json().catch(() => ({}));
      setInvitationError(data.error ?? 'Failed to decline invitation');
    }
    setRespondingId(null);
    setConfirmDeclineInv(null);
  }

  const topCard = cards[0] ?? null;
  const nextCard = cards[1] ?? null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Discover</h1>
            <NotificationBell />
          </div>
          {activeTab === 'browse' && (
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Filters
            </Button>
          )}
        </div>
        {/* Tabs */}
        <div className="mx-auto flex max-w-lg border-t border-border">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'browse'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="h-4 w-4" />
            Browse
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-4 w-4" />
            Invitations
            {invitations.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {invitations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('applied')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              activeTab === 'applied'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Applied
            {applications.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {applications.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ───── Invitations tab ───── */}
      {activeTab === 'invitations' && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-4">
          {loadingInvitations && (
            <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading invitations...</p>
            </div>
          )}

          {invitationError && (
            <p className="text-center text-sm text-destructive">{invitationError}</p>
          )}

          {!loadingInvitations && invitations.length === 0 && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">No pending invitations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  When employers invite you to a job, it will appear here.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab('browse')}
                >
                  Browse jobs
                </Button>
              </CardContent>
            </Card>
          )}

          {!loadingInvitations &&
            invitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                responding={respondingId === inv.id}
                onAccept={() => setConfirmAcceptInv(inv)}
                onDecline={() => setConfirmDeclineInv(inv)}
                onViewProfile={setViewProfileId}
              />
            ))}
        </div>
      )}

      {/* ───── Applied tab ───── */}
      {activeTab === 'applied' && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-4">
          {loadingApps && (
            <div className="flex flex-col items-center gap-2 pt-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading applications...</p>
            </div>
          )}

          {!loadingApps && applications.length === 0 && (
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">No pending applications</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Jobs you apply to will appear here until the employer responds.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab('browse')}
                >
                  Browse jobs
                </Button>
              </CardContent>
            </Card>
          )}

          {!loadingApps &&
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                withdrawing={withdrawingId === app.daywork_id}
                onWithdraw={() => handleWithdraw(app.daywork_id)}
                onViewProfile={setViewProfileId}
              />
            ))}
        </div>
      )}

      {/* ───── Browse tab ───── */}
      {activeTab === 'browse' && (
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
                          {convertSizeBandLabel(sb.label, prefs.lengthUnit)}
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
                  <Button variant="outline" size="sm" className="mt-3" onClick={loadCards}>
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            )}

            {!loading && cards.length > 0 && (
              <div className="relative h-[420px] w-full">
                {/* Next card preview (underneath) */}
                {nextCard && (
                  <div className="absolute inset-0 z-0">
                    <JobCard
                      card={nextCard}
                      isPreview
                      lengthUnit={prefs.lengthUnit}
                      onViewProfile={setViewProfileId}
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
                      if (requireAvailability()) handleApply(topCard.id);
                    }}
                    onPass={() => handlePass(topCard.id)}
                    onComposeMessage={() => {
                      if (!requireAvailability()) return;
                      setComposingMessage(true);
                      setMessageText('');
                    }}
                    canApply={!!hasAvailability}
                    onAvailabilityGate={() => setShowAvailDialog(true)}
                    composing={composingMessage}
                    disabled={applying}
                    lengthUnit={prefs.lengthUnit}
                    onViewProfile={setViewProfileId}
                  />
                )}
              </div>
            )}
          </div>

          {/* Action buttons or message compose */}
          {!loading && topCard && !composingMessage && (
            <div className="flex items-center justify-center gap-6 pb-4">
              <button
                onClick={() => handlePass(topCard.id)}
                disabled={applying}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>
              <button
                onClick={() => {
                  if (requireAvailability()) handleApply(topCard.id);
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
                  onChange={(e) => setMessageText(e.target.value.slice(0, 250))}
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
                  onClick={handleCancelMessage}
                  disabled={applying}
                >
                  Cancel message
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleMessageSubmit}
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

      {/* Availability gate dialog */}
      <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Before applying to daywork, you need to set your availability dates and location so
              employers know when and where you&apos;re free.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAvailDialog(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setShowAvailDialog(false);
                setShowAvailOverlay(true);
              }}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Set availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability overlay (opened from gate dialog) */}
      {showAvailOverlay && (
        <AvailabilityOverlay
          onConfirm={() => {
            setShowAvailOverlay(false);
            checkAvailability();
          }}
          onCancel={() => setShowAvailOverlay(false)}
        />
      )}

      {/* Accept invitation confirmation */}
      <Dialog open={!!confirmAcceptInv} onOpenChange={() => setConfirmAcceptInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this invitation?</DialogTitle>
            <DialogDescription>
              You&apos;ll be added as an applicant for this job.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAcceptInv(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!respondingId}
              onClick={() => {
                if (confirmAcceptInv) handleAcceptInvitation(confirmAcceptInv);
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline invitation confirmation */}
      <Dialog open={!!confirmDeclineInv} onOpenChange={() => setConfirmDeclineInv(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this invitation?</DialogTitle>
            <DialogDescription>The employer won&apos;t be notified.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeclineInv(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!respondingId}
              onClick={() => {
                if (confirmDeclineInv) handleDeclineInvitation(confirmDeclineInv);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Decline
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

interface SwipeableCardHandle {
  triggerApplySwipe: () => void;
}

const SwipeableCard = forwardRef<
  SwipeableCardHandle,
  {
    card: DayworkCard;
    onApply: () => void;
    onPass: () => void;
    onComposeMessage: () => void;
    canApply: boolean;
    onAvailabilityGate: () => void;
    composing: boolean;
    disabled: boolean;
    lengthUnit?: 'm' | 'ft';
    onViewProfile?: (personId: string) => void;
  }
>(function SwipeableCard(
  {
    card,
    onApply,
    onPass,
    onComposeMessage,
    canApply,
    onAvailabilityGate,
    composing,
    disabled,
    lengthUnit = 'm',
    onViewProfile,
  },
  ref,
) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const applyOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  useImperativeHandle(ref, () => ({
    triggerApplySwipe() {
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
    },
  }));

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled || composing) return;

    if (info.offset.x > SWIPE_THRESHOLD) {
      // Right swipe = apply — check availability first
      if (!canApply) {
        // Snap back and show availability gate
        animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        onAvailabilityGate();
        return;
      }
      hapticMedium();
      animate(x, 400, { duration: 0.3 });
      setTimeout(onApply, 300);
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
      drag={composing ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
    >
      {/* Swipe indicators */}
      <motion.div
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border-2 border-success bg-success/10 px-3 py-1 text-sm font-bold text-success"
        style={{ opacity: applyOpacity }}
      >
        APPLY
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 border-destructive bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive"
        style={{ opacity: passOpacity }}
      >
        PASS
      </motion.div>

      <JobCard
        card={card}
        onComposeMessage={composing ? undefined : onComposeMessage}
        onViewProfile={onViewProfile}
        lengthUnit={lengthUnit}
      />
    </motion.div>
  );
});

function JobCard({
  card,
  isPreview,
  onComposeMessage,
  onViewProfile,
  lengthUnit = 'm',
}: {
  card: DayworkCard;
  isPreview?: boolean;
  onComposeMessage?: () => void;
  onViewProfile?: (personId: string) => void;
  lengthUnit?: 'm' | 'ft';
}) {
  return (
    <div
      className={`h-full w-full rounded-2xl border border-border bg-background shadow-lg ${
        isPreview ? 'scale-[0.97] opacity-60' : ''
      }`}
    >
      <div className="flex h-full flex-col p-5">
        {/* Role + vessel */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-lg font-bold">{card.yacht_roles?.name ?? 'Unknown role'}</h3>
            {!isPreview && (
              <button
                className="text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile?.(card.poster_person_id);
                }}
              >
                <User className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {card.vessels?.nda_flag
              ? 'NDA Vessel'
              : `${card.vessels?.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} ${card.vessels?.name ?? 'Unknown vessel'}`}
            {card.vessels?.vessel_size_bands?.label &&
              ` · ${convertSizeBandLabel(card.vessels.vessel_size_bands.label, lengthUnit)}`}
          </p>
        </div>

        {/* Poster name + positions */}
        <div className="mb-2 flex items-center gap-2">
          {card.poster_name && (
            <p className="text-xs text-muted-foreground">Posted by {card.poster_name}</p>
          )}
          {card.positions_available > 1 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                card.positions_remaining === 1
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {card.positions_remaining === 1
                ? 'Last position!'
                : `${card.positions_remaining}/${card.positions_available} open`}
            </span>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.ports?.name ?? 'Unknown'}
              {card.ports?.cities?.name && `, ${card.ports.cities.name}`}
              {card.ports?.cities?.regions?.name && ` · ${card.ports.cities.regions.name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {card.start_date} — {card.end_date} ({card.working_days} working day
              {card.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {currencySymbol(card.currency)}
              {card.day_rate}/day
            </span>
          </div>

          {card.experience_brackets?.label && (
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{card.experience_brackets.label}</span>
            </div>
          )}
        </div>

        {/* Meals + badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.meals &&
            card.meals.length > 0 &&
            card.meals.map((meal) => (
              <Badge key={meal} variant="secondary" className="text-xs capitalize">
                {meal}
              </Badge>
            ))}
          {card.permanent_opportunity && (
            <Badge variant="outline" className="text-xs">
              Could go permanent
            </Badge>
          )}
        </div>

        {/* Notes */}
        {card.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{card.notes}</p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Apply with message button + Job ref */}
        <div className="mt-2 flex items-center justify-between">
          {onComposeMessage ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComposeMessage();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Apply with a message
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/60">
              DW-{String(card.job_number).padStart(5, '0')}
            </span>
          )}
          <span className="text-xs text-muted-foreground/60">
            {onComposeMessage
              ? `DW-${String(card.job_number).padStart(5, '0')}`
              : `Posted ${new Date(card.created_at).toLocaleDateString()}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  withdrawing,
  onWithdraw,
  onViewProfile,
}: {
  application: MyApplication;
  withdrawing: boolean;
  onWithdraw: () => void;
  onViewProfile?: (personId: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const dw = application.daywork;
  if (!dw) return null;

  const statusInfo = STATUS_LABELS[application.status] ?? STATUS_LABELS.applied;
  const symbol = currencySymbol(dw.currency);
  const canWithdraw = ['applied', 'viewed', 'shortlisted'].includes(application.status);
  const isShortlisted = application.status === 'shortlisted';

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        {/* Header: role + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight">{dw.role_name ?? 'Unknown role'}</h3>
            <p className="text-sm text-muted-foreground">
              {dw.vessel_type ? (dw.vessel_type === 'sail' ? 'S/Y' : 'M/Y') + ' ' : ''}
              {dw.vessel_name ?? 'Unknown vessel'}
              {dw.vessel_size_label && ` · ${dw.vessel_size_label}`}
            </p>
          </div>
          {dw.poster_person_id && (
            <button
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => onViewProfile?.(dw.poster_person_id!)}
            >
              <User className="h-4 w-4" />
            </button>
          )}
          <Badge className={`shrink-0 text-[10px] ${statusInfo.className}`}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.port_name ?? 'Unknown'}
              {dw.city_name && `, ${dw.city_name}`}
              {dw.region_name && ` · ${dw.region_name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.start_date} — {dw.end_date} ({dw.working_days} day
              {dw.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {symbol}
              {dw.day_rate}/day
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {dw.positions_available && dw.positions_available > 1 && dw.positions_filled !== null && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {dw.positions_available - dw.positions_filled}/{dw.positions_available} open
            </span>
          )}
          {dw.permanent_opportunity && (
            <Badge variant="outline" className="text-xs">
              Could go permanent
            </Badge>
          )}
        </div>

        {/* Application message preview */}
        {application.message && (
          <p className="rounded-md bg-accent px-2.5 py-1.5 text-xs text-muted-foreground italic">
            &ldquo;{application.message}&rdquo;
          </p>
        )}

        {/* Footer: job ref + withdraw */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground/60">
            DW-{String(dw.job_number).padStart(5, '0')} · Applied{' '}
            {new Date(application.applied_at).toLocaleDateString()}
          </span>
          {canWithdraw && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={withdrawing}
              onClick={() => setShowConfirm(true)}
            >
              {withdrawing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              Withdraw
            </Button>
          )}
        </div>
      </CardContent>

      {/* Withdraw confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw application?</DialogTitle>
            <DialogDescription>
              {isShortlisted && (
                <span className="mb-1 block font-medium text-foreground">
                  You&apos;ve been shortlisted for this position.
                </span>
              )}
              This will remove your application for{' '}
              <span className="font-medium text-foreground">{dw.role_name ?? 'this job'}</span>
              {dw.vessel_name && (
                <>
                  {' '}
                  on <span className="font-medium text-foreground">{dw.vessel_name}</span>
                </>
              )}
              . This job will not reappear in your browse feed — this action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Keep application
            </Button>
            <Button
              variant="destructive"
              disabled={withdrawing}
              onClick={() => {
                setShowConfirm(false);
                onWithdraw();
              }}
            >
              {withdrawing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InvitationCard({
  invitation,
  responding,
  onAccept,
  onDecline,
  onViewProfile,
}: {
  invitation: Invitation;
  responding: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile?: (personId: string) => void;
}) {
  const dw = invitation.daywork;
  if (!dw) return null;

  const symbol = currencySymbol(dw.currency);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-4">
        {/* Invited by header */}
        <p className="text-xs font-medium text-primary">
          Invited by {invitation.employer_name ?? 'an employer'}
        </p>

        {/* Role + vessel */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight">{dw.role_name ?? 'Unknown role'}</h3>
            <p className="text-sm text-muted-foreground">
              {dw.vessel_type ? (dw.vessel_type === 'sail' ? 'S/Y' : 'M/Y') + ' ' : ''}
              {dw.vessel_name ?? 'Unknown vessel'}
              {dw.vessel_size_label && ` · ${dw.vessel_size_label}`}
            </p>
          </div>
          {invitation.employer_person_id && (
            <button
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => onViewProfile?.(invitation.employer_person_id)}
            >
              <User className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.port_name ?? 'Unknown'}
              {dw.city_name && `, ${dw.city_name}`}
              {dw.region_name && ` · ${dw.region_name}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              {dw.start_date} — {dw.end_date} ({dw.working_days} day
              {dw.working_days !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {symbol}
              {dw.day_rate}/day
            </span>
          </div>
        </div>

        {/* Footer: job ref */}
        <p className="text-xs text-muted-foreground/60">
          DW-{String(dw.job_number).padStart(5, '0')}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={responding}
            onClick={onDecline}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Decline
          </Button>
          <Button size="sm" className="flex-1" disabled={responding} onClick={onAccept}>
            {responding ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
