'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, ShieldAlert, Pencil } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { convertSizeBandLabel, metersToFeet } from '@dockwalker/shared';
import { usePreferences } from '@/hooks/use-preferences';
import { useToast } from '@/hooks/use-toast';
import { ImoLookupSection } from '@/components/vessels/imo-lookup-section';
import { AddVesselDialog } from '@/components/add-vessel-dialog';

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
  return (
    <Suspense>
      <VesselsContent />
    </Suspense>
  );
}

function VesselsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const prefs = usePreferences();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [sizeBands, setSizeBands] = useState<SizeBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!returnTo);

  const loadVessels = useCallback(async () => {
    try {
      const result = await safeFetch<{ vessels?: Vessel[] }>('/api/vessels');
      if (result.ok) {
        if (result.data.vessels) setVessels(result.data.vessels);
        setError(null);
      } else {
        setError('Failed to load vessels. Please try again.');
      }
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
    setShowForm(false);
    showSuccess('Vessel added');
    if (returnTo === 'daywork-post') {
      router.push('/daywork/post');
    } else if (returnTo === 'permanent-post') {
      router.push('/daywork/post?mode=permanent');
    } else {
      loadVessels();
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center justify-between">
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Your Vessels</h1>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            {showForm ? 'Cancel' : 'Add vessel'}
          </Button>
        </div>
      </header>

      <div className="page-width flex w-full flex-1 flex-col gap-3 px-4 py-6 lg:flex-row lg:gap-6">
        {showForm && (
          <Card className="lg:w-[400px] lg:shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add a vessel</CardTitle>
              <p className="text-xs text-muted-foreground">
                Register a vessel to attach to postings
              </p>
            </CardHeader>
            <CardContent>
              <CreateVesselForm
                sizeBands={sizeBands}
                onCreated={handleCreated}
                lengthUnit={prefs.lengthUnit}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-1 flex-col gap-3">
          {loading && <LoadingSpinner size="md" />}

          {error && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={loadVessels}>
                Retry
              </Button>
            </div>
          )}

          {!loading && vessels.length === 0 && (
            <EmptyState
              imageSrc="/images/empty-states/vessels.jpg"
              title="No vessels yet"
              description="Add a vessel to start posting daywork."
            />
          )}

          {vessels.map((vessel) => {
            const prefix = vessel.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
            const loaDisplay =
              vessel.loa_meters != null
                ? prefs.lengthUnit === 'ft'
                  ? `${Math.round(metersToFeet(vessel.loa_meters))}ft`
                  : `${vessel.loa_meters}m`
                : null;
            const bandDisplay = vessel.vessel_size_bands?.label
              ? convertSizeBandLabel(vessel.vessel_size_bands.label, prefs.lengthUnit)
              : null;
            const meta = [
              vessel.vessel_type === 'sail' ? 'Sail' : 'Motor',
              loaDisplay,
              bandDisplay,
            ].filter(Boolean);

            return (
              <Card key={vessel.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        <span className="text-muted-foreground">{prefix}</span> {vessel.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        IMO {vessel.imo_number}
                      </p>
                      {meta.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{meta.join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {vessel.nda_flag && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3" />
                          NDA
                        </Badge>
                      )}
                      <Link href={`/vessels/${vessel.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
  const [useExisting, setUseExisting] = useState(false);
  const [existingVesselId, setExistingVesselId] = useState('');
  const [showAddVesselDialog, setShowAddVesselDialog] = useState(false);

  // When ImoLookupSection sets loaMeters (always in metres), convert to display unit
  function handleLoaFromLookup(metersStr: string) {
    const m = Number(metersStr);
    if (lengthUnit === 'ft' && Number.isFinite(m) && m > 0) {
      setLoaInput(String(Math.round(metersToFeet(m))));
    } else {
      setLoaInput(metersStr);
    }
  }

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

    // Vessel found via lookup — always attempt POST.
    // If it's already ours (same IMO + owner), the API will return an error
    // which we handle gracefully by refreshing the list.

    if (loaMeters == null || loaMeters < 1) {
      setError('Please enter a valid vessel length');
      return;
    }

    setLoading(true);
    const result = await safeFetch<{ error?: string }>('/api/vessels', {
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
    if (result.ok) {
      onCreated();
    } else if (result.error?.includes('duplicate') || result.error?.includes('unique')) {
      // Vessel already exists for this owner — treat as success
      onCreated();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ImoLookupSection
        imoNumber={imoNumber}
        setImoNumber={setImoNumber}
        useExisting={useExisting}
        setUseExisting={setUseExisting}
        existingVesselId={existingVesselId}
        setExistingVesselId={setExistingVesselId}
        vesselName={name}
        setVesselName={setName}
        vesselType={(vesselType || 'motor') as 'motor' | 'sail'}
        setVesselType={(v) => setVesselType(v)}
        loaMeters={loaInput}
        setLoaMeters={handleLoaFromLookup}
        onAddManually={() => setShowAddVesselDialog(true)}
      />

      <AddVesselDialog
        open={showAddVesselDialog}
        initialImoNumber={imoNumber}
        onClose={() => setShowAddVesselDialog(false)}
        onSubmitted={() => {
          setShowAddVesselDialog(false);
          onCreated();
        }}
      />

      {!useExisting && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Vessel type</Label>
            <Select value={vesselType} onValueChange={setVesselType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motor">Motor (M/Y)</SelectItem>
                <SelectItem value="sail">Sail (S/Y)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vesselName">Vessel name</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                {vesselType === 'sail' ? 'S/Y' : 'M/Y'}
              </span>
              <Input
                id="vesselName"
                placeholder="Vessel Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-l-none"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loa">Length overall ({lengthUnit === 'ft' ? 'feet' : 'metres'})</Label>
            <Input
              id="loa"
              type="text"
              inputMode="decimal"
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
        </>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">NDA vessel</p>
          <p className="text-xs text-muted-foreground">
            Hide vessel identity from crew until they accept a position
          </p>
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
