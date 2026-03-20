'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { convertSizeBandLabel, metersToFeet } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeft, Loader2 } from 'lucide-react';

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

export default function EditVesselPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { showError, showSuccess } = useToast();
  const prefs = usePreferences();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sizeBands, setSizeBands] = useState<SizeBand[]>([]);

  // Vessel fields
  const [imoNumber, setImoNumber] = useState('');
  const [name, setName] = useState('');
  const [vesselType, setVesselType] = useState('motor');
  const [loaInput, setLoaInput] = useState('');
  const [ndaFlag, setNdaFlag] = useState(false);
  const [originalNda, setOriginalNda] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [vesselRes, bandsRes] = await Promise.all([
      fetch('/api/vessels'),
      supabase
        .from('vessel_size_bands')
        .select('id, label, min_meters, max_meters')
        .order('sort_order'),
    ]);

    if (bandsRes.data) setSizeBands(bandsRes.data);

    if (vesselRes.ok) {
      const data = await vesselRes.json();
      const vessel = (data.vessels ?? []).find((v: { id: string }) => v.id === id);
      if (vessel) {
        setImoNumber(vessel.imo_number ?? '');
        setName(vessel.name ?? '');
        setVesselType(vessel.vessel_type ?? 'motor');
        setNdaFlag(vessel.nda_flag ?? false);
        setOriginalNda(vessel.nda_flag ?? false);
        if (vessel.loa_meters != null) {
          setLoaInput(
            prefs.lengthUnit === 'ft'
              ? String(Math.round(metersToFeet(vessel.loa_meters)))
              : String(vessel.loa_meters),
          );
        }
      }
    }
    setLoading(false);
  }, [id, prefs.lengthUnit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loaNum = Number(loaInput);
  const loaMeters =
    loaInput && Number.isFinite(loaNum) && loaNum > 0
      ? prefs.lengthUnit === 'ft'
        ? loaNum / 3.28084
        : loaNum
      : null;
  const matchedBand =
    loaMeters != null
      ? sizeBands.find(
          (b) => loaMeters >= b.min_meters && (b.max_meters === null || loaMeters < b.max_meters),
        )
      : null;

  async function handleSubmit() {
    if (!name) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/vessels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          vesselType,
          loaMeters: loaMeters != null ? Math.round(loaMeters * 100) / 100 : undefined,
          ndaFlag,
        }),
      });
      if (res.ok) {
        showSuccess('Vessel updated');
        router.push('/vessels');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error ?? 'Failed to update vessel');
      }
    } catch {
      showError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const vesselPrefix = vesselType === 'sail' ? 'S/Y' : 'M/Y';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center">
          <button
            onClick={() => router.push('/vessels')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to vessels
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Edit vessel</h1>
          <p className="text-sm text-muted-foreground">IMO {imoNumber}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vessel name</Label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              {vesselPrefix}
            </span>
            <Input
              placeholder="Vessel Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-l-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Vessel type</Label>
          <Select value={vesselType} onValueChange={setVesselType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="motor">Motor (M/Y)</SelectItem>
              <SelectItem value="sail">Sail (S/Y)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Length overall ({prefs.lengthUnit === 'ft' ? 'feet' : 'metres'})</Label>
          <Input
            type="number"
            min="1"
            step="0.1"
            placeholder={prefs.lengthUnit === 'ft' ? 'e.g. 131' : 'e.g. 40'}
            value={loaInput}
            onChange={(e) => setLoaInput(e.target.value)}
          />
          {matchedBand && (
            <p className="text-xs text-muted-foreground">
              Size band: {convertSizeBandLabel(matchedBand.label, prefs.lengthUnit)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">NDA vessel</p>
            <p className="text-xs text-muted-foreground">
              {originalNda
                ? 'NDA cannot be removed once enabled'
                : 'Hide vessel identity from crew'}
            </p>
          </div>
          <Switch checked={ndaFlag} onCheckedChange={setNdaFlag} disabled={originalNda} />
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !name} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </main>
  );
}
