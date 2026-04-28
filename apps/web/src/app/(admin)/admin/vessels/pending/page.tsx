'use client';

import { useState, useEffect } from 'react';
import { useSafeFetch } from '@/hooks/use-safe-fetch';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { FlagStatePicker } from '@/components/flag-state-picker';
import type { PendingVessel } from '@/app/api/admin/vessels/pending/route';

interface MergeTarget {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: string;
}

interface MergePickerState {
  vesselId: string;
  vesselName: string;
}

interface ApproveBody {
  action: 'approve';
  name?: string;
  vessel_type?: 'motor' | 'sail';
  loa_meters?: number;
  flag_state_id?: string | null;
  year_built?: number | null;
  builder?: string | null;
  gross_tonnage?: number | null;
  beam_meters?: number | null;
  nda_flag?: boolean;
}

export default function AdminVesselsPendingPage() {
  const { data, isLoading, mutate } = useSafeFetch<{ vessels: PendingVessel[] }>(
    '/api/admin/vessels/pending',
  );

  const vessels = data?.vessels ?? [];
  const empty = !isLoading && vessels.length === 0;

  const { showError, showSuccess } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mergePicker, setMergePicker] = useState<MergePickerState | null>(null);
  const [approveTarget, setApproveTarget] = useState<PendingVessel | null>(null);

  async function runAction(
    id: string,
    body: ApproveBody | { action: 'merge'; mergeToId: string } | { action: 'hide' },
    successMessage: string,
  ) {
    setBusyId(id);
    const res = await safeFetch<{ ok: boolean }>(`/api/admin/vessels/pending/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      showError(res.error ?? 'Action failed. Try again.');
      return false;
    }
    showSuccess(successMessage);
    mutate();
    return true;
  }

  function handleApprove(row: PendingVessel) {
    setApproveTarget(row);
  }

  async function handleConfirmApprove(payload: ApproveBody) {
    if (!approveTarget) return;
    const ok = await runAction(
      approveTarget.id,
      payload,
      `Approved ${payload.name ?? approveTarget.name}`,
    );
    if (ok) setApproveTarget(null);
  }

  function handleHide(row: PendingVessel) {
    const ok = window.confirm(
      `Hide "${row.name}" (IMO ${row.imo_number})?\n\nThe submitter keeps seeing it on their profile / posting, but it won't appear in anyone else's vessel lookup or display. Use this for unverifiable submissions you don't want to approve OR merge — for example, an IMO that doesn't show up on Equasis.`,
    );
    if (!ok) return;
    runAction(row.id, { action: 'hide' }, `Hidden ${row.name}`);
  }

  function handleStartMerge(row: PendingVessel) {
    setMergePicker({ vesselId: row.id, vesselName: row.name });
  }

  async function handleConfirmMerge(target: MergeTarget) {
    if (!mergePicker) return;
    await runAction(
      mergePicker.vesselId,
      { action: 'merge', mergeToId: target.id },
      `Merged "${mergePicker.vesselName}" into "${target.name}" (IMO ${target.imo_number})`,
    );
    setMergePicker(null);
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Pending vessels</h1>
        <p className="text-sm text-muted-foreground">
          Manual vessel requests awaiting curation. Each row is currently visible only to the
          submitter — admin action makes it public, redirected, or permanently private.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {empty && <p className="text-muted-foreground">No pending vessels.</p>}

      {vessels.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2">Vessel</th>
              <th className="pb-2">Specs</th>
              <th className="pb-2">Submitted by</th>
              <th className="pb-2">When</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vessels.map((row) => {
              const prefix = row.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
              const specs = [
                row.loa_meters ? `${row.loa_meters}m LOA` : null,
                row.size_band_label,
                row.flag_state_name ? `${row.flag_state_name} flag` : null,
                row.year_built ? `built ${row.year_built}` : null,
                row.gross_tonnage ? `${row.gross_tonnage} GT` : null,
              ].filter(Boolean);
              const isBusy = busyId === row.id;
              return (
                <tr key={row.id} className="border-b last:border-b-0 align-top">
                  <td className="py-2">
                    <div className="font-medium">
                      {prefix} {row.name}
                    </div>
                    <div className="text-xs text-muted-foreground">IMO {row.imo_number}</div>
                    {row.builder && (
                      <div className="text-xs text-muted-foreground">{row.builder}</div>
                    )}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {specs.length > 0 ? specs.join(' · ') : '—'}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {row.submitter_name ?? '—'}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        title="Mark as canonical. Promotes the submitted name + history rows. The submitter and all future users will see this exact record."
                        onClick={() => handleApprove(row)}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        title="Re-point this submission to an existing canonical vessel by IMO, then delete the duplicate."
                        onClick={() => handleStartMerge(row)}
                      >
                        Merge
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        title="Keep visible to the submitter but exclude from everyone else's lookup. Use for unverifiable IMOs."
                        onClick={() => handleHide(row)}
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
      )}

      {mergePicker && (
        <MergePickerDialog
          state={mergePicker}
          onCancel={() => setMergePicker(null)}
          onPick={handleConfirmMerge}
        />
      )}

      {approveTarget && (
        <ApproveDialog
          row={approveTarget}
          busy={busyId === approveTarget.id}
          onCancel={() => setApproveTarget(null)}
          onConfirm={handleConfirmApprove}
        />
      )}
    </div>
  );
}

function MergePickerDialog({
  state,
  onCancel,
  onPick,
}: {
  state: MergePickerState;
  onCancel: () => void;
  onPick: (target: MergeTarget) => void;
}) {
  const [imo, setImo] = useState('');
  const trimmed = imo.replace(/\D/g, '');
  const { data } = useSafeFetch<{
    found: boolean;
    vessel?: { id: string; name: string; vessel_type: string; imo_number: string };
    results?: Array<{ id: string; name: string; vessel_type: string; imo_number: string }>;
  }>(trimmed.length >= 4 ? `/api/vessels/lookup?imo=${trimmed}` : null);

  const candidates: MergeTarget[] = (() => {
    if (!data) return [];
    if (trimmed.length === 7 && data.found && data.vessel) {
      return [data.vessel].filter((v) => v.id !== state.vesselId);
    }
    return (data.results ?? []).filter((v) => v.id !== state.vesselId);
  })();

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
          <h2 className="text-sm font-semibold">Merge &ldquo;{state.vesselName}&rdquo; into…</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Type an IMO number (4–7 digits) to find the canonical vessel this submission duplicates.
            The submitter&apos;s experience entry / posting will be re-pointed and the pending row
            deleted.
          </p>
        </div>
        <div className="px-4 py-3">
          <input
            type="text"
            inputMode="numeric"
            value={imo}
            onChange={(e) => setImo(e.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="4–7 digit IMO"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            autoFocus
            maxLength={7}
          />
        </div>
        <div className="max-h-72 overflow-y-auto border-t">
          {trimmed.length < 4 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Type an IMO number to search.
            </p>
          )}
          {trimmed.length >= 4 && candidates.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No canonical vessel matches this IMO.
            </p>
          )}
          {candidates.map((c) => {
            const prefix = c.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium">
                  {prefix} {c.name}
                </span>
                <span className="text-xs text-muted-foreground">IMO {c.imo_number}</span>
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

interface FlagState {
  id: string;
  name: string;
}

function ApproveDialog({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: PendingVessel;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: ApproveBody) => void;
}) {
  const [name, setName] = useState(row.name);
  const [vesselType, setVesselType] = useState<'motor' | 'sail'>(
    row.vessel_type === 'sail' ? 'sail' : 'motor',
  );
  const [loa, setLoa] = useState<string>(row.loa_meters != null ? String(row.loa_meters) : '');
  const [flagStateId, setFlagStateId] = useState<string>(row.flag_state_id ?? '');
  const [yearBuilt, setYearBuilt] = useState<string>(
    row.year_built != null ? String(row.year_built) : '',
  );
  const [builder, setBuilder] = useState(row.builder ?? '');
  const [grossTonnage, setGrossTonnage] = useState<string>(
    row.gross_tonnage != null ? String(row.gross_tonnage) : '',
  );
  const [beam, setBeam] = useState<string>(row.beam_meters != null ? String(row.beam_meters) : '');
  const [ndaFlag, setNdaFlag] = useState(row.nda_flag);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.from('flag_states').select('id, name').order('sort_order');
      if (data) setFlagStates(data as FlagState[]);
    })();
  }, []);

  function buildPayload(): ApproveBody {
    const payload: ApproveBody = { action: 'approve' };
    const trimmedName = name.trim();
    if (trimmedName !== row.name) payload.name = trimmedName;
    if (vesselType !== row.vessel_type) payload.vessel_type = vesselType;
    const loaNum = loa === '' ? NaN : Number(loa);
    if (Number.isFinite(loaNum) && loaNum !== row.loa_meters) payload.loa_meters = loaNum;
    if (flagStateId !== (row.flag_state_id ?? '')) {
      payload.flag_state_id = flagStateId === '' ? null : flagStateId;
    }
    const yearNum = yearBuilt === '' ? null : Number(yearBuilt);
    if (yearNum !== (row.year_built ?? null)) payload.year_built = yearNum;
    const trimmedBuilder = builder.trim();
    if (trimmedBuilder !== (row.builder ?? '')) {
      payload.builder = trimmedBuilder === '' ? null : trimmedBuilder;
    }
    const gtNum = grossTonnage === '' ? null : Number(grossTonnage);
    if (gtNum !== (row.gross_tonnage ?? null)) payload.gross_tonnage = gtNum;
    const beamNum = beam === '' ? null : Number(beam);
    if (beamNum !== (row.beam_meters ?? null)) payload.beam_meters = beamNum;
    if (ndaFlag !== row.nda_flag) payload.nda_flag = ndaFlag;
    return payload;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(buildPayload());
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Approve & enrich vessel</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            IMO {row.imo_number} · submitted by {row.submitter_name ?? 'unknown'}. Edit any field to
            enrich the canonical record before promoting from pending. Empty fields save as null.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Type</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="vessel-type"
                    checked={vesselType === 'motor'}
                    onChange={() => setVesselType('motor')}
                  />
                  Motor (M/Y)
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="vessel-type"
                    checked={vesselType === 'sail'}
                    onChange={() => setVesselType('sail')}
                  />
                  Sail (S/Y)
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">LOA (m) — band auto-derives</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={loa}
                onChange={(e) => setLoa(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Flag state</label>
            <FlagStatePicker
              flagStates={flagStates}
              value={flagStateId}
              onValueChange={setFlagStateId}
              placeholder="Pick a flag state…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Year built</label>
              <input
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Gross tonnage (GT)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={grossTonnage}
                onChange={(e) => setGrossTonnage(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Beam (m)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={beam}
                onChange={(e) => setBeam(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Builder</label>
              <input
                type="text"
                value={builder}
                onChange={(e) => setBuilder(e.target.value)}
                placeholder="e.g. Lürssen"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ndaFlag}
              onChange={(e) => setNdaFlag(e.target.checked)}
            />
            NDA vessel (IMO hidden from non-engaged crew)
          </label>
        </form>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(buildPayload())} disabled={busy}>
            {busy ? 'Saving…' : 'Approve & save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
