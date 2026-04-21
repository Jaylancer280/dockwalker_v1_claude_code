'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReportRow {
  id: string;
  reporter_person_id: string;
  reporter_name: string | null;
  reported_person_id: string;
  reported_name: string | null;
  engagement_id: string | null;
  reason_category: string;
  status: 'open' | 'reviewing' | 'dismissed' | 'actioned';
  resolution: 'dismissed' | 'warned' | 'actioned' | null;
  created_at: string;
}

interface ReportDetail extends ReportRow {
  reason_text: string;
  admin_notes: string | null;
  admin_person_id: string | null;
  admin_name: string | null;
  resolved_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  reviewing: 'Reviewing',
  dismissed: 'Dismissed',
  actioned: 'Actioned',
};

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [page, setPage] = useState(1);

  const query = new URLSearchParams();
  if (statusFilter !== 'all') query.set('status', statusFilter);
  query.set('page', String(page));

  const { data, isLoading, mutate } = useSafeFetch<{
    reports: ReportRow[];
    total: number;
    page: number;
    page_size: number;
  }>(`/api/admin/reports?${query.toString()}`);

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border bg-transparent p-1.5 text-sm"
          >
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="dismissed">Dismissed</option>
            <option value="actioned">Actioned</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground">No reports in this view.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Reporter</th>
              <th className="pb-2">Reported</th>
              <th className="pb-2">Category</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const isSafety = r.reason_category === 'safety_concern';
              const isOpen = expandedId === r.id;
              return (
                <ReportRowAndDetail
                  key={r.id}
                  row={r}
                  isOpen={isOpen}
                  isSafety={isSafety}
                  onToggle={() => setExpandedId(isOpen ? null : r.id)}
                  onChanged={() => mutate()}
                />
              );
            })}
          </tbody>
        </table>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function ReportRowAndDetail({
  row,
  isOpen,
  isSafety,
  onToggle,
  onChanged,
}: {
  row: ReportRow;
  isOpen: boolean;
  isSafety: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  return (
    <>
      <tr className="border-b">
        <td className="py-2">
          <Link
            href={`/admin/users/${row.reporter_person_id}`}
            className="text-primary hover:underline"
          >
            {row.reporter_name ?? '[unknown]'}
          </Link>
        </td>
        <td className="py-2">
          <Link
            href={`/admin/users/${row.reported_person_id}`}
            className="text-primary hover:underline"
          >
            {row.reported_name ?? '[unknown]'}
          </Link>
        </td>
        <td className="py-2">
          {isSafety ? (
            <Badge variant="destructive">Safety</Badge>
          ) : (
            <span className="text-xs capitalize">{row.reason_category.replace(/_/g, ' ')}</span>
          )}
        </td>
        <td className="py-2">
          <Badge variant={row.status === 'open' ? 'default' : 'secondary'}>
            {STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        </td>
        <td className="py-2 text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </td>
        <td className="py-2 text-right">
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {isOpen ? 'Close' : 'Open'}
          </Button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={6} className="border-b bg-muted/30 p-4">
            <ReportDetailPanel reportId={row.id} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function ReportDetailPanel({ reportId, onChanged }: { reportId: string; onChanged: () => void }) {
  const { data, mutate } = useSafeFetch<{ report: ReportDetail }>(`/api/admin/reports/${reportId}`);
  const report = data?.report;
  const { showSuccess, showError } = useToast();

  const [status, setStatus] = useState<string>('');
  const [resolution, setResolution] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  if (!report) return <p className="text-xs text-muted-foreground">Loading…</p>;

  async function handleSave() {
    const updates: Record<string, unknown> = {};
    if (status && status !== report!.status) updates.status = status;
    if (resolution && resolution !== (report!.resolution ?? '')) updates.resolution = resolution;
    if (notes && notes !== (report!.admin_notes ?? '')) updates.admin_notes = notes;
    if (Object.keys(updates).length === 0) {
      showError('Nothing to save — change status, resolution, or notes first');
      return;
    }
    setSaving(true);
    const res = await safeFetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    if (res.ok) {
      showSuccess('Report updated');
      setStatus('');
      setResolution('');
      setNotes('');
      mutate();
      onChanged();
    } else {
      showError(res.error ?? 'Failed to update report');
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Reporter wrote</p>
        <p className="whitespace-pre-wrap">{report.reason_text}</p>
      </div>

      {report.engagement_id && (
        <div>
          <Link
            href={`/admin/engagements/${report.engagement_id}`}
            className="text-xs text-primary hover:underline"
          >
            View linked engagement →
          </Link>
        </div>
      )}

      {report.admin_notes && (
        <div>
          <p className="text-xs text-muted-foreground">
            Admin notes (last edited by {report.admin_name ?? '[unknown admin]'})
          </p>
          <p className="whitespace-pre-wrap">{report.admin_notes}</p>
        </div>
      )}

      <div className="rounded border border-border bg-background p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Update report</p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Blocking or hiding a posting is a separate action. This form only records resolution
          status.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px]">Status</span>
            <select
              value={status || report.status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border bg-transparent p-1.5 text-xs"
            >
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="dismissed">Dismissed</option>
              <option value="actioned">Actioned</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px]">Resolution</span>
            <select
              value={resolution || report.resolution || ''}
              onChange={(e) => setResolution(e.target.value)}
              className="rounded border bg-transparent p-1.5 text-xs"
            >
              <option value="">—</option>
              <option value="dismissed">Dismissed</option>
              <option value="warned">Warned</option>
              <option value="actioned">Actioned</option>
            </select>
          </label>
        </div>
        <textarea
          value={notes || report.admin_notes || ''}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Admin notes (internal only)…"
          className="mt-2 w-full rounded border bg-transparent p-2 text-xs"
        />
        <Button size="sm" className="mt-2" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
