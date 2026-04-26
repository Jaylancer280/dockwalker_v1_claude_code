'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';
import type { RegionListItem } from '@/app/api/locations/regions/route';

interface SubmitResult {
  cityId: string;
  portId?: string;
}

export interface LocationRequestModalProps {
  open: boolean;
  /** When `port-required`, the Port/Marina field becomes mandatory. */
  mode: 'port-required' | 'port-optional';
  /** Pre-fills the city input from whatever the user typed in the picker. */
  initialQuery?: string;
  onClose: () => void;
  onSubmitted: (result: SubmitResult, displayLabel: string) => void;
}

const MAX_NAME_LENGTH = 120;
const MAX_NOTES_LENGTH = 500;

/**
 * Last-resort manual location entry. Opens after canonical AND OSM
 * Nominatim fallback both return zero hits. The submitting user gets a
 * `source='pending'` row inserted server-side and immediately sees
 * their typed text on their profile/posting; other users' searches
 * filter pending rows out until an admin acts on them via Wave D's
 * `/admin/locations/pending` queue.
 */
export function LocationRequestModal({
  open,
  mode,
  initialQuery,
  onClose,
  onSubmitted,
}: LocationRequestModalProps) {
  const [regions, setRegions] = useState<RegionListItem[] | null>(null);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionId, setRegionId] = useState<string>('');
  const [city, setCity] = useState('');
  const [port, setPort] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cityRef = useRef<HTMLInputElement>(null);

  // Load regions on open. Cached client-side for the modal's lifetime.
  useEffect(() => {
    if (!open) return;
    if (regions !== null) return;
    let cancelled = false;
    const startLoading = setTimeout(() => {
      if (!cancelled) setRegionsLoading(true);
    }, 0);
    safeFetch<{ regions: RegionListItem[] }>('/api/locations/regions')
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setRegions(res.data.regions);
        } else {
          setRegions([]);
          setErrorMessage('Could not load country list. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(startLoading);
    };
  }, [open, regions]);

  // Reset / prefill form on open. Deferred so we don't hit
  // react-hooks/set-state-in-effect on the synchronous state writes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reset = setTimeout(() => {
      if (cancelled) return;
      setCity(initialQuery?.trim() ?? '');
      setPort('');
      setNotes('');
      setRegionId('');
      setErrorMessage(null);
      setSubmitting(false);
    }, 0);
    const focus = setTimeout(() => cityRef.current?.focus(), 50);
    return () => {
      cancelled = true;
      clearTimeout(reset);
      clearTimeout(focus);
    };
  }, [open, initialQuery]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const portRequired = mode === 'port-required';

  function selectedRegion(): RegionListItem | null {
    return regions?.find((r) => r.id === regionId) ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const region = selectedRegion();
    if (!region) {
      setErrorMessage('Please pick a country.');
      return;
    }
    if (!region.country_code) {
      setErrorMessage('Selected country has no country code on file. Pick a different country.');
      return;
    }
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setErrorMessage('City is required.');
      return;
    }
    const trimmedPort = port.trim();
    if (portRequired && !trimmedPort) {
      setErrorMessage('Port or marina name is required.');
      return;
    }

    setSubmitting(true);
    const res = await safeFetch<{ cityId: string; portId?: string }>('/api/locations/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country_code: region.country_code,
        country_name: region.name,
        city_name: trimmedCity,
        port_name: trimmedPort || null,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      setErrorMessage(res.error ?? 'Could not save your request. Please try again.');
      return;
    }

    const displayLabel = trimmedPort
      ? `${trimmedPort} — ${trimmedCity}, ${region.name}`
      : `${trimmedCity}, ${region.name}`;
    onSubmitted({ cityId: res.data.cityId, portId: res.data.portId }, displayLabel);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-0 py-0 md:items-center md:px-4 md:py-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col bg-background shadow-xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Add a location</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            Can&apos;t find what you&apos;re looking for in our list or OpenStreetMap? Tell us about
            it and we&apos;ll add it. Only you will see it on your profile until our team confirms
            the details.
          </p>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Country
            <select
              required
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              disabled={regionsLoading || submitting}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs disabled:opacity-50"
            >
              <option value="">{regionsLoading ? 'Loading…' : 'Select a country'}</option>
              {regions?.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.country_code}>
                  {r.name}
                  {r.country_code ? ` (${r.country_code})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            City
            <input
              ref={cityRef}
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              disabled={submitting}
              placeholder="e.g. Antibes"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Port or marina {portRequired ? '' : '(optional)'}
            <input
              type="text"
              required={portRequired}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              disabled={submitting}
              placeholder="e.g. Port Vauban"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_NOTES_LENGTH}
              disabled={submitting}
              placeholder="e.g. Private marina near Cap d'Antibes"
              className="min-h-16 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs disabled:opacity-50"
            />
          </label>

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
              disabled={submitting || regionsLoading}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
