'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';

export interface AddedVessel {
  id: string;
  imoNumber: string;
  name: string;
  vesselType: 'motor' | 'sail';
  loaMeters: number;
}

export interface AddVesselDialogProps {
  open: boolean;
  /** Pre-fill the IMO field with whatever the user typed in the IMO lookup
   *  before reaching the manual fallback. */
  initialImoNumber?: string;
  onClose: () => void;
  onSubmitted: (vessel: AddedVessel) => void;
}

interface FlagState {
  id: string;
  name: string;
}

const MAX_NAME_LENGTH = 120;
const MAX_BUILDER_LENGTH = 200;

/**
 * Last-resort manual vessel-creation modal. Opens after the IMO lookup
 * at any of the four "Add a vessel" entry points returns no canonical
 * match. The submitting user gets a `source='pending'` row inserted via
 * `/api/vessels/request` and immediately sees the vessel on their
 * profile / posting; the row stays invisible to other users' lookups
 * until Wave E's admin queue acts on it.
 *
 * Required fields (top): IMO (7 digits), name, vessel type (motor / sail),
 * LOA in meters. Optional enrichment (flag state, year built, builder,
 * gross tonnage, beam) lives behind a "Add more details" toggle so the
 * common path stays short.
 */
export function AddVesselDialog({
  open,
  initialImoNumber,
  onClose,
  onSubmitted,
}: AddVesselDialogProps) {
  const [imo, setImo] = useState('');
  const [name, setName] = useState('');
  const [vesselType, setVesselType] = useState<'motor' | 'sail'>('motor');
  const [loa, setLoa] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [flagStateId, setFlagStateId] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [builder, setBuilder] = useState('');
  const [grossTonnage, setGrossTonnage] = useState('');
  const [beam, setBeam] = useState('');

  const [flagStates, setFlagStates] = useState<FlagState[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const imoRef = useRef<HTMLInputElement>(null);

  // Reset / prefill when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reset = setTimeout(() => {
      if (cancelled) return;
      setImo((initialImoNumber ?? '').replace(/\D/g, '').slice(0, 7));
      setName('');
      setVesselType('motor');
      setLoa('');
      setShowMore(false);
      setFlagStateId('');
      setYearBuilt('');
      setBuilder('');
      setGrossTonnage('');
      setBeam('');
      setErrorMessage(null);
      setSubmitting(false);
    }, 0);
    const focus = setTimeout(() => imoRef.current?.focus(), 50);
    return () => {
      cancelled = true;
      clearTimeout(reset);
      clearTimeout(focus);
    };
  }, [open, initialImoNumber]);

  // Load flag_states once on first open.
  useEffect(() => {
    if (!open || flagStates !== null) return;
    let cancelled = false;
    const sb = createClient();
    sb.from('flag_states')
      .select('id, name')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setFlagStates((data as FlagState[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, flagStates]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);

      const imoClean = imo.replace(/\D/g, '');
      if (imoClean.length !== 7) {
        setErrorMessage('IMO number must be exactly 7 digits.');
        return;
      }
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMessage('Vessel name is required.');
        return;
      }
      const loaNum = Number(loa);
      if (!Number.isFinite(loaNum) || loaNum < 1 || loaNum > 200) {
        setErrorMessage('LOA must be a number between 1 and 200 metres.');
        return;
      }

      const payload: Record<string, unknown> = {
        imo_number: imoClean,
        name: trimmedName,
        vessel_type: vesselType,
        loa_meters: loaNum,
      };
      if (flagStateId) payload.flag_state_id = flagStateId;
      if (yearBuilt) {
        const y = Number(yearBuilt);
        if (Number.isInteger(y) && y >= 1850 && y <= 2100) payload.year_built = y;
      }
      if (builder.trim()) payload.builder = builder.trim();
      if (grossTonnage) {
        const g = Number(grossTonnage);
        if (Number.isFinite(g) && g > 0) payload.gross_tonnage = g;
      }
      if (beam) {
        const b = Number(beam);
        if (Number.isFinite(b) && b > 0 && b < 100) payload.beam_meters = b;
      }

      setSubmitting(true);
      const res = await safeFetch<{ id: string }>('/api/vessels/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSubmitting(false);
        setErrorMessage(res.error ?? 'Could not save your vessel. Please try again.');
        return;
      }

      onSubmitted({
        id: res.data.id,
        imoNumber: imoClean,
        name: trimmedName,
        vesselType,
        loaMeters: loaNum,
      });
    },
    [imo, name, vesselType, loa, flagStateId, yearBuilt, builder, grossTonnage, beam, onSubmitted],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-0 py-0 md:items-center md:px-4 md:py-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-md flex-col bg-background shadow-xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Add a vessel</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t find this vessel in our records. Tell us about it and we&apos;ll add
            it. Only you will see it on your profile until our team verifies the details.
          </p>

          <label className="flex flex-col gap-1 text-xs font-medium">
            IMO number
            <input
              ref={imoRef}
              type="text"
              inputMode="numeric"
              required
              value={imo}
              onChange={(e) => setImo(e.target.value.replace(/\D/g, '').slice(0, 7))}
              placeholder="7 digits"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              maxLength={7}
              disabled={submitting}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Vessel name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder="e.g. Serenity"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              disabled={submitting}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Vessel type
            <select
              required
              value={vesselType}
              onChange={(e) => setVesselType(e.target.value as 'motor' | 'sail')}
              disabled={submitting}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            >
              <option value="motor">Motor</option>
              <option value="sail">Sail</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Length overall (LOA, metres)
            <input
              type="number"
              step="0.1"
              required
              value={loa}
              onChange={(e) => setLoa(e.target.value)}
              min={1}
              max={200}
              placeholder="e.g. 50"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
              disabled={submitting}
            />
          </label>

          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="self-start text-xs text-primary hover:underline"
          >
            {showMore ? '− Hide extra details' : '+ Add more details (optional)'}
          </button>

          {showMore && (
            <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Flag state
                <select
                  value={flagStateId}
                  onChange={(e) => setFlagStateId(e.target.value)}
                  disabled={submitting || flagStates === null}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                >
                  <option value="">
                    {flagStates === null ? 'Loading…' : 'Select a flag state'}
                  </option>
                  {flagStates?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Year built
                <input
                  type="number"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value)}
                  min={1850}
                  max={2100}
                  step={1}
                  placeholder="e.g. 2010"
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                  disabled={submitting}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Builder
                <input
                  type="text"
                  value={builder}
                  onChange={(e) => setBuilder(e.target.value)}
                  maxLength={MAX_BUILDER_LENGTH}
                  placeholder="e.g. Feadship"
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                  disabled={submitting}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Gross tonnage
                  <input
                    type="number"
                    value={grossTonnage}
                    onChange={(e) => setGrossTonnage(e.target.value)}
                    min={1}
                    placeholder="e.g. 250"
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                    disabled={submitting}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Beam (metres)
                  <input
                    type="number"
                    step="0.1"
                    value={beam}
                    onChange={(e) => setBeam(e.target.value)}
                    min={1}
                    max={99}
                    placeholder="e.g. 8.5"
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
                    disabled={submitting}
                  />
                </label>
              </div>
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save vessel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
