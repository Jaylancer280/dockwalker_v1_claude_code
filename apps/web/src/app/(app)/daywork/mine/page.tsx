'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Briefcase,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  CheckCircle,
  Trash2,
  Play,
  Loader2,
  SlidersHorizontal,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { isMyJobsTab, MY_JOBS_TAB_STORAGE_KEY, type MyJobsTab } from '@/lib/my-jobs-tab';
import { currencySymbol, convertSizeBandLabel } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';

interface DayworkPosting {
  id: string;
  job_number: number;
  role_context: string;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number;
  currency: string;
  meals: string[];
  notes: string | null;
  positions_available: number;
  positions_filled: number;
  status: string;
  created_at: string;
  yacht_roles: { name: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string; nda_flag: boolean; vessel_size_bands: { label: string } | null } | null;
  experience_brackets: { label: string } | null;
}

interface Template {
  id: string;
  name: string;
  yacht_roles: { name: string } | null;
  ports: { name: string; cities: { name: string; regions: { name: string } } } | null;
  vessels: { name: string } | null;
  day_rate: number | null;
  currency: string | null;
  working_days: number | null;
  created_at: string;
}

export default function MyPostingsPage() {
  const router = useRouter();
  const prefs = usePreferences();
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
      const [rolesRes, portsRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name').order('sort_order'),
        supabase.from('ports').select('id, name, cities(name)').order('name'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (portsRes.data)
        setPorts(
          portsRes.data as unknown as { id: string; name: string; cities: { name: string } }[],
        );
    }
    loadLookups();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const filterParams = new URLSearchParams();
      if (filterRoleId && filterRoleId !== 'all') filterParams.set('roleId', filterRoleId);
      if (filterPortId && filterPortId !== 'all') filterParams.set('portId', filterPortId);
      const filterSuffix = filterParams.toString() ? `&${filterParams.toString()}` : '';

      const [activeRes, inProgressRes, completedRes, templatesRes] = await Promise.all([
        fetch(`/api/daywork/mine?status=active${filterSuffix}`).then((r) => r.json()),
        fetch(`/api/daywork/mine?status=in_progress${filterSuffix}`).then((r) => r.json()),
        fetch(`/api/daywork/mine?status=completed,cancelled${filterSuffix}`).then((r) => r.json()),
        fetch('/api/daywork/templates').then((r) => r.json()),
      ]);
      if (activeRes.dayworks) setActivePostings(activeRes.dayworks);
      if (inProgressRes.dayworks) {
        setInProgressPostings(inProgressRes.dayworks);
        // Fetch engagement IDs for in-progress postings so we can link to chat
        const ipIds = (inProgressRes.dayworks as DayworkPosting[]).map((d: DayworkPosting) => d.id);
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
      if (completedRes.dayworks) setCompletedPostings(completedRes.dayworks);
      if (templatesRes.templates) setTemplates(templatesRes.templates);
      setError(null);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterRoleId, filterPortId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch stale data when the page becomes visible again (tab switch,
  // returning from another app, or browser back/forward cache)
  const lastFetch = useRef(Date.now());
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
    const res = await fetch(`/api/daywork/${dayworkId}/cancel`, { method: 'POST' });
    if (res.ok) loadData();
    setCancelling(null);
  }

  async function handleSavePositions() {
    if (!editPositions) return;
    const val = parseInt(editPositionsValue, 10);
    if (isNaN(val) || val < 1 || val > 20 || val < editPositions.filled) return;
    setSavingPositions(true);
    const res = await fetch(`/api/daywork/${editPositions.id}/update-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionsAvailable: val }),
    });
    if (res.ok) {
      setEditPositions(null);
      loadData();
    }
    setSavingPositions(false);
  }

  async function handleDeleteTemplate(id: string) {
    setDeletingTemplate(id);
    const res = await fetch(`/api/daywork/templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
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
            <CardTitle className="text-base">
              {posting.yacht_roles?.name ?? 'Unknown role'}
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
              In Progress{inProgressPostings.length > 0 ? ` (${inProgressPostings.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              Done
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="flex flex-col gap-3 pt-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && activePostings.length === 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">No active postings</CardTitle>
                  </div>
                  <CardDescription>Post your first daywork to start finding crew.</CardDescription>
                </CardHeader>
              </Card>
            )}
            {activePostings.map((p) => renderPostingCard(p, true))}
          </TabsContent>

          <TabsContent value="in_progress" className="flex flex-col gap-3 pt-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && inProgressPostings.length === 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">No in-progress jobs</CardTitle>
                  </div>
                  <CardDescription>Jobs move here after you accept an applicant.</CardDescription>
                </CardHeader>
              </Card>
            )}
            {inProgressPostings.map((p) => renderPostingCard(p, true))}
          </TabsContent>

          <TabsContent value="completed" className="flex flex-col gap-3 pt-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && completedPostings.length === 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">No completed postings</CardTitle>
                  </div>
                  <CardDescription>
                    Completed and cancelled postings will appear here.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            {completedPostings.map((p) => renderPostingCard(p, false))}
          </TabsContent>

          <TabsContent value="templates" className="flex flex-col gap-3 pt-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && templates.length === 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">No templates</CardTitle>
                  </div>
                  <CardDescription>
                    Save a template from the post form to reuse common configurations.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <CardDescription>
                    {[
                      t.yacht_roles?.name,
                      t.ports?.name,
                      t.vessels?.name,
                      t.day_rate ? `${currencySymbol(t.currency ?? 'EUR')}${t.day_rate}/day` : null,
                      t.working_days ? `${t.working_days}d` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/daywork/post?templateId=${t.id}`)}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" />
                      Use
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(t.id)}
                      disabled={deletingTemplate === t.id}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {deletingTemplate === t.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!editPositions} onOpenChange={() => setEditPositions(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit crew count</DialogTitle>
            <DialogDescription>
              {editPositions && editPositions.filled > 0
                ? `${editPositions.filled} position${editPositions.filled !== 1 ? 's' : ''} already filled. Minimum is ${editPositions.filled}.`
                : 'How many crew do you need for this job?'}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={editPositions?.filled ?? 1}
            max={20}
            value={editPositionsValue}
            onChange={(e) => setEditPositionsValue(e.target.value)}
          />
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditPositions(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePositions} disabled={savingPositions}>
              {savingPositions ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
