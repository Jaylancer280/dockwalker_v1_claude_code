'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeft, Loader2, Search } from 'lucide-react';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
}

interface FlagState {
  id: string;
  name: string;
}

const ROTATION_TYPES = [
  { value: '2:2', label: '2:2' },
  { value: '3:1', label: '3:1' },
  { value: '3:3', label: '3:3' },
  { value: '5:1', label: '5:1' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'mlc_standard', label: 'MLC Standard' },
  { value: 'other', label: 'Other' },
];

export default function AddExperiencePage() {
  const router = useRouter();
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // IMO lookup
  const [imoNumber, setImoNumber] = useState('');
  const [lookingUpImo, setLookingUpImo] = useState(false);
  const [imoMessage, setImoMessage] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [existingVesselId, setExistingVesselId] = useState('');

  // Vessel fields
  const [vesselName, setVesselName] = useState('');
  const [vesselType, setVesselType] = useState<'charter' | 'private'>('charter');
  const [loaMeters, setLoaMeters] = useState('');

  // Experience fields
  const [roleId, setRoleId] = useState('');
  const [charterOrPrivate, setCharterOrPrivate] = useState<'charter' | 'private'>('charter');
  const [flagState, setFlagState] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [rotationType, setRotationType] = useState('');
  const [rotationDetails, setRotationDetails] = useState('');
  const [description, setDescription] = useState('');

  const loadLookups = useCallback(async () => {
    const supabase = createClient();
    const [rolesRes, flagsRes] = await Promise.all([
      supabase.from('yacht_roles').select('id, name').order('sort_order'),
      supabase.from('flag_states').select('id, name').order('sort_order'),
    ]);
    if (rolesRes.data) setRoles(rolesRes.data);
    if (flagsRes.data) setFlagStates(flagsRes.data);
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadLookups();
  }, [loadLookups]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleImoLookup() {
    if (imoNumber.length !== 7) return;
    setLookingUpImo(true);
    setImoMessage('');
    const res = await fetch(`/api/vessels/lookup?imo=${imoNumber}`);
    if (res.ok) {
      const data = await res.json();
      if (data.found) {
        setImoMessage(`Found: ${data.vessel.name} (${data.vessel.loa_meters}m)`);
        setVesselName(data.vessel.name);
        setLoaMeters(String(data.vessel.loa_meters));
        setVesselType(data.vessel.vessel_type);
        setExistingVesselId(data.vessel.id);
        setUseExisting(true);
      } else {
        setImoMessage('Not found — enter vessel details below');
        setUseExisting(false);
        setExistingVesselId('');
      }
    }
    setLookingUpImo(false);
  }

  async function handleSubmit() {
    if (!roleId || !startDate || !charterOrPrivate || !imoNumber) return;
    setSubmitting(true);

    let vesselId = existingVesselId;

    // Create vessel if not using existing
    if (!useExisting) {
      if (!vesselName || !loaMeters) {
        setSubmitting(false);
        return;
      }
      const vesselRes = await fetch('/api/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imoNumber,
          name: vesselName,
          vesselType,
          loaMeters: Number(loaMeters),
          ndaFlag: false,
        }),
      });
      if (!vesselRes.ok) {
        setSubmitting(false);
        return;
      }
      const vesselData = await vesselRes.json();
      vesselId = vesselData.id;
    }

    const res = await fetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
        roleId,
        startDate,
        endDate: endDate || null,
        isCurrent,
        charterOrPrivate,
        flagState: flagState || null,
        rotationType: rotationType || null,
        rotationDetails: rotationDetails || null,
        description: description || null,
      }),
    });

    if (res.ok) {
      router.push('/profile');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to profile
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Add experience</h1>
          <p className="text-sm text-muted-foreground">
            Add a vessel experience entry to your profile
          </p>
        </div>

        {/* IMO lookup */}
        <div className="flex flex-col gap-1.5">
          <Label>IMO number</Label>
          <div className="flex gap-2">
            <Input
              placeholder="7 digits"
              value={imoNumber}
              onChange={(e) => {
                setImoNumber(e.target.value.replace(/\D/g, '').slice(0, 7));
                setUseExisting(false);
                setExistingVesselId('');
                setImoMessage('');
              }}
              maxLength={7}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={imoNumber.length !== 7 || lookingUpImo}
              onClick={handleImoLookup}
            >
              {lookingUpImo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {imoMessage && <p className="text-xs text-muted-foreground">{imoMessage}</p>}
        </div>

        {/* Vessel details — shown when not using existing vessel */}
        {!useExisting && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Vessel name</Label>
              <Input
                placeholder="M/Y Example"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Vessel type</Label>
                <Select
                  value={vesselType}
                  onValueChange={(v) => setVesselType(v as 'charter' | 'private')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charter">Charter</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>LOA (meters)</Label>
                <Input
                  type="number"
                  placeholder="45"
                  value={loaMeters}
                  onChange={(e) => setLoaMeters(e.target.value)}
                  min={1}
                />
              </div>
            </div>
          </>
        )}

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <Label>Role held</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Charter or private during tenure */}
        <div className="flex flex-col gap-1.5">
          <Label>Charter or private (during your time)</Label>
          <Select
            value={charterOrPrivate}
            onValueChange={(v) => setCharterOrPrivate(v as 'charter' | 'private')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="charter">Charter</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Flag state */}
        <div className="flex flex-col gap-1.5">
          <Label>Flag state</Label>
          <Select value={flagState} onValueChange={setFlagState}>
            <SelectTrigger>
              <SelectValue placeholder="Select flag state" />
            </SelectTrigger>
            <SelectContent>
              {flagStates.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Start date</Label>
            <Input
              type="month"
              value={startDate.slice(0, 7)}
              onChange={(e) => setStartDate(e.target.value + '-01')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>End date</Label>
            <Input
              type="month"
              value={endDate.slice(0, 7)}
              onChange={(e) => setEndDate(e.target.value + '-01')}
              disabled={isCurrent}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isCurrent}
            onCheckedChange={(checked) => {
              setIsCurrent(checked === true);
              if (checked) setEndDate('');
            }}
          />
          Currently onboard
        </label>

        {/* Rotation */}
        <div className="flex flex-col gap-1.5">
          <Label>Rotation</Label>
          <Select value={rotationType} onValueChange={setRotationType}>
            <SelectTrigger>
              <SelectValue placeholder="Select rotation type" />
            </SelectTrigger>
            <SelectContent>
              {ROTATION_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(rotationType === 'other' ||
          rotationType === 'seasonal' ||
          rotationType === 'mlc_standard') && (
          <div className="flex flex-col gap-1.5">
            <Label>Rotation details</Label>
            <Input
              placeholder="e.g. March-October, 38 days/year"
              value={rotationDetails}
              onChange={(e) => setRotationDetails(e.target.value)}
              maxLength={100}
            />
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label>Description (optional)</Label>
          <Textarea
            placeholder="Brief description of your role and responsibilities"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={250}
            rows={3}
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !roleId || !startDate || !imoNumber}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Add experience'
          )}
        </Button>
      </div>
    </main>
  );
}
