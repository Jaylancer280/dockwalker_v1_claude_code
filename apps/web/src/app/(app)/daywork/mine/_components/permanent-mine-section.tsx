'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Briefcase, Ship, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { currencySymbol } from '@/lib/units';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Posting = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = any;

type Tab = 'active' | 'in_negotiation' | 'filled' | 'cancelled' | 'templates';

function formatSalary(min: number, max: number, currency: string, period: string) {
  const sym = currencySymbol(currency);
  const per = period === 'annual' ? '/yr' : '/mo';
  if (min === max) return `${sym}${min.toLocaleString()}${per}`;
  return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
}

function formatStartDate(dateStr: string) {
  const d = new Date(dateStr);
  if (d <= new Date()) return 'ASAP';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function PermanentMineSection() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [postings, setPostings] = useState<Posting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'active';
    return (sessionStorage.getItem('dw-perm-mine-tab') as Tab) || 'active';
  });
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      safeFetch<{ postings?: Posting[] }>('/api/permanent/mine'),
      safeFetch<{ templates?: Template[] }>('/api/permanent/templates'),
    ]).then(([mineResult, tplResult]) => {
      if (mineResult.ok) setPostings(mineResult.data.postings ?? []);
      else showError('Failed to load postings');
      if (tplResult.ok) setTemplates(tplResult.data.templates ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    sessionStorage.setItem('dw-perm-mine-tab', t);
  }

  async function handleCancel(postingId: string) {
    setCancelling(true);
    const result = await safeFetch<{ error?: string }>(`/api/permanent/${postingId}/cancel`, {
      method: 'POST',
      body: '{}',
    });
    if (result.ok) {
      showSuccess('Posting cancelled');
      setPostings((prev) =>
        prev.map((p) => (p.id === postingId ? { ...p, status: 'cancelled' } : p)),
      );
    } else {
      showError(result.error);
    }
    setCancelling(false);
    setCancelId(null);
  }

  async function handleGoToChat(postingId: string) {
    const supabase = createClient();
    const { data: eng } = await supabase
      .from('active_engagements')
      .select('id')
      .eq('permanent_posting_id', postingId)
      .eq('status', 'active')
      .single();
    if (eng) {
      router.push(`/messages/${eng.id}`);
    } else {
      showError('No active engagement found');
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    setDeletingId(templateId);
    const result = await safeFetch(`/api/permanent/templates/${templateId}`, { method: 'DELETE' });
    if (result.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      showSuccess('Template deleted');
    } else {
      showError(result.error);
    }
    setDeletingId(null);
  }

  const active = postings.filter((p: Posting) => p.status === 'active');
  const inNegotiation = postings.filter((p: Posting) => p.status === 'in_negotiation');
  const filled = postings.filter((p: Posting) => p.status === 'filled');
  const cancelled = postings.filter((p: Posting) => p.status === 'cancelled');

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: active.length },
    { key: 'in_negotiation', label: 'Negotiating', count: inNegotiation.length },
    { key: 'filled', label: 'Filled', count: filled.length },
    { key: 'cancelled', label: 'Cancelled', count: cancelled.length },
    { key: 'templates', label: 'Templates', count: templates.length },
  ];

  const currentPostings =
    tab === 'active'
      ? active
      : tab === 'in_negotiation'
        ? inNegotiation
        : tab === 'filled'
          ? filled
          : tab === 'cancelled'
            ? cancelled
            : [];

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center pt-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-20">
      {/* Tabs */}
      <div className="flex overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`shrink-0 px-3 py-2 text-xs font-medium ${
              tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
            }`}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 text-[10px] opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="mt-4 space-y-3">
          {templates.length === 0 && (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              No saved templates. Save a template when posting a permanent job.
            </p>
          )}
          {templates.map((t: Template) => (
            <div key={t.id} className="rounded-xl border bg-card p-4">
              <p className="font-semibold">{t.template_name}</p>
              <p className="text-xs text-muted-foreground">
                {t.yacht_roles?.name} · {t.ports?.name}
              </p>
              {t.salary_min != null && (
                <p className="text-xs text-primary">
                  {formatSalary(t.salary_min, t.salary_max, t.salary_currency, t.salary_period)}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push(`/daywork/post?permanentTemplateId=${t.id}`)}
                >
                  Use
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deletingId === t.id}
                  onClick={() => handleDeleteTemplate(t.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Posting tabs */}
      {tab !== 'templates' && (
        <div className="mt-4 space-y-3">
          {currentPostings.length === 0 && (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              No {tab.replace('_', ' ')} postings
            </p>
          )}
          {currentPostings.map((p: Posting) => (
            <div key={p.id} className="rounded-xl border bg-card p-4">
              {/* Header */}
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs">
                  PM-{String(p.job_number).padStart(5, '0')}
                </Badge>
                <Badge
                  variant={
                    p.status === 'active'
                      ? 'default'
                      : p.status === 'in_negotiation'
                        ? 'secondary'
                        : p.status === 'filled'
                          ? 'outline'
                          : 'destructive'
                  }
                >
                  {p.status === 'in_negotiation' ? 'Negotiating' : p.status}
                </Badge>
              </div>

              {/* Role + vessel */}
              <p className="text-sm font-semibold">{p.yacht_roles?.name ?? 'Unknown Role'}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Ship className="h-3 w-3" />
                <span>{p.vessels?.nda_flag ? 'NDA Vessel' : (p.vessels?.name ?? 'Unknown')}</span>
              </div>

              {/* Location */}
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{[p.ports?.name, p.ports?.cities?.name].filter(Boolean).join(', ')}</span>
              </div>

              {/* Salary + start */}
              <div className="mt-1 flex items-center gap-1.5 text-xs text-primary">
                <Briefcase className="h-3 w-3" />
                <span>
                  {formatSalary(p.salary_min, p.salary_max, p.salary_currency, p.salary_period)}
                </span>
                <span className="text-muted-foreground">
                  · Start: {formatStartDate(p.start_date)}
                </span>
              </div>

              {/* Counts */}
              {(p.status === 'active' || p.status === 'in_negotiation') && (
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  {p.applicant_count > 0 && (
                    <span>
                      {p.applicant_count} applicant{p.applicant_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span>
                    {p.shortlist_count}/{p.shortlist_cap} shortlisted
                  </span>
                </div>
              )}

              {/* In negotiation banner */}
              {p.status === 'in_negotiation' && p.selected_crew_name && (
                <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  In negotiation with {p.selected_crew_name}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {p.status === 'active' && (
                  <>
                    <Button size="sm" onClick={() => router.push(`/permanent/${p.id}/review`)}>
                      Review applicants
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelId(p.id)}>
                      Cancel
                    </Button>
                  </>
                )}
                {p.status === 'in_negotiation' && (
                  <>
                    <Button size="sm" onClick={() => handleGoToChat(p.id)}>
                      Go to chat
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelId(p.id)}>
                      Cancel posting
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this posting?</DialogTitle>
            <DialogDescription>
              This will cancel the posting and reject all pending applicants. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Keep posting
            </Button>
            <Button
              variant="destructive"
              disabled={cancelling}
              onClick={() => {
                if (cancelId) handleCancel(cancelId);
              }}
            >
              {cancelling ? 'Cancelling...' : 'Cancel posting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
