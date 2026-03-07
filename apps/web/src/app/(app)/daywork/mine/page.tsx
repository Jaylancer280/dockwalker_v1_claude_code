'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Briefcase,
  Calendar,
  MapPin,
  DollarSign,
  X,
  Users,
  CheckCircle,
  Trash2,
  Play,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DayworkPosting {
  id: string;
  role_context: string;
  start_date: string;
  end_date: string;
  working_days: number;
  day_rate: number | null;
  meals: string[];
  notes: string | null;
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
  working_days: number | null;
  created_at: string;
}

export default function MyPostingsPage() {
  const router = useRouter();
  const [activePostings, setActivePostings] = useState<DayworkPosting[]>([]);
  const [completedPostings, setCompletedPostings] = useState<DayworkPosting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [activeRes, completedRes, templatesRes] = await Promise.all([
        fetch('/api/daywork/mine?status=active').then((r) => r.json()),
        fetch('/api/daywork/mine?status=completed,cancelled').then((r) => r.json()),
        fetch('/api/daywork/templates').then((r) => r.json()),
      ]);
      if (activeRes.dayworks) setActivePostings(activeRes.dayworks);
      if (completedRes.dayworks) setCompletedPostings(completedRes.dayworks);
      if (templatesRes.templates) setTemplates(templatesRes.templates);
      setError(null);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCancel(dayworkId: string) {
    setCancelling(dayworkId);
    const res = await fetch(`/api/daywork/${dayworkId}/cancel`, { method: 'POST' });
    if (res.ok) loadData();
    setCancelling(null);
  }

  async function handleComplete(dayworkId: string) {
    if (!confirm('Mark this daywork as completed? This cannot be undone.')) return;
    setCompleting(dayworkId);
    const res = await fetch(`/api/daywork/${dayworkId}/complete`, { method: 'POST' });
    if (res.ok) loadData();
    setCompleting(null);
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
    cancelled: 'bg-muted text-muted-foreground',
    completed: 'bg-sea text-white',
  };

  function renderPostingCard(posting: DayworkPosting, showActions: boolean) {
    return (
      <Card key={posting.id}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {posting.yacht_roles?.name ?? 'Unknown role'}
            </CardTitle>
            <Badge className={statusColor[posting.status] ?? ''}>{posting.status}</Badge>
          </div>
          <CardDescription>
            {posting.vessels?.nda_flag ? 'NDA Vessel' : (posting.vessels?.name ?? 'Unknown vessel')}
            {posting.vessels?.vessel_size_bands?.label &&
              ` · ${posting.vessels.vessel_size_bands.label}`}
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
            {posting.day_rate && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                &euro;{posting.day_rate}/day
              </span>
            )}
          </div>

          {posting.experience_brackets?.label && (
            <Badge variant="secondary" className="w-fit text-xs">
              {posting.experience_brackets.label}
            </Badge>
          )}

          {posting.meals && posting.meals.length > 0 && (
            <p className="text-xs text-muted-foreground">Meals: {posting.meals.join(', ')}</p>
          )}

          {posting.notes && <p className="text-sm text-muted-foreground">{posting.notes}</p>}

          {showActions && posting.status === 'active' && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Link href={`/daywork/${posting.id}/review`}>
                  <Button variant="default" size="sm">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    Review applicants
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleComplete(posting.id)}
                  disabled={completing === posting.id}
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  {completing === posting.id ? 'Completing...' : 'Mark complete'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(posting.id)}
                  disabled={cancelling === posting.id}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  {cancelling === posting.id ? 'Cancelling...' : 'Cancel'}
                </Button>
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
          <Link href="/daywork/post">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Post daywork
            </Button>
          </Link>
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

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              Active
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              Completed
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
                      t.day_rate ? `€${t.day_rate}/day` : null,
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
    </main>
  );
}
