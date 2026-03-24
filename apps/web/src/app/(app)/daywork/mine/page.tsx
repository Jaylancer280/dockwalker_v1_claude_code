'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  SlidersHorizontal,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { isMyJobsTab, MY_JOBS_TAB_STORAGE_KEY, type MyJobsTab } from '@/lib/my-jobs-tab';
import { currencySymbol, convertSizeBandLabel } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { useToast } from '@/hooks/use-toast';
import { PermanentMineSection } from './_components/permanent-mine-section';
import { DayworkActiveSection } from './_components/daywork-active-section';
import { DayworkInProgressSection } from './_components/daywork-in-progress-section';
import { DayworkCompletedSection } from './_components/daywork-completed-section';
import { DayworkTemplatesSection } from './_components/daywork-templates-section';
import { EditPositionsDialog } from './_components/edit-positions-dialog';
import type { DayworkPosting, Template } from './_components/daywork-types';

export default function MyPostingsPage() {
  const router = useRouter();
  const prefs = usePreferences();
  const { showSuccess, showError } = useToast();
  const [mineMode, setMineMode] = useState<'daywork' | 'permanent'>(() => {
    if (typeof window === 'undefined') return 'daywork';
    return (localStorage.getItem('dw-mine-mode') as 'daywork' | 'permanent') || 'daywork';
  });
  const [activePostings, setActivePostings] = useState<DayworkPosting[]>([]);
  const [inProgressPostings, setInProgressPostings] = useState<DayworkPosting[]>([]);
  const [completedPostings, setCompletedPostings] = useState<DayworkPosting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [engagementsByDaywork, setEngagementsByDaywork] = useState<
    Record<string, { id: string; crew_person_id: string; crew_name?: string }[]>
  >({});
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);
  const [editPositions, setEditPositions] = useState<{
    id: string;
    current: number;
    filled: number;
  } | null>(null);
  const [editPositionsValue, setEditPositionsValue] = useState('');
  const [savingPositions, setSavingPositions] = useState(false);
  const [currentTab, setCurrentTab] = useState<MyJobsTab>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterPortId, setFilterPortId] = useState('');
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [ports, setPorts] = useState<{ id: string; name: string; cities: { name: string } }[]>([]);
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    const storedTab = window.sessionStorage.getItem(MY_JOBS_TAB_STORAGE_KEY);
    if (isMyJobsTab(storedTab)) {
      setCurrentTab(storedTab);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(MY_JOBS_TAB_STORAGE_KEY, currentTab);
  }, [currentTab]);

  useEffect(() => {
    async function loadLookups() {
      const supabase = createClient();
      const [rolesRes, portsRes, profileRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase.from('ports').select('id, name, cities(name)').order('name'),
        safeFetch<{ person?: { identity_type?: string } }>('/api/profile'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (portsRes.data)
        setPorts(
          portsRes.data as unknown as { id: string; name: string; cities: { name: string } }[],
        );
      if (profileRes.ok && profileRes.data.person?.identity_type === 'agent') {
        setIsAgent(true);
      }
    }
    loadLookups();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const filterParams = new URLSearchParams();
      if (filterRoleId && filterRoleId !== 'all') filterParams.set('roleId', filterRoleId);
      if (filterPortId && filterPortId !== 'all') filterParams.set('portId', filterPortId);
      const filterSuffix = filterParams.toString() ? `&${filterParams.toString()}` : '';

      const [activeResult, inProgressResult, completedResult, templatesResult] = await Promise.all([
        safeFetch<{ dayworks?: DayworkPosting[] }>(
          `/api/daywork/mine?status=active${filterSuffix}`,
        ),
        safeFetch<{ dayworks?: DayworkPosting[] }>(
          `/api/daywork/mine?status=in_progress${filterSuffix}`,
        ),
        safeFetch<{ dayworks?: DayworkPosting[] }>(
          `/api/daywork/mine?status=completed,cancelled${filterSuffix}`,
        ),
        safeFetch<{ templates?: Template[] }>('/api/daywork/templates'),
      ]);

      if (activeResult.ok && activeResult.data.dayworks)
        setActivePostings(activeResult.data.dayworks);
      if (inProgressResult.ok && inProgressResult.data.dayworks) {
        setInProgressPostings(inProgressResult.data.dayworks);
        // Fetch engagement IDs for in-progress postings so we can link to chat
        const ipIds = (inProgressResult.data.dayworks as DayworkPosting[]).map(
          (d: DayworkPosting) => d.id,
        );
        if (ipIds.length > 0) {
          const supabase = createClient();
          const { data: engagements } = await supabase
            .from('active_engagements')
            .select(
              'id, daywork_id, crew_person_id, profiles!active_engagements_crew_person_id_profiles_fkey(display_name)',
            )
            .in('daywork_id', ipIds)
            .eq('status', 'active');
          if (engagements) {
            const map: Record<
              string,
              { id: string; crew_person_id: string; crew_name?: string }[]
            > = {};
            for (const eng of engagements) {
              const profile = eng.profiles as unknown as { display_name: string } | null;
              const entry = {
                id: eng.id,
                crew_person_id: eng.crew_person_id,
                crew_name: profile?.display_name,
              };
              if (!map[eng.daywork_id]) map[eng.daywork_id] = [];
              map[eng.daywork_id].push(entry);
            }
            setEngagementsByDaywork(map);
          }
        }
      }
      if (completedResult.ok && completedResult.data.dayworks)
        setCompletedPostings(completedResult.data.dayworks);
      if (templatesResult.ok && templatesResult.data.templates)
        setTemplates(templatesResult.data.templates);

      // Set error only if all fetches failed
      if (!activeResult.ok && !inProgressResult.ok && !completedResult.ok && !templatesResult.ok) {
        setError('Failed to load data. Please try again.');
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [filterRoleId, filterPortId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch stale data when the page becomes visible again (tab switch,
  // returning from another app, or browser back/forward cache)
  const lastFetch = useRef(0);
  useEffect(() => {
    lastFetch.current = Date.now();
  }, [activePostings, inProgressPostings, completedPostings]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > 2000) {
        loadData();
      }
    }
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) loadData();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [loadData]);

  async function handleCancel(dayworkId: string) {
    setCancelling(dayworkId);
    const result = await safeFetch<{ error?: string }>(`/api/daywork/${dayworkId}/cancel`, {
      method: 'POST',
    });
    if (result.ok) {
      showSuccess('Posting cancelled');
      loadData();
    } else {
      showError(result.error);
    }
    setCancelling(null);
  }

  async function handleSavePositions() {
    if (!editPositions) return;
    const val = parseInt(editPositionsValue, 10);
    if (isNaN(val) || val < 1 || val > 20 || val < editPositions.filled) return;
    setSavingPositions(true);
    const result = await safeFetch<{ error?: string }>(
      `/api/daywork/${editPositions.id}/update-positions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionsAvailable: val }),
      },
    );
    if (result.ok) {
      showSuccess('Positions updated');
      setEditPositions(null);
      loadData();
    } else {
      showError(result.error);
    }
    setSavingPositions(false);
  }

  async function handleDeleteTemplate(id: string) {
    setDeletingTemplate(id);
    const result = await safeFetch<{ error?: string }>(`/api/daywork/templates/${id}`, {
      method: 'DELETE',
    });
    if (result.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showSuccess('Template deleted');
    } else {
      showError(result.error);
    }
    setDeletingTemplate(null);
  }

  const statusColor: Record<string, string> = {
    active: 'bg-success text-white',
    in_progress: 'bg-primary text-primary-foreground',
    cancelled: 'bg-muted text-muted-foreground',
    completed: 'bg-sea text-white',
  };

  const statusLabel: Record<string, string> = {
    in_progress: 'in progress',
  };

  function renderPostingCard(posting: DayworkPosting, showActions: boolean) {
    return (
      <Card key={posting.id}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5">
              {posting.yacht_roles?.name ?? 'Unknown role'}
              {posting.yacht_roles?.name && (
                <EpauletteBadge roleName={posting.yacht_roles.name} size="sm" />
              )}
            </CardTitle>
            <Badge className={statusColor[posting.status] ?? ''}>
              {statusLabel[posting.status] ?? posting.status}
            </Badge>
          </div>
          <CardDescription>
            DW-{String(posting.job_number).padStart(5, '0')} ·{' '}
            {posting.vessels?.nda_flag ? 'NDA Vessel' : (posting.vessels?.name ?? 'Unknown vessel')}
            {posting.vessels?.vessel_size_bands?.label &&
              ` · ${convertSizeBandLabel(posting.vessels.vessel_size_bands.label, prefs.lengthUnit)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {posting.ports?.name ?? 'Unknown'}
              {posting.ports?.cities?.name && `, ${posting.ports.cities.name}`}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {posting.start_date} &rarr; {posting.end_date} ({posting.working_days}d)
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {currencySymbol(posting.currency)}
              {posting.day_rate}/day
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {posting.experience_brackets?.label && (
              <Badge variant="secondary" className="w-fit text-xs">
                {posting.experience_brackets.label}
              </Badge>
            )}
            {posting.positions_available > 1 && (
              <Badge variant="secondary" className="w-fit text-xs">
                {posting.positions_filled}/{posting.positions_available} crew accepted
              </Badge>
            )}
            {posting.permanent_opportunity && (
              <Badge variant="outline" className="w-fit text-xs">
                Could go permanent
              </Badge>
            )}
          </div>

          {posting.meals && posting.meals.length > 0 && (
            <p className="text-xs text-muted-foreground">Meals: {posting.meals.join(', ')}</p>
          )}

          {posting.notes && <p className="text-sm text-muted-foreground">{posting.notes}</p>}

          {showActions && (posting.status === 'active' || posting.status === 'in_progress') && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {posting.status === 'active' && (
                  <>
                    <Link href={`/daywork/${posting.id}/review`}>
                      <Button variant="default" size="sm">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        Review applicants
                      </Button>
                    </Link>
                    {posting.positions_available > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditPositions({
                            id: posting.id,
                            current: posting.positions_available,
                            filled: posting.positions_filled,
                          });
                          setEditPositionsValue(String(posting.positions_available));
                        }}
                      >
                        Edit crew count
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(posting.id)}
                      disabled={cancelling === posting.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {cancelling === posting.id ? 'Cancelling...' : 'Cancel'}
                    </Button>
                  </>
                )}
                {posting.status === 'in_progress' &&
                  engagementsByDaywork[posting.id] &&
                  (engagementsByDaywork[posting.id].length === 1 ? (
                    <Link href={`/messages/${engagementsByDaywork[posting.id][0].id}`}>
                      <Button variant="default" size="sm">
                        <MessageSquare className="mr-1 h-3.5 w-3.5" />
                        Go to chat
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {engagementsByDaywork[posting.id].map((eng) => (
                        <Link key={eng.id} href={`/messages/${eng.id}`}>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            {eng.crew_name ?? 'Crew member'}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">My Jobs</h1>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Filters
            </Button>
            <Link href="/daywork/post">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Post
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Daywork / Permanent toggle */}
      <div className="mx-auto max-w-lg mt-2 px-4">
        <SegmentedToggle
          options={[
            { value: 'daywork', label: 'Daywork' },
            { value: 'permanent', label: 'Permanent' },
          ]}
          value={mineMode}
          onChange={(v) => {
            setMineMode(v as 'daywork' | 'permanent');
            localStorage.setItem('dw-mine-mode', v);
          }}
        />
      </div>

      {/* Agent market feed button */}
      {isAgent && (
        <div className="mx-auto mt-2 max-w-lg px-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => router.push('/discover/market')}
          >
            <Eye className="h-4 w-4" />
            View job market
          </Button>
        </div>
      )}

      {mineMode === 'permanent' && <PermanentMineSection />}

      {mineMode === 'daywork' && (
        <>
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
            {error && (
              <div className="mb-4 flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={loadData}>
                  Retry
                </Button>
              </div>
            )}

            {showFilters && (
              <Card className="mb-4">
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
                    <Select value={filterPortId} onValueChange={setFilterPortId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All locations</SelectItem>
                        {ports.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.cities?.name ? ` — ${p.cities.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs
              value={currentTab}
              onValueChange={(value) => {
                if (isMyJobsTab(value)) {
                  setCurrentTab(value);
                }
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="active" className="flex-1">
                  Active{activePostings.length > 0 ? ` (${activePostings.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="flex-1">
                  In Progress
                  {inProgressPostings.length > 0 ? ` (${inProgressPostings.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex-1">
                  Done
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex-1">
                  Templates
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="flex flex-col gap-3 pt-2">
                <DayworkActiveSection
                  loading={loading}
                  postings={activePostings}
                  renderPostingCard={renderPostingCard}
                />
              </TabsContent>

              <TabsContent value="in_progress" className="flex flex-col gap-3 pt-2">
                <DayworkInProgressSection
                  loading={loading}
                  postings={inProgressPostings}
                  renderPostingCard={renderPostingCard}
                />
              </TabsContent>

              <TabsContent value="completed" className="flex flex-col gap-3 pt-2">
                <DayworkCompletedSection
                  loading={loading}
                  postings={completedPostings}
                  renderPostingCard={renderPostingCard}
                />
              </TabsContent>

              <TabsContent value="templates" className="flex flex-col gap-3 pt-2">
                <DayworkTemplatesSection
                  loading={loading}
                  templates={templates}
                  deletingTemplate={deletingTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                />
              </TabsContent>
            </Tabs>
          </div>

          <EditPositionsDialog
            editPositions={editPositions}
            editPositionsValue={editPositionsValue}
            setEditPositionsValue={setEditPositionsValue}
            savingPositions={savingPositions}
            onSave={handleSavePositions}
            onClose={() => setEditPositions(null)}
          />
        </>
      )}
    </main>
  );
}
