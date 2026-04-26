'use client';

import { useState } from 'react';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { PendingCity, PendingPort } from '@/app/api/admin/locations/pending/route';
import type { LocationSearchResult } from '@/app/api/locations/search/route';

type PendingKind = 'city' | 'port';

interface MergePickerState {
  kind: PendingKind;
  pendingId: string;
  pendingName: string;
}

export default function AdminLocationsPendingPage() {
  const { data, isLoading, mutate } = useSafeFetch<{
    cities: PendingCity[];
    ports: PendingPort[];
  }>('/api/admin/locations/pending');

  const cities = data?.cities ?? [];
  const ports = data?.ports ?? [];
  const empty = !isLoading && cities.length === 0 && ports.length === 0;

  const { showError, showSuccess } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mergePicker, setMergePicker] = useState<MergePickerState | null>(null);

  async function runAction(
    kind: PendingKind,
    id: string,
    body: { action: 'approve' | 'merge' | 'hide'; mergeToId?: string; name?: string },
    successMessage: string,
  ) {
    setBusyId(id);
    const url = `/api/admin/locations/pending/${kind === 'city' ? 'cities' : 'ports'}/${id}`;
    const res = await safeFetch<{ ok: boolean }>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      showError(res.error ?? 'Action failed. Try again.');
      return;
    }
    showSuccess(successMessage);
    mutate();
  }

  function handleApprove(kind: PendingKind, row: PendingCity | PendingPort) {
    const newName = window.prompt(
      'Mark this location as canonical. Edit the name to fix typos / capitalisation, or leave it as-is. The submitting user and all future users will see this exact spelling.',
      row.name,
    );
    if (newName === null) return; // cancelled
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      showError('Name cannot be empty');
      return;
    }
    runAction(
      kind,
      row.id,
      { action: 'approve', name: trimmed === row.name ? undefined : trimmed },
      `Approved ${trimmed}`,
    );
  }

  function handleHide(kind: PendingKind, row: PendingCity | PendingPort) {
    const ok = window.confirm(
      `Hide "${row.name}"?\n\nThe submitting user will keep seeing it on their profile, but it won't appear in anyone else's searches and won't be canonical. Use this for unverifiable submissions you don't want to approve OR merge.`,
    );
    if (!ok) return;
    runAction(kind, row.id, { action: 'hide' }, `Hidden ${row.name}`);
  }

  function handleStartMerge(kind: PendingKind, row: PendingCity | PendingPort) {
    setMergePicker({ kind, pendingId: row.id, pendingName: row.name });
  }

  async function handleConfirmMerge(target: LocationSearchResult) {
    if (!mergePicker) return;
    await runAction(
      mergePicker.kind,
      mergePicker.pendingId,
      { action: 'merge', mergeToId: target.id },
      `Merged "${mergePicker.pendingName}" into "${target.name}"`,
    );
    setMergePicker(null);
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Pending locations</h1>
        <p className="text-sm text-muted-foreground">
          Manual location requests awaiting curation. Each row is currently visible only to the
          submitting user.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {empty && <p className="text-muted-foreground">No pending locations. </p>}

      {cities.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Cities</h2>
          <PendingTable
            kind="city"
            rows={cities}
            busyId={busyId}
            onApprove={(r) => handleApprove('city', r)}
            onHide={(r) => handleHide('city', r)}
            onMerge={(r) => handleStartMerge('city', r)}
          />
        </section>
      )}

      {ports.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Ports / Marinas</h2>
          <PendingTable
            kind="port"
            rows={ports}
            busyId={busyId}
            onApprove={(r) => handleApprove('port', r)}
            onHide={(r) => handleHide('port', r)}
            onMerge={(r) => handleStartMerge('port', r)}
          />
        </section>
      )}

      {mergePicker && (
        <MergePickerDialog
          state={mergePicker}
          onCancel={() => setMergePicker(null)}
          onPick={handleConfirmMerge}
        />
      )}
    </div>
  );
}

function PendingTable({
  kind,
  rows,
  busyId,
  onApprove,
  onHide,
  onMerge,
}: {
  kind: PendingKind;
  rows: Array<PendingCity | PendingPort>;
  busyId: string | null;
  onApprove: (row: PendingCity | PendingPort) => void;
  onHide: (row: PendingCity | PendingPort) => void;
  onMerge: (row: PendingCity | PendingPort) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2">Name</th>
          <th className="pb-2">Where</th>
          <th className="pb-2">Submitted by</th>
          <th className="pb-2">When</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const where =
            kind === 'port'
              ? [(r as PendingPort).city_name, r.region_name].filter(Boolean).join(', ')
              : [r.region_name, r.country_code].filter(Boolean).join(' · ');
          const submitted = r.submitter_name ?? '—';
          const when = new Date(r.created_at).toLocaleString();
          const isBusy = busyId === r.id;
          return (
            <tr key={r.id} className="border-b last:border-b-0">
              <td className="py-2 font-medium">{r.name}</td>
              <td className="py-2 text-muted-foreground">{where || '—'}</td>
              <td className="py-2 text-muted-foreground">{submitted}</td>
              <td className="py-2 text-muted-foreground">{when}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    title="Mark as canonical. The submitting user and all future users will see this exact spelling."
                    onClick={() => onApprove(r)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    title="Re-point this submission to an existing canonical row, then delete it."
                    onClick={() => onMerge(r)}
                  >
                    Merge
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    title="Keep visible to the submitter but exclude from everyone else's search."
                    onClick={() => onHide(r)}
                  >
                    Hide
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MergePickerDialog({
  state,
  onCancel,
  onPick,
}: {
  state: MergePickerState;
  onCancel: () => void;
  onPick: (target: LocationSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const { data } = useSafeFetch<{ results: LocationSearchResult[] }>(
    query.trim().length >= 2 ? `/api/locations/search?q=${encodeURIComponent(query.trim())}` : null,
  );
  const allResults = data?.results ?? [];
  const results = allResults
    .filter((r) => r.kind === state.kind)
    .filter((r) => r.id !== state.pendingId);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Merge &ldquo;{state.pendingName}&rdquo; into…</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick the canonical {state.kind} this submission duplicates. The submitting user&apos;s
            FK gets re-pointed to the canonical row, all related rows follow, and the pending entry
            is deleted.
          </p>
        </div>
        <div className="px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search canonical ${state.kind}s…`}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto border-t">
          {query.trim().length < 2 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Start typing to search.
            </p>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No canonical match.
            </p>
          )}
          {results.map((r) => {
            const tail = r.parent_name ?? null;
            return (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  {tail && <span className="ml-1 text-xs text-muted-foreground">— {tail}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {r.kind}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
