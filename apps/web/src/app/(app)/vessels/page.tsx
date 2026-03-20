'use client';

import { useState, useEffect, useCallback } from 'react';
import { Ship, Plus, ShieldAlert, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { convertSizeBandLabel, metersToFeet } from '@/lib/units';
import { usePreferences } from '@/hooks/use-preferences';
import { useToast } from '@/hooks/use-toast';

interface Vessel {
  id: string;
  imo_number: string;
  name: string;
  vessel_type: string;
  size_band_id: string;
  loa_meters: number | null;
  nda_flag: boolean;
  created_at: string;
  vessel_size_bands: { label: string } | null;
}

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

export default function VesselsPage() {
  const prefs = usePreferences();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [sizeBands, setSizeBands] = useState<SizeBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadVessels = useCallback(async () => {
    try {
      const res = await fetch('/api/vessels');
      if (!res.ok) throw new Error('Failed to load vessels');
      const data = await res.json();
      if (data.vessels) setVessels(data.vessels);
      setError(null);
    } catch {
      setError('Failed to load vessels. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVessels();
    async function loadSizeBands() {
      const supabase = createClient();
      const { data } = await supabase
        .from('vessel_size_bands')
        .select('id, label, min_meters, max_meters')
        .order('sort_order');
      if (data) setSizeBands(data);
    }
    loadSizeBands();
  }, [loadVessels]);

  const { showSuccess } = useToast();

  function handleCreated() {
    setDialogOpen(false);
    showSuccess('Vessel added');
    loadVessels();
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">Your Vessels</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add vessel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add a vessel</DialogTitle>
                <DialogDescription>
                  Register a vessel to attach to daywork postings
                </DialogDescription>
              </DialogHeader>
              <CreateVesselForm
                sizeBands={sizeBands}
                onCreated={handleCreated}
                lengthUnit={prefs.lengthUnit}
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-6">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={loadVessels}>
              Retry
            </Button>
          </div>
        )}

        {!loading && vessels.length === 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Ship className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">No vessels yet</CardTitle>
              </div>
              <CardDescription>
                Add a vessel to start posting daywork. Each vessel requires an IMO number.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {vessels.map((vessel) => (
          <Card key={vessel.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{vessel.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Link href={`/vessels/${vessel.id}/edit`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  {vessel.nda_flag && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <ShieldAlert className="h-3 w-3" />
                      NDA
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>IMO {vessel.imo_number}</span>
                <span className="capitalize">{vessel.vessel_type}</span>
                {vessel.loa_meters != null && (
                  <span>
                    {prefs.lengthUnit === 'ft'
                      ? `${Math.round(metersToFeet(vessel.loa_meters))}ft`
                      : `${vessel.loa_meters}m`}
                  </span>
                )}
                {!vessel.loa_meters && vessel.vessel_size_bands?.label && (
                  <span>
                    {convertSizeBandLabel(vessel.vessel_size_bands.label, prefs.lengthUnit)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

// ── Create Vessel Form ──────────────────────────────────────────────────────

function CreateVesselForm({
  sizeBands,
  onCreated,
  lengthUnit = 'm',
}: {
  sizeBands: SizeBand[];
  onCreated: () => void;
  lengthUnit?: 'm' | 'ft';
}) {
  const [imoNumber, setImoNumber] = useState('');
  const [name, setName] = useState('');
  const [vesselType, setVesselType] = useState('');
  const [loaInput, setLoaInput] = useState('');
  const [ndaFlag, setNdaFlag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Derive LOA in meters and matching band from the input
  const loaNum = Number(loaInput);
  const loaMeters =
    loaInput && Number.isFinite(loaNum) && loaNum > 0
      ? lengthUnit === 'ft'
        ? loaNum / 3.28084
        : loaNum
      : null;
  const matchedBand =
    loaMeters != null
      ? sizeBands.find(
          (b) => loaMeters >= b.min_meters && (b.max_meters === null || loaMeters < b.max_meters),
        )
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (loaMeters == null || loaMeters < 1) {
      setError('Please enter a valid vessel length');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/vessels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imoNumber,
        name,
        vesselType,
        loaMeters: Math.round(loaMeters * 100) / 100,
        ndaFlag,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="imo">IMO number (required)</Label>
        <Input
          id="imo"
          placeholder="7 digits"
          value={imoNumber}
          onChange={(e) => setImoNumber(e.target.value)}
          maxLength={7}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vesselName">Vessel name</Label>
        <Input
          id="vesselName"
          placeholder="M/Y Example"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Vessel type</Label>
        <Select value={vesselType} onValueChange={setVesselType} required>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="charter">Charter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loa">Length overall ({lengthUnit === 'ft' ? 'feet' : 'metres'})</Label>
        <Input
          id="loa"
          type="number"
          min="1"
          step="0.1"
          placeholder={lengthUnit === 'ft' ? 'e.g. 131' : 'e.g. 40'}
          value={loaInput}
          onChange={(e) => setLoaInput(e.target.value)}
          required
        />
        {matchedBand && (
          <p className="text-xs text-muted-foreground">
            Size band: {convertSizeBandLabel(matchedBand.label, lengthUnit)}
          </p>
        )}
        {loaInput && !matchedBand && loaMeters != null && (
          <p className="text-xs text-destructive">
            Minimum vessel size is{' '}
            {lengthUnit === 'ft'
              ? `${Math.round(metersToFeet(sizeBands[0]?.min_meters ?? 24))}ft`
              : `${sizeBands[0]?.min_meters ?? 24}m`}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">NDA vessel</p>
          <p className="text-xs text-muted-foreground">Hide vessel identity from crew</p>
        </div>
        <Switch checked={ndaFlag} onCheckedChange={setNdaFlag} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading || !matchedBand} className="w-full">
        {loading ? 'Adding vessel...' : 'Add vessel'}
      </Button>
    </form>
  );
}
