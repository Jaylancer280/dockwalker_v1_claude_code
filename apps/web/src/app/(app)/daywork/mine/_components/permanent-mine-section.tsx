'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Briefcase, Ship, Trash2, Pencil, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { currencySymbol } from '@dockwalker/shared';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';
import { ShareJobButton } from '@/components/share-job-button';
import { EpauletteBadge } from '@/components/epaulette-badge';

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
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();

  const [postings, setPostings] = useState<Posting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'active';
    return (sessionStorage.getItem('dw-perm-mine-tab') as Tab) || 'active';
  });

  // B-005: URL ?tab= takes precedence over sessionStorage on mount. Lets
  // entry points like "Post from a template" land here on the templates
  // tab even if the user previously parked on Active.
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (
      tabParam === 'active' ||
      tabParam === 'in_negotiation' ||
      tabParam === 'filled' ||
      tabParam === 'cancelled' ||
      tabParam === 'templates'
    ) {
      setTab(tabParam);
      sessionStorage.setItem('dw-perm-mine-tab', tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDeleteTemplate(templateId: string) {
    setConfirmDeleteId(null);
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
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-width w-full px-4 pt-4 pb-20">
      <UnderlineTabs
        options={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))}
        value={tab}
        onChange={(v) => switchTab(v as typeof tab)}
      />

      {/* Templates tab */}
      {tab === 'templates' && (
        <>
          {/* B-005: dedicated Create-template entry. Routes to the permanent
              post form pre-toggled into template-mode. */}
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/daywork/post?type=permanent&mode=template')}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create template
            </Button>
          </div>
          <div className="mt-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {templates.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground">
                No saved templates. Tap Create template to build one.
              </p>
            )}
            {templates.map((t: Template) => (
              <div
                key={t.id}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <p className="font-semibold">{t.template_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[t.yacht_roles?.name, t.ports?.name].filter(Boolean).join(' · ') ||
                    'Partial template — tap Edit to fill in more fields'}
                </p>
                {/* B-005: salary block requires ALL four fields. Partial-save
                    (mig 00134) means any of min/max/currency/period can be
                    null on a half-built template — formatSalary calls
                    .toLocaleString() on max which throws on null. */}
                {t.salary_min != null &&
                  t.salary_max != null &&
                  t.salary_currency &&
                  t.salary_period && (
                    <p className="text-xs text-primary">
                      {formatSalary(t.salary_min, t.salary_max, t.salary_currency, t.salary_period)}
                    </p>
                  )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(`/daywork/post?type=permanent&permanentTemplateId=${t.id}`)
                    }
                  >
                    Use
                  </Button>
                  {/* B-005: edit-in-place. PATCHes the template row on submit. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(
                        `/daywork/post?type=permanent&mode=edit&permanentTemplateId=${t.id}`,
                      )
                    }
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deletingId === t.id}
                    onClick={() => setConfirmDeleteId(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Posting tabs */}
      {tab !== 'templates' && (
        <div className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {currentPostings.length === 0 && (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              No {tab.replace('_', ' ')} postings
            </p>
          )}
          {currentPostings.map((p: Posting) => (
            <div
              key={p.id}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4"
            >
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
              <div className="flex items-center gap-1.5">
                {p.yacht_roles?.name && <EpauletteBadge roleName={p.yacht_roles.name} size="sm" />}
                <p className="text-sm font-semibold">{p.yacht_roles?.name ?? 'Unknown Role'}</p>
              </div>
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
                <div className="mt-2 rounded bg-[var(--warning-lo)] px-2 py-1 text-xs text-[var(--warning)]">
                  In negotiation with {p.selected_crew_name}
                </div>
              )}

              {p.status === 'active' && (
                <div className="mt-2">
                  <ShareJobButton
                    jobNumber={`PM-${String(p.job_number).padStart(5, '0')}`}
                    roleName={p.yacht_roles?.name ?? 'Permanent'}
                    location={p.ports?.cities?.name ?? ''}
                    rate={formatSalary(
                      p.salary_min,
                      p.salary_max,
                      p.salary_currency,
                      p.salary_period,
                    )}
                  />
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

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDeleteTemplate(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
